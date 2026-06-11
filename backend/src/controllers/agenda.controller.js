const pool         = require('../config/db');
const { logAudit } = require('../utils/audit.util');

const isDev = process.env.NODE_ENV !== 'production';

// ── Granularidad de la grilla (minutos) ──────────────────────────
// Debe coincidir con el paso de reserva (5 min) para que el buffer de CADA
// cita (5, 10, 15, 20 min) se muestre sin que la siguiente cita lo pise.
const GRANULARIDAD = 5;

// ── Utilidades (independientes del appointment.controller) ────────
const timeToMins = (t) => {
  const [h, m] = String(t).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

const minsToTime = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const getDayName = (fechaStr) => {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  return DIAS[new Date(y, m - 1, d).getDay()];
};

const fechaValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// ─────────────────────────────────────────────────────────────────
// GET /api/agenda/disponibilidad/:doctorId?fecha=YYYY-MM-DD
//
// Motor de Disponibilidad — Agenda Médica
// Devuelve una grilla de slots de GRANULARIDAD minutos para el día
// solicitado, con cada slot clasificado en:
//   DISPONIBLE  → libre dentro del horario laboral
//   OCUPADO     → cubierto por una cita activa (RESERVADA|CONFIRMADA)
//   BUFFER      → limpieza post-cita, no reservable
//   NO_LABORAL  → fuera del horario configurado del doctor
//   PASADO      → hora ya transcurrida (solo si fecha = hoy)
//
// Roles: RECEPCIONISTA, ADMINISTRADOR, DOCTOR
// ─────────────────────────────────────────────────────────────────
const getDisponibilidad = async (req, res) => {
  // ── 1. Parsear y validar parámetros ────────────────────────────
  const doctorId = Number(req.params.doctorId);
  if (!doctorId || !Number.isInteger(doctorId))
    return res.status(400).json({ error: 'ID de doctor inválido' });

  const hoy   = new Date().toLocaleDateString('en-CA');
  const fecha = req.query.fecha ?? hoy;

  if (!fechaValida(fecha))
    return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });

  // Limitar a 60 días en el futuro
  // Usamos diferencia aritmética pura (días calendario) para evitar
  // desfases UTC vs. hora local cuando el servidor no corre en UTC.
  const [hy, hm, hd] = hoy.split('-').map(Number);
  const [fy, fm, fd] = fecha.split('-').map(Number);
  const diffDias = Math.round(
    (new Date(fy, fm - 1, fd) - new Date(hy, hm - 1, hd)) / 86_400_000
  );
  if (diffDias < -1)
    return res.status(400).json({ error: 'No se puede consultar disponibilidad de fechas pasadas' });
  if (diffDias > 60)
    return res.status(400).json({ error: 'No se puede consultar disponibilidad con más de 60 días de anticipación' });

  const diaSemana = getDayName(fecha);

  // ── 2. Verificar que el doctor existe y está activo ─────────────
  try {
    const [[doctor]] = await pool.query(
      `SELECT u.usuario_id AS id,
              CONCAT(u.nombre,' ',u.apellido) AS nombre,
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                 FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
                WHERE de.doctor_id = d.doctor_id) AS especialidad
       FROM   USUARIO u
       JOIN   DOCTOR  d ON d.doctor_id = u.usuario_id
       WHERE  u.usuario_id = ? AND u.estado = 'ACTIVO'`,
      [doctorId]
    );
    if (!doctor)
      return res.status(404).json({ error: 'Doctor no encontrado o inactivo' });

    // ── 3. Bloques laborales del doctor para ese día ────────────────
    const [bloques] = await pool.query(
      `SELECT TIME_FORMAT(hora_inicio, '%H:%i') AS inicio,
              TIME_FORMAT(hora_fin,    '%H:%i') AS fin
       FROM   HORARIO
       WHERE  doctor_id = ? AND dia_semana = ? AND estado = 'ACTIVO'
       ORDER  BY hora_inicio`,
      [doctorId, diaSemana]
    );

    // ── 4. Citas activas ese día (RESERVADA | CONFIRMADA) ───────────
    // UPPER() en el estado para ser insensibles a mayúsculas/minúsculas
    // en caso de que algún registro haya sido insertado con capitalización
    // diferente (ej. 'Confirmada' en lugar de 'CONFIRMADA').
    const [citas] = await pool.query(
      `SELECT
         c.cita_id,
         c.codigo_cita,
         TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio_cita,
         TIME_FORMAT(c.hora_fin,    '%H:%i') AS hora_fin_cita,
         s.duracion,
         s.buffer,
         CONCAT(p.nombre,' ',p.apellido) AS paciente_nombre,
         s.nombre AS servicio_nombre
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       JOIN   PACIENTE p ON p.paciente_id = c.paciente_id
       WHERE  c.doctor_id = ? AND c.fecha = ?
         AND  UPPER(c.estado) IN ('RESERVADA', 'CONFIRMADA')
       ORDER  BY c.hora_inicio`,
      [doctorId, fecha]
    );

    // ── 5. Calcular "ahora" en minutos (para marcar slots PASADO) ───
    let ahoraMins = -1; // -1 = fecha futura → ningún slot es PASADO
    if (fecha === hoy) {
      const ahora = new Date();
      ahoraMins   = ahora.getHours() * 60 + ahora.getMinutes();
    }

    // ── 6. Construir conjuntos de rangos para lookup O(1) ───────────
    // Mapa de minuto → { cita } para slots OCUPADO y BUFFER
    const citaEnSlot = new Map();

    for (const cita of citas) {
      const citaIni    = timeToMins(cita.hora_inicio_cita);
      const citaFin    = timeToMins(cita.hora_fin_cita);       // fin real de la cita
      const bufferFin  = citaFin + cita.buffer;                // fin incluyendo buffer

      // ── BUG FIX: alinear el inicio al slot de GRANULARIDAD anterior ────
      // El loop de la grilla itera en múltiplos exactos de GRANULARIDAD
      // (0, 15, 30, …). Si una cita comienza en un minuto no alineado
      // (ej. 02:03 → 123 min), la clave 123 nunca coincide con ningún
      // slot del grid (120, 135, …) y la cita queda invisible.
      // Solución: bajar al múltiplo de GRANULARIDAD inmediatamente anterior.
      const slotIniAlineado = Math.floor(citaIni / GRANULARIDAD) * GRANULARIDAD;

      // Enriquecer el objeto cita con los límites ya calculados
      const citaInfo = {
        cita_id:             cita.cita_id,
        codigo_cita:         cita.codigo_cita,
        paciente_nombre:     cita.paciente_nombre,
        servicio_nombre:     cita.servicio_nombre,
        hora_inicio_cita:    cita.hora_inicio_cita,
        hora_fin_cita:       cita.hora_fin_cita,
        hora_fin_con_buffer: minsToTime(bufferFin),
      };

      // Marcar cada slot de GRANULARIDAD minutos dentro del rango de la cita
      for (let m = slotIniAlineado; m < bufferFin; m += GRANULARIDAD) {
        const tipo = m < citaFin ? 'OCUPADO' : 'BUFFER';
        // Si dos citas se solapan (no debería ocurrir), OCUPADO gana sobre BUFFER
        if (!citaEnSlot.has(m) || citaEnSlot.get(m).tipo === 'BUFFER') {
          citaEnSlot.set(m, { tipo, cita: citaInfo });
        }
      }
    }

    // Conjunto de minutos laborales (para lookup O(1))
    // ── BUG FIX: alinear los extremos del bloque a la GRANULARIDAD ──────────
    // Si hora_inicio no es múltiplo de GRANULARIDAD (ej. 02:03 → 123 min),
    // el loop generaría {123, 138, …} mientras que el grid itera {120, 135, …},
    // por lo que nunca hay coincidencia y todo el día aparece como NO_LABORAL.
    // Solución: bajar el inicio al múltiplo anterior (floor) y subir el fin
    // al múltiplo posterior (ceil) para que los slots del borde queden cubiertos.
    const minutosLaborales = new Set();
    for (const bloque of bloques) {
      const bloqueIni = Math.floor(timeToMins(bloque.inicio) / GRANULARIDAD) * GRANULARIDAD;
      const bloqueFin = Math.ceil(timeToMins(bloque.fin)    / GRANULARIDAD) * GRANULARIDAD;
      for (let m = bloqueIni; m < bloqueFin; m += GRANULARIDAD) {
        minutosLaborales.add(m);
      }
    }

    // ── 7. Generar la grilla SOLO dentro del horario laboral ────────
    // (evita scroll de horas vacías). Se extiende el fin si el buffer de
    // alguna cita se prolonga más allá del cierre, para que se vea completo.
    let gridIni = Infinity, gridFin = -Infinity;
    for (const bloque of bloques) {
      gridIni = Math.min(gridIni, Math.floor(timeToMins(bloque.inicio) / GRANULARIDAD) * GRANULARIDAD);
      gridFin = Math.max(gridFin, Math.ceil(timeToMins(bloque.fin)     / GRANULARIDAD) * GRANULARIDAD);
    }
    for (const cita of citas) {
      const bf = timeToMins(cita.hora_fin_cita) + (cita.buffer || 0);
      gridFin = Math.max(gridFin, Math.ceil(bf / GRANULARIDAD) * GRANULARIDAD);
    }
    if (!isFinite(gridIni)) { gridIni = 0; gridFin = 0; } // día sin bloques laborales

    const slots = [];
    const resumen = { total_slots: 0, disponibles: 0, ocupados: 0, buffer: 0, no_laborales: 0, pasados: 0 };

    for (let m = gridIni; m < gridFin; m += GRANULARIDAD) {
      const slotFin = m + GRANULARIDAD;
      resumen.total_slots++;

      let slot;

      if (ahoraMins >= 0 && slotFin <= ahoraMins) {
        // Slot completamente en el pasado
        slot = { hora_inicio: minsToTime(m), hora_fin: minsToTime(slotFin), tipo: 'PASADO' };
        resumen.pasados++;
      } else if (!minutosLaborales.has(m)) {
        // Fuera del horario laboral configurado
        slot = { hora_inicio: minsToTime(m), hora_fin: minsToTime(slotFin), tipo: 'NO_LABORAL' };
        resumen.no_laborales++;
      } else if (citaEnSlot.has(m)) {
        // Cubierto por una cita
        const { tipo, cita } = citaEnSlot.get(m);
        slot = { hora_inicio: minsToTime(m), hora_fin: minsToTime(slotFin), tipo, cita };
        if (tipo === 'OCUPADO') resumen.ocupados++;
        else                    resumen.buffer++;
      } else {
        // Libre y laboral
        slot = { hora_inicio: minsToTime(m), hora_fin: minsToTime(slotFin), tipo: 'DISPONIBLE' };
        resumen.disponibles++;
      }

      slots.push(slot);
    }

    // ── 8. Auditoría ────────────────────────────────────────────────
    await logAudit({
      usuario_id: req.user?.id,
      accion:     'CONSULTAR_DISPONIBILIDAD',
      entidad:    'HORARIO',
      entidad_id: doctorId,
      detalles:   JSON.stringify({
        doctor_id:        doctorId,
        fecha,
        dia_semana:       diaSemana,
        slots_disponibles: resumen.disponibles,
        slots_ocupados:    resumen.ocupados,
        citas_del_dia:     citas.length,
      }),
      ip_origen: req.ip,
    });

    // ── 9. Respuesta ────────────────────────────────────────────────
    return res.json({
      doctor: {
        id:          doctor.id,
        nombre:      doctor.nombre,
        especialidad: doctor.especialidad,
      },
      fecha,
      dia_semana:   diaSemana,
      es_laborable: bloques.length > 0 && diaSemana !== 'DOMINGO',
      granularidad_mins: GRANULARIDAD,
      generado_en:  new Date().toISOString(),
      slots,
      resumen,
    });

  } catch (err) {
    console.error('[agenda.getDisponibilidad]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/agenda/resumen-mes/:doctorId?anio=YYYY&mes=M
//
// Resumen mensual para la vista "Mensual" de la Agenda Médica.
// Devuelve un arreglo con un registro por día del mes indicando:
//   es_laboral → el doctor tiene horario configurado ese día de la semana
//   ocupados   → nº de citas activas (RESERVADA|CONFIRMADA) ese día
//
// Se resuelve con solo dos consultas agregadas (no genera la grilla de
// slots por día), por lo que es eficiente para pintar el calendario.
//
// Roles: RECEPCIONISTA, ADMINISTRADOR, DOCTOR
// ─────────────────────────────────────────────────────────────────
const getResumenMes = async (req, res) => {
  const doctorId = Number(req.params.doctorId);
  if (!doctorId || !Number.isInteger(doctorId))
    return res.status(400).json({ error: 'ID de doctor inválido' });

  const anio = Number(req.query.anio);
  const mes  = Number(req.query.mes);   // 1-12
  if (!anio || !mes || mes < 1 || mes > 12)
    return res.status(400).json({ error: 'Parámetros requeridos: anio y mes (1-12)' });

  try {
    // ── 1. Doctor activo ────────────────────────────────────────────
    const [[doctor]] = await pool.query(
      `SELECT u.usuario_id AS id,
              CONCAT(u.nombre,' ',u.apellido) AS nombre,
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                 FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
                WHERE de.doctor_id = d.doctor_id) AS especialidad
       FROM   USUARIO u
       JOIN   DOCTOR  d ON d.doctor_id = u.usuario_id
       WHERE  u.usuario_id = ? AND u.estado = 'ACTIVO'`,
      [doctorId]
    );
    if (!doctor)
      return res.status(404).json({ error: 'Doctor no encontrado o inactivo' });

    // ── 2. Días de la semana en que el doctor atiende ───────────────
    const [horarios] = await pool.query(
      `SELECT DISTINCT dia_semana FROM HORARIO
       WHERE  doctor_id = ? AND estado = 'ACTIVO'`,
      [doctorId]
    );
    const diasLaborables = new Set(horarios.map(h => h.dia_semana));

    // ── 3. Citas activas por día en el mes ──────────────────────────
    const mm        = String(mes).padStart(2, '0');
    const ultimoNum = new Date(anio, mes, 0).getDate();   // último día del mes
    const primerDia = `${anio}-${mm}-01`;
    const ultimoDia = `${anio}-${mm}-${String(ultimoNum).padStart(2, '0')}`;

    const [citasPorDia] = await pool.query(
      `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, COUNT(*) AS total
       FROM   CITA
       WHERE  doctor_id = ? AND fecha BETWEEN ? AND ?
         AND  UPPER(estado) IN ('RESERVADA', 'CONFIRMADA')
       GROUP  BY fecha`,
      [doctorId, primerDia, ultimoDia]
    );
    const mapaCitas = new Map(citasPorDia.map(r => [r.fecha, Number(r.total)]));

    // ── 4. Construir el arreglo de días del mes ─────────────────────
    const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const dias = [];
    for (let d = 1; d <= ultimoNum; d++) {
      const fecha     = `${anio}-${mm}-${String(d).padStart(2, '0')}`;
      const diaSemana = DIAS[new Date(anio, mes - 1, d).getDay()];
      const esLaboral = diaSemana !== 'DOMINGO' && diasLaborables.has(diaSemana);
      dias.push({
        fecha,
        dia:        d,
        dia_semana: diaSemana,
        es_laboral: esLaboral,
        ocupados:   mapaCitas.get(fecha) ?? 0,
      });
    }

    // ── 5. Auditoría ────────────────────────────────────────────────
    await logAudit({
      usuario_id: req.user?.id,
      accion:     'CONSULTAR_RESUMEN_MES',
      entidad:    'HORARIO',
      entidad_id: doctorId,
      detalles:   JSON.stringify({ doctor_id: doctorId, anio, mes }),
      ip_origen:  req.ip,
    });

    return res.json({
      doctor: { id: doctor.id, nombre: doctor.nombre, especialidad: doctor.especialidad },
      anio,
      mes,
      dias,
    });

  } catch (err) {
    console.error('[agenda.getResumenMes]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

module.exports = { getDisponibilidad, getResumenMes };
