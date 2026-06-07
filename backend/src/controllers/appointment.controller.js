const pool         = require('../config/db');
const { logAudit } = require('../utils/audit.util');
const crypto       = require('crypto');

const isDev = process.env.NODE_ENV !== 'production';

// ── Utilidades ───────────────────────────────────────────────────
const timeToMins = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minsToTime = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const getDayName = (fechaStr) => {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const DIAS = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
  return DIAS[new Date(y, m - 1, d).getDay()];
};

const generateCode = () => crypto.randomBytes(5).toString('hex').toUpperCase();

// GET /api/appointments/slots?doctor_id=X&servicio_id=Y&fecha=YYYY-MM-DD
const getSlots = async (req, res) => {
  const doctorId   = Number(req.query.doctor_id);
  const servicioId = Number(req.query.servicio_id);
  const { fecha }  = req.query;

  if (!doctorId || !servicioId || !fecha)
    return res.status(400).json({ error: 'Parámetros requeridos: doctor_id, servicio_id, fecha' });

  const hoy = new Date().toLocaleDateString('en-CA');
  if (fecha < hoy)
    return res.status(400).json({ error: 'La fecha no puede ser en el pasado' });

  const diaSemana = getDayName(fecha);
  if (diaSemana === 'DOMINGO')
    return res.json({ slots: [] });

  try {
    // Horarios activos del doctor para ese día
    const [horarios] = await pool.query(
      `SELECT TIME_FORMAT(hora_inicio,'%H:%i') AS hora_inicio,
              TIME_FORMAT(hora_fin,   '%H:%i') AS hora_fin
       FROM   HORARIO
       WHERE  doctor_id = ? AND dia_semana = ? AND estado = 'ACTIVO'
       ORDER  BY hora_inicio`,
      [doctorId, diaSemana]
    );
    if (!horarios.length) return res.json({ slots: [] });

    // Duración y buffer del servicio
    const [[servicio]] = await pool.query(
      `SELECT duracion, buffer FROM SERVICIO
       WHERE  servicio_id = ? AND estado = 'ACTIVO'`,
      [servicioId]
    );
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });

    // Citas ya existentes ese día (para detectar solapamientos)
    const [booked] = await pool.query(
      `SELECT TIME_FORMAT(hora_inicio,'%H:%i') AS hi,
              TIME_FORMAT(hora_fin,   '%H:%i') AS hf
       FROM   CITA
       WHERE  doctor_id = ? AND fecha = ?
         AND  estado IN ('RESERVADA','CONFIRMADA')`,
      [doctorId, fecha]
    );

    const totalMins = servicio.duracion + servicio.buffer;
    const slots = [];

    for (const h of horarios) {
      let cur = timeToMins(h.hora_inicio);
      const end = timeToMins(h.hora_fin);
      while (cur + servicio.duracion <= end) {
        const slotEnd = cur + servicio.duracion;
        const overlaps = booked.some(
          b => cur < timeToMins(b.hf) && slotEnd > timeToMins(b.hi)
        );
        if (!overlaps)
          slots.push({ hora_inicio: minsToTime(cur), hora_fin: minsToTime(slotEnd) });
        cur += totalMins;
      }
    }

    return res.json({ slots });
  } catch (err) {
    console.error('[appointment.getSlots]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/appointments
const create = async (req, res) => {
  const {
    paciente_id, doctor_id, servicio_id,
    fecha, hora_inicio,
  } = req.body;

  if (!paciente_id || !doctor_id || !servicio_id || !fecha || !hora_inicio)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  const hoy = new Date().toLocaleDateString('en-CA');
  if (fecha < hoy)
    return res.status(400).json({ error: 'La fecha no puede ser en el pasado' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    // Obtener servicio
    const [[servicio]] = await conn.query(
      `SELECT duracion, buffer, costo FROM SERVICIO
       WHERE  servicio_id = ? AND estado = 'ACTIVO'`,
      [Number(servicio_id)]
    );
    if (!servicio) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Servicio no encontrado o inactivo' });
    }

    const hora_fin = minsToTime(timeToMins(hora_inicio) + servicio.duracion);

    // Verificar solapamiento con citas existentes
    const [[{ cnt }]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM CITA
       WHERE  doctor_id = ? AND fecha = ?
         AND  estado IN ('RESERVADA','CONFIRMADA')
         AND  hora_inicio < ? AND hora_fin > ?`,
      [Number(doctor_id), fecha, hora_fin, hora_inicio]
    );
    if (cnt > 0) {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: 'Ese horario ya fue reservado. Por favor elige otro.' });
    }

    // Generar código único
    let codigo_cita;
    for (let i = 0; i < 5; i++) {
      const code = generateCode();
      const [[{ c }]] = await conn.query(
        'SELECT COUNT(*) AS c FROM CITA WHERE codigo_cita = ?', [code]
      );
      if (c === 0) { codigo_cita = code; break; }
    }
    if (!codigo_cita) throw new Error('No se pudo generar un código único para la cita');

    // Insertar cita
    const [result] = await conn.query(
      `INSERT INTO CITA
       (paciente_id, doctor_id, servicio_id, usuario_id, fecha, hora_inicio, hora_fin,
        precio_aplicado, codigo_cita, estado, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RESERVADA', 'PERSONAL')`,
      [
        Number(paciente_id),
        Number(doctor_id),
        Number(servicio_id),
        req.user?.id ?? null,
        fecha,
        hora_inicio,
        hora_fin,
        servicio.costo,
        codigo_cita,
      ]
    );

    await conn.query('COMMIT');

    await logAudit({
      usuario_id:  req.user?.id,
      paciente_id: Number(paciente_id),
      accion:      'REGISTRO_CITA',
      entidad:     'CITA',
      entidad_id:  result.insertId,
      detalles:    JSON.stringify({ doctor_id, servicio_id, fecha, hora_inicio, codigo_cita }),
      ip_origen:   req.ip,
    });

    return res.status(201).json({
      message:     'Cita agendada correctamente',
      cita_id:     result.insertId,
      codigo_cita,
    });

  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[appointment.create]', err.message);

    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Ese horario ya fue reservado. Por favor elige otro.' });

    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  } finally {
    if (conn) conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/appointments
// Lista/busca/filtra citas con paginación (20 por página).
// Por defecto muestra las citas del día actual, en orden cronológico.
// Filtros: codigo, q (paciente DNI/nombre/apellido), doctor_id, estado,
//          fecha_inicio, fecha_fin.
// ─────────────────────────────────────────────────────────────────
const ESTADOS_VALIDOS = ['RESERVADA','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO','EXPIRADA'];

const list = async (req, res) => {
  const {
    codigo, q, doctor_id, estado,
    fecha_inicio, fecha_fin, page = 1,
  } = req.query;

  const limit  = 20;
  const offset = (Number(page) - 1) * limit;

  const conds  = [];
  const params = [];

  if (codigo && codigo.trim()) {
    conds.push('UPPER(c.codigo_cita) = UPPER(?)');
    params.push(codigo.trim());
  }
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(`(pat.numero_documento LIKE ?
                 OR LOWER(pat.nombre)   LIKE LOWER(?)
                 OR LOWER(pat.apellido) LIKE LOWER(?)
                 OR LOWER(CONCAT(pat.nombre,' ',pat.apellido)) LIKE LOWER(?))`);
    params.push(like, like, like, like);
  }
  if (doctor_id && Number(doctor_id)) {
    conds.push('c.doctor_id = ?');
    params.push(Number(doctor_id));
  }
  if (estado && ESTADOS_VALIDOS.includes(estado)) {
    conds.push('c.estado = ?');
    params.push(estado);
  }
  if (fecha_inicio && fecha_fin) {
    conds.push('c.fecha BETWEEN ? AND ?');
    params.push(fecha_inicio, fecha_fin);
  } else if (fecha_inicio) {
    conds.push('c.fecha >= ?');
    params.push(fecha_inicio);
  } else if (fecha_fin) {
    conds.push('c.fecha <= ?');
    params.push(fecha_fin);
  } else if (!codigo && !q && !doctor_id && !estado) {
    // Sin ningún filtro → por defecto las citas de hoy
    conds.push('c.fecha = ?');
    params.push(new Date().toLocaleDateString('en-CA'));
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM   CITA     c
       JOIN   PACIENTE pat ON c.paciente_id = pat.paciente_id
       ${where}`,
      params
    );

    // Total global (para distinguir "sistema vacío" de "sin coincidencias")
    const [[{ total_global }]] = await pool.query(
      'SELECT COUNT(*) AS total_global FROM CITA'
    );

    const [rows] = await pool.query(
      `SELECT
         c.cita_id, c.codigo_cita, c.fecha,
         TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
         TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
         c.estado, c.precio_aplicado,
         CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
         pat.tipo_documento, pat.numero_documento,
         pat.telefono AS paciente_telefono, pat.email AS paciente_email,
         CONCAT(u.nombre,' ',u.apellido)     AS doctor_nombre,
         d.especialidad,
         s.nombre AS servicio_nombre, s.duracion
       FROM   CITA     c
       JOIN   PACIENTE pat ON c.paciente_id = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id = s.servicio_id
       JOIN   USUARIO  u   ON c.doctor_id   = u.usuario_id
       LEFT JOIN DOCTOR d  ON d.doctor_id   = u.usuario_id
       ${where}
       ORDER  BY c.fecha ASC, c.hora_inicio ASC
       LIMIT  ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Auditoría de la consulta
    await logAudit({
      usuario_id: req.user?.id,
      accion:     'CONSULTAR_CITAS',
      entidad:    'CITA',
      detalles:   JSON.stringify({ codigo, q, doctor_id, estado, fecha_inicio, fecha_fin, page: Number(page) }),
      ip_origen:  req.ip,
    });

    return res.json({
      data:         rows,
      total:        Number(total),
      total_global: Number(total_global),
      page:         Number(page),
      pages:        Math.ceil(Number(total) / limit),
    });
  } catch (err) {
    console.error('[appointment.list]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/appointments/:id
// Detalle completo de una cita: datos de la cita, paciente, servicio,
// doctor, estado del pago y (si fue atendida) existencia de la atención
// clínica — SIN exponer la información clínica detallada.
// ─────────────────────────────────────────────────────────────────
const getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de cita inválido' });

  try {
    const [[cita]] = await pool.query(
      `SELECT
         c.cita_id, c.codigo_cita, c.fecha,
         TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
         TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
         c.estado, c.precio_aplicado, c.creado_por, c.fecha_creacion,
         CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
         pat.tipo_documento, pat.numero_documento,
         pat.telefono AS paciente_telefono, pat.email AS paciente_email,
         CONCAT(u.nombre,' ',u.apellido)  AS doctor_nombre, d.especialidad,
         s.nombre AS servicio_nombre, s.duracion,
         CONCAT(cre.nombre,' ',cre.apellido) AS creado_por_nombre
       FROM   CITA     c
       JOIN   PACIENTE pat ON c.paciente_id = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id = s.servicio_id
       JOIN   USUARIO  u   ON c.doctor_id   = u.usuario_id
       LEFT JOIN DOCTOR  d   ON d.doctor_id  = u.usuario_id
       LEFT JOIN USUARIO cre ON c.usuario_id = cre.usuario_id
       WHERE  c.cita_id = ?`,
      [id]
    );

    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    // Estado del pago (solo visualización)
    const [[pago]] = await pool.query(
      `SELECT estado, fecha_pago, monto_total, metodo_pago
       FROM   PAGO WHERE cita_id = ? ORDER BY pago_id DESC LIMIT 1`,
      [id]
    );

    // Existencia de atención clínica (sin detalle clínico)
    const [[atencion]] = await pool.query(
      `SELECT cc.fecha_atencion,
              CONCAT(du.nombre,' ',du.apellido) AS doctor_nombre
       FROM   CONSULTA_CLINICA cc
       LEFT JOIN USUARIO du ON cc.firmado_por_doctor_id = du.usuario_id
       WHERE  cc.cita_id = ? LIMIT 1`,
      [id]
    );

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'CONSULTAR_DETALLE_CITA',
      entidad:    'CITA',
      entidad_id: id,
      detalles:   `Detalle de cita ${cita.codigo_cita}`,
      ip_origen:  req.ip,
    });

    return res.json({ ...cita, pago: pago ?? null, atencion: atencion ?? null });
  } catch (err) {
    console.error('[appointment.getById]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/appointments/agenda  (rol DOCTOR)
// Agenda del doctor logueado. Solo SUS citas, nunca RESERVADA.
// Vistas: hoy | semana | mes | historico. Filtros: estado, rango de fechas.
// ─────────────────────────────────────────────────────────────────
const ymd = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD (local)

const rangoSemana = () => {
  const now = new Date();
  const day = now.getDay();                 // 0=Dom .. 6=Sab
  const mon = new Date(now); mon.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { ini: ymd(mon), fin: ymd(sun) };
};

const rangoMes = () => {
  const now = new Date();
  return {
    ini: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    fin: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const agenda = async (req, res) => {
  const doctorId = req.user?.id;
  const { vista = 'hoy', estado, fecha_inicio, fecha_fin } = req.query;

  const conds  = ['c.doctor_id = ?', "c.estado <> 'RESERVADA'"];
  const params = [doctorId];

  if (estado && ESTADOS_VALIDOS.includes(estado) && estado !== 'RESERVADA') {
    conds.push('c.estado = ?');
    params.push(estado);
  }

  const hoy = new Date().toLocaleDateString('en-CA');

  // Un rango de fechas personalizado tiene prioridad sobre la vista.
  // Un filtro por estado busca en todas las fechas (ignora la vista),
  // igual que el listado de recepción.
  if (fecha_inicio && fecha_fin) {
    conds.push('c.fecha BETWEEN ? AND ?'); params.push(fecha_inicio, fecha_fin);
  } else if (fecha_inicio) {
    conds.push('c.fecha >= ?'); params.push(fecha_inicio);
  } else if (fecha_fin) {
    conds.push('c.fecha <= ?'); params.push(fecha_fin);
  } else if (estado && ESTADOS_VALIDOS.includes(estado) && estado !== 'RESERVADA') {
    // Sin rango de fechas: el filtro de estado abarca toda la agenda
  } else if (vista === 'semana') {
    const { ini, fin } = rangoSemana(); conds.push('c.fecha BETWEEN ? AND ?'); params.push(ini, fin);
  } else if (vista === 'mes') {
    const { ini, fin } = rangoMes(); conds.push('c.fecha BETWEEN ? AND ?'); params.push(ini, fin);
  } else if (vista === 'historico') {
    conds.push('c.fecha < ?'); params.push(hoy);
  } else { // hoy (por defecto)
    conds.push('c.fecha = ?'); params.push(hoy);
  }

  const where = `WHERE ${conds.join(' AND ')}`;

  try {
    const [rows] = await pool.query(
      `SELECT
         c.cita_id, c.codigo_cita, c.fecha,
         TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
         TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
         c.estado, c.precio_aplicado,
         CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
         pat.tipo_documento, pat.numero_documento,
         s.nombre AS servicio_nombre, s.duracion,
         cc.consulta_id
       FROM   CITA     c
       JOIN   PACIENTE pat ON c.paciente_id = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id = s.servicio_id
       LEFT JOIN CONSULTA_CLINICA cc ON cc.cita_id = c.cita_id
       ${where}
       ORDER  BY c.fecha ASC, c.hora_inicio ASC`,
      params
    );

    await logAudit({
      usuario_id: doctorId,
      accion:     'CONSULTAR_AGENDA',
      entidad:    'CITA',
      detalles:   JSON.stringify({ vista, estado, fecha_inicio, fecha_fin }),
      ip_origen:  req.ip,
    });

    return res.json({ data: rows, vista });
  } catch (err) {
    console.error('[appointment.agenda]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// PUT /api/appointments/:id/no-asistio  (rol DOCTOR)
// Marca una cita CONFIRMADA del propio doctor como NO_ASISTIO.
// El pago se mantiene COMPLETADO (sin reembolso).
// ─────────────────────────────────────────────────────────────────
const marcarNoAsistio = async (req, res) => {
  const id       = Number(req.params.id);
  const doctorId = req.user?.id;
  if (!id) return res.status(400).json({ error: 'ID de cita inválido' });

  try {
    const [[cita]] = await pool.query(
      'SELECT cita_id, doctor_id, estado, codigo_cita FROM CITA WHERE cita_id = ?',
      [id]
    );
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    if (cita.doctor_id !== doctorId)
      return res.status(403).json({ error: 'No puede modificar citas de otro doctor' });
    if (cita.estado !== 'CONFIRMADA')
      return res.status(409).json({ error: 'Solo se pueden marcar como no asistió las citas confirmadas' });

    await pool.query("UPDATE CITA SET estado = 'NO_ASISTIO' WHERE cita_id = ?", [id]);

    await logAudit({
      usuario_id: doctorId,
      accion:     'MARCAR_NO_ASISTIO',
      entidad:    'CITA',
      entidad_id: id,
      detalles:   `Cita ${cita.codigo_cita} marcada como NO_ASISTIO`,
      ip_origen:  req.ip,
    });

    return res.json({ message: 'Cita marcada como no asistió' });
  } catch (err) {
    console.error('[appointment.marcarNoAsistio]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/appointments/:id/cancel  (rol RECEPCIONISTA | ADMINISTRADOR)
// Cancela una cita cuyo estado sea RESERVADA o CONFIRMADA.
//
// Transacción SQL:
//  1. SELECT … FOR UPDATE → obtiene la cita y bloquea la fila.
//  2. Valida que el estado sea RESERVADA o CONFIRMADA; si no → 400.
//  3. UPDATE CITA → estado = 'CANCELADA'.
//     (La tabla PAGO NO se toca: la regla financiera retiene el ingreso.)
//  4. INSERT AUDITORIA → accion = 'CANCELACION_CITA' dentro de la txn.
//  5. COMMIT → libera el slot del doctor para nuevas reservas.
// ─────────────────────────────────────────────────────────────────
const cancel = async (req, res) => {
  const citaId   = Number(req.params.id);
  const usuarioId = req.user?.id ?? null;          // recepcionista del JWT

  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });

  const ESTADOS_CANCELABLES = ['RESERVADA', 'CONFIRMADA'];

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    // ── 1. Leer y bloquear la fila ──────────────────────────────────
    const [[cita]] = await conn.query(
      `SELECT cita_id, paciente_id, doctor_id, codigo_cita, estado
       FROM   CITA
       WHERE  cita_id = ?
       FOR UPDATE`,
      [citaId]
    );

    if (!cita) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    // ── 2. Validar estado cancelable ────────────────────────────────
    if (!ESTADOS_CANCELABLES.includes(cita.estado)) {
      await conn.query('ROLLBACK');
      return res.status(400).json({
        error: `No se puede cancelar una cita en estado '${cita.estado}'. ` +
               `Solo se permiten cancelar citas en estado: ${ESTADOS_CANCELABLES.join(', ')}.`,
      });
    }

    // ── 3. Cancelar la cita ─────────────────────────────────────────
    // Se marca como CANCELADA. No se modifica PAGO (retención financiera).
    await conn.query(
      `UPDATE CITA
       SET    estado = 'CANCELADA'
       WHERE  cita_id = ?`,
      [citaId]
    );

    // ── 4. Registrar auditoría dentro de la misma transacción ───────
    await conn.query(
      `INSERT INTO AUDITORIA
         (usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen)
       VALUES (?, ?, 'CANCELACION_CITA', 'CITA', ?, ?, ?)`,
      [
        usuarioId,
        cita.paciente_id,
        citaId,
        JSON.stringify({
          codigo_cita:    cita.codigo_cita,
          estado_previo:  cita.estado,
          cancelado_por:  usuarioId,
        }),
        req.ip ?? null,
      ]
    );

    // ── 5. Confirmar transacción ─────────────────────────────────────
    await conn.query('COMMIT');

    return res.status(200).json({
      message:     'Cita cancelada exitosamente',
      cita_id:     citaId,
      codigo_cita: cita.codigo_cita,
      estado:      'CANCELADA',
    });

  } catch (err) {
    if (conn) {
      try { await conn.query('ROLLBACK'); } catch (_) {}
    }
    console.error('[appointment.cancel]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { getSlots, create, list, getById, agenda, marcarNoAsistio, cancel };
