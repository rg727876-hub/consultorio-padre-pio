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

module.exports = { getSlots, create };
