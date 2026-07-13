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

// Límite de reserva: solo se permite agendar hasta un mes en el futuro.
// Evita "datos fantasma" y desorden cuando los horarios aún pueden cambiar.
const maxFechaReserva = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString('en-CA');
};

// GET /api/appointments/slots?doctor_id=X&servicio_id=Y&fecha=YYYY-MM-DD
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
  if (fecha > maxFechaReserva())
    return res.status(400).json({ error: 'Solo se pueden agendar citas hasta un mes de anticipación' });

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

    // Duración y buffer del servicio NUEVO que se quiere reservar
    const [[servicioNuevo]] = await pool.query(
      `SELECT duracion, buffer FROM SERVICIO
       WHERE  servicio_id = ? AND estado = 'ACTIVO'`,
      [servicioId]
    );
    if (!servicioNuevo) return res.status(404).json({ error: 'Servicio no encontrado' });

    // Citas existentes ese día CON el buffer de su propio servicio
    const [booked] = await pool.query(
      `SELECT 
        TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
        TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
        s.buffer AS service_buffer
       FROM   CITA c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       WHERE  c.doctor_id = ? AND c.fecha = ?
         AND  UPPER(c.estado) IN ('RESERVADA','CONFIRMADA')
       ORDER BY c.hora_inicio`,
      [doctorId, fecha]
    );

    // Paso de avance: 5 minutos para flexibilidad
    const STEP = 5;
    const slots = [];

    // Hora actual en minutos (para excluir slots ya pasados si es hoy)
    let ahoraMins = -1;
    if (fecha === hoy) {
      const ahora = new Date();
      ahoraMins = ahora.getHours() * 60 + ahora.getMinutes();
    }

    for (const h of horarios) {
      let cur = timeToMins(h.hora_inicio);
      const end = timeToMins(h.hora_fin);
      
      while (cur + servicioNuevo.duracion <= end) {
        const slotInicio = cur;
        const slotFin = cur + servicioNuevo.duracion;
        const slotFinConBuffer = slotFin + servicioNuevo.buffer;
        
        // Excluir slots ya pasados (si es hoy)
        if (ahoraMins >= 0 && slotInicio < ahoraMins) {
          cur += STEP;
          continue;
        }
        
        // Verifica solapamiento con citas reservadas (considerando ambos buffers)
        const overlaps = booked.some(b => {
          const bookedInicio = timeToMins(b.hi);
          const bookedFin = timeToMins(b.hf);
          const bookedFinConBuffer = bookedFin + b.service_buffer;
          
          // El slot propuesto (con su buffer al final) NO debe solaparse 
          // con la cita reservada (con su buffer al final)
          return (slotInicio < bookedFinConBuffer && slotFinConBuffer > bookedInicio);
        });
        
        if (!overlaps) {
          slots.push({ 
            hora_inicio: minsToTime(slotInicio), 
            hora_fin: minsToTime(slotFin) 
          });
        }
        
        cur += STEP;
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
  if (fecha > maxFechaReserva())
    return res.status(400).json({ error: 'Solo se pueden agendar citas hasta un mes de anticipación' });

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

    // Verificar solapamiento con citas existentes, RESPETANDO el buffer de cada una.
    // Cada cita reserva [inicio, fin + buffer). La nueva cita también reserva su
    // buffer, así que dos reservas chocan si sus rangos (con buffer) se cruzan.
    const [existentes] = await conn.query(
      `SELECT TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
              TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
              s.buffer AS buffer,
              c.doctor_id,
              c.paciente_id
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       WHERE  (c.doctor_id = ? OR c.paciente_id = ?) AND c.fecha = ?
         AND  c.estado IN ('RESERVADA','CONFIRMADA')`,
      [Number(doctor_id), Number(paciente_id), fecha]
    );
    const nIni    = timeToMins(hora_inicio);
    const nFinBuf = timeToMins(hora_fin) + servicio.buffer;
    const conflicto = existentes.find(
      b => nIni < (timeToMins(b.hf) + (b.buffer || 0)) && nFinBuf > timeToMins(b.hi)
    );
    if (conflicto) {
      await conn.query('ROLLBACK');
      if (conflicto.paciente_id === Number(paciente_id)) {
        return res.status(409).json({
          error: 'El paciente ya tiene otra cita agendada que se cruza con este horario. Elige otro.',
        });
      } else {
        return res.status(409).json({
          error: 'Ese horario se cruza con otra cita del doctor o con su tiempo de limpieza (buffer). Elige otro.',
        });
      }
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
  if (estado) {
    const estadosArray = Array.isArray(estado) ? estado : estado.split(',');
    const validEstados = estadosArray.filter(e => ESTADOS_VALIDOS.includes(e));
    if (validEstados.length > 0) {
      conds.push(`c.estado IN (${validEstados.map(() => '?').join(',')})`);
      params.push(...validEstados);
    }
  }
  // Cuando no hay NINGÚN filtro, el listado por defecto muestra todas las
  // citas CONFIRMADAS (de todas las fechas), con las de hoy primero y
  // descendiendo hacia las pasadas (las futuras, si existen, van al final).
  let ordenPorDefecto = false;

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
    // Sin ningún filtro → por defecto todas las citas confirmadas
    conds.push("c.estado = 'CONFIRMADA'");
    ordenPorDefecto = true;
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  // Orden: por defecto, hoy primero → pasado (futuras al final);
  // con filtros, orden cronológico ascendente como siempre.
  const orderBy = ordenPorDefecto
    ? 'ORDER BY (c.fecha > ?) ASC, c.fecha DESC, c.hora_inicio ASC'
    : 'ORDER BY c.fecha ASC, c.hora_inicio ASC';
  const orderParams = ordenPorDefecto ? [new Date().toLocaleDateString('en-CA')] : [];

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
         (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ') FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id WHERE de.doctor_id = d.doctor_id) AS especialidad,
         s.nombre AS servicio_nombre, s.duracion
       FROM   CITA     c
       JOIN   PACIENTE pat ON c.paciente_id = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id = s.servicio_id
       JOIN   USUARIO  u   ON c.doctor_id   = u.usuario_id
       LEFT JOIN DOCTOR d  ON d.doctor_id   = u.usuario_id
       ${where}
       ${orderBy}
       LIMIT  ? OFFSET ?`,
      [...params, ...orderParams, limit, offset]
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
         c.cita_id, c.codigo_cita, c.fecha, c.doctor_id,
         TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
         TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
         c.estado, c.precio_aplicado, c.creado_por, c.fecha_creacion,
         CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
         pat.tipo_documento, pat.numero_documento,
         pat.telefono AS paciente_telefono, pat.email AS paciente_email,
         CONCAT(u.nombre,' ',u.apellido)  AS doctor_nombre, (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ') FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id WHERE de.doctor_id = d.doctor_id) AS especialidad,
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

  const conds  = ['c.doctor_id = ?', "c.estado NOT IN ('RESERVADA', 'EXPIRADA')"];
  const params = [doctorId];

  if (estado) {
    const estadosArray = Array.isArray(estado) ? estado : estado.split(',');
    const validEstados = estadosArray.filter(e => ESTADOS_VALIDOS.includes(e) && !['RESERVADA', 'EXPIRADA'].includes(e));
    if (validEstados.length > 0) {
      conds.push(`c.estado IN (${validEstados.map(() => '?').join(',')})`);
      params.push(...validEstados);
    }
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

// =================================================================
// PIO-30: Reprogramación de Citas
// =================================================================

// ── Mapa de bloqueos temporales (en memoria, por proceso) ───────────
// Clave  : `${doctorId}:${fecha}:${horaInicio}` (identifica el slot)
// Valor  : { citaId, expiresAt, timer }
//
// Los bloqueos expiran automáticamente a los 10 minutos.
// Nota: este mecanismo in-memory es adecuado para un servidor
// de instancia única. Para multi-instancia se debería usar Redis.
const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutos
const locks = new Map();

const lockKey = (doctorId, fecha, horaInicio) =>
  `${doctorId}:${fecha}:${horaInicio}`;

// ─────────────────────────────────────────────────────────────────
// POST /api/appointments/:id/lock
//
// Bloquea un slot de horario durante LOCK_TTL_MS (10 min) para que
// ningún otro usuario pueda reprogramar otra cita a ese mismo
// doctor/fecha/hora mientras el primero llena el formulario.
//
// Body:  { nueva_fecha, nueva_hora_inicio }
// 200  : { message, expires_at }   → slot reservado
// 409  : slot ya bloqueado por otro
// ─────────────────────────────────────────────────────────────────
const lockSlot = async (req, res) => {
  const citaId = Number(req.params.id);
  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });

  const { nueva_fecha, nueva_hora_inicio } = req.body;
  if (!nueva_fecha || !nueva_hora_inicio)
    return res.status(400).json({ error: 'nueva_fecha y nueva_hora_inicio son requeridos' });

  try {
    // Obtener el doctor de la cita
    const [[cita]] = await pool.query(
      'SELECT cita_id, doctor_id, estado FROM CITA WHERE cita_id = ?',
      [citaId]
    );
    if (!cita)
      return res.status(404).json({ error: 'Cita no encontrada' });
    if (!['RESERVADA', 'CONFIRMADA'].includes(cita.estado))
      return res.status(409).json({
        error: `Solo se pueden reprogramar citas en estado RESERVADA o CONFIRMADA (estado actual: ${cita.estado})`,
      });

    const key        = lockKey(cita.doctor_id, nueva_fecha, nueva_hora_inicio);
    const ahora      = Date.now();
    const existente  = locks.get(key);

    // Rechazar si ya está bloqueado por OTRA cita y el lock no expiró
    if (existente && existente.expiresAt > ahora && existente.citaId !== citaId) {
      return res.status(409).json({
        error: 'Horario no disponible: otro usuario ya está reservando este slot.',
      });
    }

    // Limpiar timer anterior si existía (mismo citaId o expirado)
    if (existente?.timer) clearTimeout(existente.timer);

    const expiresAt = ahora + LOCK_TTL_MS;

    // Timer de auto-expiración
    const timer = setTimeout(() => locks.delete(key), LOCK_TTL_MS);
    // Permitir que el proceso de Node.js termine sin esperar este timer
    if (timer.unref) timer.unref();

    locks.set(key, { citaId, expiresAt, timer });

    return res.json({
      message:    'Slot bloqueado correctamente',
      expires_at: new Date(expiresAt).toISOString(),
      ttl_secs:   LOCK_TTL_MS / 1000,
    });

  } catch (err) {
    console.error('[appointment.lockSlot]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/appointments/:id/unlock
//
// Libera el bloqueo manualmente (usuario cancela la reprogramación).
// Body:  { nueva_fecha, nueva_hora_inicio }  (el mismo slot que se bloqueó)
// 200  : { message }
// ─────────────────────────────────────────────────────────────────
const unlockSlot = async (req, res) => {
  const citaId = Number(req.params.id);
  const { nueva_fecha, nueva_hora_inicio } = req.body;

  if (!citaId || !nueva_fecha || !nueva_hora_inicio)
    return res.status(400).json({ error: 'citaId, nueva_fecha y nueva_hora_inicio son requeridos' });

  try {
    const [[cita]] = await pool.query(
      'SELECT doctor_id FROM CITA WHERE cita_id = ?', [citaId]
    );
    if (!cita)
      return res.status(404).json({ error: 'Cita no encontrada' });

    const key      = lockKey(cita.doctor_id, nueva_fecha, nueva_hora_inicio);
    const existente = locks.get(key);

    if (existente && existente.citaId === citaId) {
      if (existente.timer) clearTimeout(existente.timer);
      locks.delete(key);
    }
    // Si no existía o pertenecía a otro, se ignora silenciosamente

    return res.json({ message: 'Bloqueo liberado' });

  } catch (err) {
    console.error('[appointment.unlockSlot]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/appointments/:id/reschedule  (PIO-30)
//
// Reprograma la cita: solo modifica fecha, hora_inicio y hora_fin.
// NO toca doctor_id, servicio_id, codigo_cita, precio, estado ni pagos.
//
// Body  : { nueva_fecha, nueva_hora_inicio, nueva_hora_fin }
// 200   : { message, cita_id, codigo_cita, ... }
// 409   : solapamiento con otra cita
// 409   : lock perdido / expirado
// ─────────────────────────────────────────────────────────────────
const reschedule = async (req, res) => {
  const citaId = Number(req.params.id);
  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });

  const { nueva_fecha, nueva_hora_inicio, nueva_hora_fin } = req.body;

  if (!nueva_fecha || !nueva_hora_inicio || !nueva_hora_fin)
    return res.status(400).json({
      error: 'nueva_fecha, nueva_hora_inicio y nueva_hora_fin son requeridos',
    });

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nueva_fecha) || isNaN(Date.parse(nueva_fecha)))
    return res.status(400).json({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });

  // Límite de reserva: hasta un mes de anticipación (igual que al agendar).
  if (nueva_fecha > maxFechaReserva())
    return res.status(400).json({ error: 'Solo se pueden reprogramar citas hasta un mes de anticipación' });

  // Validar que hora_inicio < hora_fin
  if (nueva_hora_inicio >= nueva_hora_fin)
    return res.status(400).json({ error: 'La hora de inicio debe ser anterior a la hora de fin' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    // ── 1. Leer y bloquear la cita original ──────────────────────────────
    const [[cita]] = await conn.query(
      `SELECT cita_id, codigo_cita, doctor_id, servicio_id, estado,
              DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
              TIME_FORMAT(hora_fin,    '%H:%i') AS hora_fin
       FROM   CITA
       WHERE  cita_id = ?
       FOR UPDATE`,
      [citaId]
    );

    if (!cita) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (!['RESERVADA', 'CONFIRMADA'].includes(cita.estado)) {
      await conn.query('ROLLBACK');
      return res.status(409).json({
        error: `Solo se pueden reprogramar citas en estado RESERVADA o CONFIRMADA (estado actual: ${cita.estado})`,
      });
    }

    // ── 2. Verificar que el lock pertenece a esta cita o está libre ─────
    const key      = lockKey(cita.doctor_id, nueva_fecha, nueva_hora_inicio);
    const lockData = locks.get(key);

    if (lockData && lockData.expiresAt > Date.now() && lockData.citaId !== citaId) {
      await conn.query('ROLLBACK');
      return res.status(409).json({
        error: 'Horario no disponible: otro usuario está reservando este slot.',
      });
    }

    // ── 3. Verificar solapamiento con OTRAS citas, RESPETANDO buffers ──
    const [[svcReprog]] = await conn.query(
      'SELECT buffer FROM SERVICIO WHERE servicio_id = ?', [cita.servicio_id]
    );
    const bufReprog = svcReprog?.buffer || 0;

    const [otras] = await conn.query(
      `SELECT TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
              TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
              s.buffer AS buffer
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       WHERE  c.doctor_id = ? AND c.fecha = ? AND c.cita_id <> ?
         AND  UPPER(c.estado) IN ('RESERVADA','CONFIRMADA')`,
      [cita.doctor_id, nueva_fecha, citaId]
    );
    const rIni    = timeToMins(nueva_hora_inicio);
    const rFinBuf = timeToMins(nueva_hora_fin) + bufReprog;
    const solapa = otras.some(
      b => rIni < (timeToMins(b.hf) + (b.buffer || 0)) && rFinBuf > timeToMins(b.hi)
    );

    if (solapa) {
      await conn.query('ROLLBACK');
      return res.status(409).json({
        error: 'El horario solicitado se cruza con otra cita o su tiempo de limpieza (buffer).',
      });
    }

    // ── 4. Actualizar SOLO fecha/hora (sin tocar estado, doc, servicio, precio, código) ─
    await conn.query(
      `UPDATE CITA
       SET fecha       = ?,
           hora_inicio = ?,
           hora_fin    = ?
       WHERE cita_id   = ?`,
      [nueva_fecha, nueva_hora_inicio, nueva_hora_fin, citaId]
    );

    await conn.query('COMMIT');

    // ── 5. Liberar el lock ──────────────────────────────────────────────
    const lockEntry = locks.get(key);
    if (lockEntry?.citaId === citaId) {
      if (lockEntry.timer) clearTimeout(lockEntry.timer);
      locks.delete(key);
    }

    // ── 6. Auditoría ───────────────────────────────────────────────────────
    await logAudit({
      usuario_id: req.user?.id,
      accion:     'REPROGRAMACION_CITA',
      entidad:    'CITA',
      entidad_id: citaId,
      detalles:   JSON.stringify({
        codigo_cita:        cita.codigo_cita,
        fecha_anterior:     cita.fecha,
        hora_inicio_antes:  cita.hora_inicio,
        hora_fin_antes:     cita.hora_fin,
        nueva_fecha,
        nueva_hora_inicio,
        nueva_hora_fin,
      }),
      ip_origen: req.ip,
    });

    return res.json({
      message:          'Cita reprogramada correctamente',
      cita_id:          citaId,
      codigo_cita:      cita.codigo_cita,
      fecha_anterior:   `${cita.fecha} ${cita.hora_inicio}`,
      nueva_fecha_hora: `${nueva_fecha} ${nueva_hora_inicio}`,
    });

  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[appointment.reschedule]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  getSlots, create, list, getById, agenda, marcarNoAsistio, cancel,
  lockSlot, unlockSlot, reschedule,
};
