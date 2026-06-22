const pool         = require('../config/db');
const { logAudit } = require('../utils/audit.util');

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// GET /api/schedules?doctor_id=X
const getByDoctor = async (req, res) => {
  const doctorId = Number(req.query.doctor_id);
  if (!doctorId || !Number.isInteger(doctorId))
    return res.status(400).json({ error: 'doctor_id inválido' });

  try {
    const [rows] = await pool.query(
      `SELECT horario_id, doctor_id, dia_semana,
              TIME_FORMAT(hora_inicio, '%H:%i') AS hora_inicio,
              TIME_FORMAT(hora_fin,    '%H:%i') AS hora_fin,
              estado
       FROM   HORARIO
       WHERE  doctor_id = ?
       ORDER  BY FIELD(dia_semana,'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'),
                 hora_inicio`,
      [doctorId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[schedule.getByDoctor]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/schedules
const create = async (req, res) => {
  const { doctor_id, dia_semana, hora_inicio, hora_fin } = req.body;

  const doctorIdNum = Number(doctor_id);
  if (!doctorIdNum || !Number.isInteger(doctorIdNum))
    return res.status(400).json({ error: 'doctor_id inválido' });

  if (!DIAS.includes(dia_semana))
    return res.status(400).json({ error: 'Día de la semana no válido' });

  if (!isValidTime(hora_inicio) || !isValidTime(hora_fin))
    return res.status(400).json({ error: 'Formato de hora inválido (HH:MM)' });

  if (hora_inicio >= hora_fin)
    return res.status(400).json({ error: 'La hora de fin debe ser mayor a la hora de inicio' });

  try {
    // Validar superposición
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM HORARIO
       WHERE  doctor_id = ? AND dia_semana = ?
         AND  hora_inicio < ? AND hora_fin > ?`,
      [doctorIdNum, dia_semana, hora_fin, hora_inicio]
    );
    if (cnt > 0)
      return res.status(409).json({ error: 'El horario ingresado se superpone con un bloque existente.' });

    const [result] = await pool.query(
      `INSERT INTO HORARIO (doctor_id, dia_semana, hora_inicio, hora_fin)
       VALUES (?, ?, ?, ?)`,
      [doctorIdNum, dia_semana, hora_inicio, hora_fin]
    );

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'REGISTRO_HORARIO',
      entidad:    'HORARIO',
      entidad_id: result.insertId,
      detalles:   JSON.stringify({ doctor_id: doctorIdNum, dia_semana, hora_inicio, hora_fin }),
      ip_origen:  req.ip,
    });

    return res.status(201).json({
      message:    'Horario registrado correctamente',
      horario_id: result.insertId,
    });
  } catch (err) {
    console.error('[schedule.create]', err);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Ya existe un horario con ese día y hora de inicio para este doctor' });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/schedules/:id
const update = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de horario inválido' });

  const { dia_semana, hora_inicio, hora_fin, estado } = req.body;

  if (!DIAS.includes(dia_semana))
    return res.status(400).json({ error: 'Día de la semana no válido' });

  if (!isValidTime(hora_inicio) || !isValidTime(hora_fin))
    return res.status(400).json({ error: 'Formato de hora inválido (HH:MM)' });

  if (hora_inicio >= hora_fin)
    return res.status(400).json({ error: 'La hora de fin debe ser mayor a la hora de inicio' });

  if (estado && !['ACTIVO', 'INACTIVO'].includes(estado))
    return res.status(400).json({ error: 'Estado no válido' });

  try {
    const [[horario]] = await pool.query(
      'SELECT * FROM HORARIO WHERE horario_id = ?', [id]
    );
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

    // Verificar citas existentes en el bloque actual
    const [[{ cnt: citasCnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM CITA
       WHERE  doctor_id = ?
         AND  fecha >= CURDATE()
         AND  estado IN ('RESERVADA', 'CONFIRMADA')
         AND  DAYOFWEEK(fecha) = FIELD(?, 'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO') + 1
         AND  hora_inicio < ? AND hora_fin > ?`,
      [horario.doctor_id, horario.dia_semana, horario.hora_fin, horario.hora_inicio]
    );
    if (citasCnt > 0)
      return res.status(409).json({
        error: 'No se puede modificar el horario porque existen citas registradas en este bloque.',
      });

    // Validar superposición con otros horarios (excluyendo este mismo)
    const [[{ cnt: overlapCnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM HORARIO
       WHERE  doctor_id = ? AND dia_semana = ? AND horario_id != ?
         AND  hora_inicio < ? AND hora_fin > ?`,
      [horario.doctor_id, dia_semana, id, hora_fin, hora_inicio]
    );
    if (overlapCnt > 0)
      return res.status(409).json({ error: 'El horario ingresado se superpone con un bloque existente.' });

    await pool.query(
      `UPDATE HORARIO
       SET    dia_semana=?, hora_inicio=?, hora_fin=?, estado=?
       WHERE  horario_id=?`,
      [dia_semana, hora_inicio, hora_fin, estado ?? horario.estado, id]
    );

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'ACTUALIZAR_HORARIO',
      entidad:    'HORARIO',
      entidad_id: id,
      detalles:   JSON.stringify({ dia_semana, hora_inicio, hora_fin, estado }),
      ip_origen:  req.ip,
    });

    return res.json({ message: 'Horario actualizado correctamente' });
  } catch (err) {
    console.error('[schedule.update]', err);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Ya existe un horario con ese día y hora de inicio para este doctor' });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/schedules/:id
const remove = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de horario inválido' });

  try {
    const [[horario]] = await pool.query(
      'SELECT * FROM HORARIO WHERE horario_id = ?', [id]
    );
    if (!horario) return res.status(404).json({ error: 'Horario no encontrado' });

    // Verificar citas futuras
    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM CITA
       WHERE  doctor_id = ?
         AND  fecha >= CURDATE()
         AND  estado IN ('RESERVADA', 'CONFIRMADA')
         AND  DAYOFWEEK(fecha) = FIELD(?, 'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO') + 1
         AND  hora_inicio < ? AND hora_fin > ?`,
      [horario.doctor_id, horario.dia_semana, horario.hora_fin, horario.hora_inicio]
    );
    if (cnt > 0)
      return res.status(409).json({
        error: 'No se puede eliminar el horario porque existen citas programadas.',
      });

    await pool.query('DELETE FROM HORARIO WHERE horario_id = ?', [id]);

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'ELIMINAR_HORARIO',
      entidad:    'HORARIO',
      entidad_id: id,
      detalles:   JSON.stringify({
        doctor_id:   horario.doctor_id,
        dia_semana:  horario.dia_semana,
        hora_inicio: horario.hora_inicio,
        hora_fin:    horario.hora_fin,
      }),
      ip_origen: req.ip,
    });

    return res.json({ message: 'Horario eliminado correctamente' });
  } catch (err) {
    console.error('[schedule.remove]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getByDoctor, create, update, remove };
