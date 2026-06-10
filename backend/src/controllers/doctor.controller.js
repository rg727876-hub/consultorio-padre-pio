const crypto = require('crypto');
const pool = require('../config/db');
const { logAudit } = require('../utils/audit.util');
const { sendActivationEmail } = require('../utils/mailer.util');

const isBadFieldError = (err) => {
  return err && (err.code === 'ER_BAD_FIELD_ERROR' || /Unknown column 'd\.(especialidad|nroColegiatura)'/.test(err.message));
};

// GET /api/doctors — doctores activos (para selector)
const getActive = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.usuario_id AS doctor_id,
              u.nombre, u.apellido, u.DNI,
              d.especialidad, d.nroColegiatura
       FROM   USUARIO u
       JOIN   ROL_USUARIO ru ON ru.usuario_id = u.usuario_id
       JOIN   ROL r          ON r.rol_id = ru.rol_id
       JOIN   DOCTOR d        ON d.doctor_id = u.usuario_id
       WHERE  r.nombre_rol = 'DOCTOR'
         AND  u.estado = 'ACTIVO'
       ORDER  BY u.apellido, u.nombre`
    );
    return res.json(rows);
  } catch (err) {
    if (isBadFieldError(err)) {
      try {
        const [rows] = await pool.query(
          `SELECT u.usuario_id AS doctor_id,
                  u.nombre, u.apellido, u.DNI,
                  NULL AS especialidad,
                  NULL AS nroColegiatura
           FROM   USUARIO u
           JOIN   ROL_USUARIO ru ON ru.usuario_id = u.usuario_id
           JOIN   ROL r          ON r.rol_id = ru.rol_id
           WHERE  r.nombre_rol = 'DOCTOR'
             AND  u.estado = 'ACTIVO'
           ORDER  BY u.apellido, u.nombre`
        );
        return res.json(rows);
      } catch (fallbackErr) {
        console.error('[doctor.getActive] fallback error]', fallbackErr);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
    console.error('[doctor.getActive]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/doctors/by-service/:servicio_id
const getByService = async (req, res) => {
  const servicioId = Number(req.params.servicio_id);
  if (!servicioId || !Number.isInteger(servicioId))
    return res.status(400).json({ error: 'servicio_id inválido' });

  try {
    const [rows] = await pool.query(
      `SELECT u.usuario_id AS doctor_id,
              u.nombre, u.apellido,
              d.especialidad
       FROM   USUARIO u
       JOIN   DOCTOR d           ON d.doctor_id    = u.usuario_id
       JOIN   SERVICIO_DOCTOR sd ON sd.doctor_id   = u.usuario_id
       WHERE  sd.servicio_id = ? AND sd.estado = 'ACTIVO'
         AND  u.estado = 'ACTIVO'
       ORDER  BY u.apellido, u.nombre`,
      [servicioId]
    );
    return res.json(rows);
  } catch (err) {
    if (isBadFieldError(err)) {
      try {
        const [rows] = await pool.query(
          `SELECT u.usuario_id AS doctor_id,
                  u.nombre, u.apellido,
                  NULL AS especialidad
           FROM   USUARIO u
           JOIN   DOCTOR d           ON d.doctor_id    = u.usuario_id
           JOIN   SERVICIO_DOCTOR sd ON sd.doctor_id   = u.usuario_id
           WHERE  sd.servicio_id = ? AND sd.estado = 'ACTIVO'
             AND  u.estado = 'ACTIVO'
           ORDER  BY u.apellido, u.nombre`,
          [servicioId]
        );
        return res.json(rows);
      } catch (fallbackErr) {
        console.error('[doctor.getByService] fallback error]', fallbackErr);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
    console.error('[doctor.getByService]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/doctors/:id/profile
const getDoctorProfile = async (req, res) => {
  const doctorId = Number(req.params.id);
  if (!doctorId) return res.status(400).json({ error: 'ID de doctor inválido' });

  let conn;
  try {
    conn = await pool.getConnection();
    
    // 1. Datos básicos
    let users;
    try {
      [users] = await conn.query(`
        SELECT 
          u.usuario_id, u.nombre, u.apellido, u.email, u.DNI, u.telefono, u.direccion,
          u.estado, u.fecha_registro,
          d.especialidad, d.nroColegiatura
        FROM USUARIO u
        JOIN DOCTOR d ON u.usuario_id = d.doctor_id
        WHERE u.usuario_id = ?
      `, [doctorId]);
    } catch (err) {
      if (isBadFieldError(err)) {
        const [fallbackUsers] = await conn.query(`
          SELECT 
            u.usuario_id, u.nombre, u.apellido, u.email, u.DNI, u.telefono, u.direccion,
            u.estado, u.fecha_registro,
            NULL AS especialidad, NULL AS nroColegiatura
          FROM USUARIO u
          JOIN DOCTOR d ON u.usuario_id = d.doctor_id
          WHERE u.usuario_id = ?
        `, [doctorId]);
        users = fallbackUsers;
      } else {
        throw err;
      }
    }

    if (!users.length) return res.status(404).json({ error: 'Doctor no encontrado' });
    const doctor = users[0];

    // 2. Servicios
    const [servicios] = await conn.query(`
      SELECT s.servicio_id, s.nombre_servicio 
      FROM SERVICIO s
      JOIN SERVICIO_DOCTOR sd ON s.servicio_id = sd.servicio_id
      WHERE sd.doctor_id = ? AND sd.estado = 'ACTIVO'
    `, [doctorId]);
    doctor.servicios = servicios;

    // 3. Horarios
    const [horarios] = await conn.query(`
      SELECT dia_semana, hora_inicio, hora_fin 
      FROM HORARIO 
      WHERE doctor_id = ? AND estado = 'ACTIVO'
      ORDER BY dia_semana, hora_inicio
    `, [doctorId]);
    doctor.horarios = horarios;

    // 4. Citas Futuras
    const [citas] = await conn.query(`
      SELECT COUNT(*) as cantidad 
      FROM CITA 
      WHERE doctor_id = ? AND estado IN ('RESERVADA', 'CONFIRMADA') AND fecha >= CURDATE()
    `, [doctorId]);
    doctor.citasFuturas = citas[0].cantidad;

    // 5. Auditoría
    const [audit] = await conn.query(`
      SELECT accion, detalles, fecha_evento, 
        (SELECT CONCAT(nombre, ' ', apellido) FROM USUARIO actor WHERE actor.usuario_id = a.usuario_id) as autor
      FROM AUDITORIA a
      WHERE entidad = 'USUARIO' AND entidad_id = ?
      ORDER BY fecha_evento DESC
      LIMIT 20
    `, [doctorId]);
    doctor.auditoria = audit;

    return res.json(doctor);
  } catch (err) {
    console.error('[doctor.getDoctorProfile]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/doctors/:id
const updateDoctorProfile = async (req, res) => {
  const doctorId = Number(req.params.id);
  const { nombre, apellido, email, telefono, direccion, especialidad, nroColegiatura, serviciosIds } = req.body;
  let conn;

  try {
    conn = await pool.getConnection();

    // Validar usuario
    const [users] = await conn.query('SELECT estado, email FROM USUARIO WHERE usuario_id = ?', [doctorId]);
    if (!users.length) return res.status(404).json({ error: 'Doctor no encontrado' });
    const user = users[0];

    // CA6: Validar email único
    const [existingEmail] = await conn.query('SELECT usuario_id FROM USUARIO WHERE email = ? AND usuario_id != ?', [email, doctorId]);
    if (existingEmail.length) return res.status(400).json({ error: 'El correo ya está en uso' });

    // CA6: Validar C.O.P. único
    const [existingCop] = await conn.query('SELECT doctor_id FROM DOCTOR WHERE nroColegiatura = ? AND doctor_id != ?', [nroColegiatura, doctorId]);
    if (existingCop.length) return res.status(400).json({ error: 'El Número de Colegiatura ya está registrado en otro doctor' });

    await conn.query('START TRANSACTION');

    // CA7: Si es Pendiente y cambió el correo, reemitir invitación
    if (user.estado === 'PENDIENTE' && user.email !== email) {
      await conn.query('UPDATE TOKEN_ACTIVACION SET usado = TRUE, fecha_usado = NOW() WHERE usuario_id = ? AND usado = FALSE', [doctorId]);
      const token = crypto.randomBytes(32).toString('hex');
      const horas = Number(process.env.ACTIVATION_TOKEN_HOURS) || 24;
      const expiry = new Date(Date.now() + horas * 3600000);
      await conn.query('INSERT INTO TOKEN_ACTIVACION (usuario_id, token, fecha_expira) VALUES (?, ?, ?)', [doctorId, token, expiry]);
      sendActivationEmail(email.trim().toLowerCase(), String(nombre).trim(), token)
        .catch((e) => console.error('[mailer] Error CA7:', e.message));
    }

    // Actualizar USUARIO
    await conn.query(
      'UPDATE USUARIO SET nombre=?, apellido=?, email=?, telefono=?, direccion=? WHERE usuario_id=?',
      [nombre.trim(), apellido.trim(), email.trim().toLowerCase(), telefono, direccion, doctorId]
    );

    // Actualizar DOCTOR
    await conn.query(
      'UPDATE DOCTOR SET especialidad=?, nroColegiatura=? WHERE doctor_id=?',
      [especialidad, nroColegiatura, doctorId]
    );

    // Actualizar SERVICIOS
    // CA6: Se asume que serviciosIds viene como array y tiene al menos 1 por la validación del front
    if (Array.isArray(serviciosIds) && serviciosIds.length > 0) {
      await conn.query('DELETE FROM SERVICIO_DOCTOR WHERE doctor_id = ?', [doctorId]);
      const values = serviciosIds.map(id => [doctorId, id]);
      await conn.query('INSERT INTO SERVICIO_DOCTOR (doctor_id, servicio_id) VALUES ?', [values]);
    }

    await conn.query('COMMIT');

    // CA15: Auditoria
    await logAudit({
      usuario_id: req.user?.id,
      accion: 'EDICION_PERFIL_USUARIO',
      entidad: 'USUARIO',
      entidad_id: doctorId,
      detalles: 'Se actualizó la información personal y/o profesional del doctor.'
    });

    return res.status(200).json({ message: 'Datos actualizados correctamente.' });
  } catch (err) {
    if (conn) try { await conn.query('ROLLBACK'); } catch (_) {}
    console.error('[doctor.updateDoctorProfile]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/doctors/:id/status
const updateDoctorStatus = async (req, res) => {
  const doctorId = Number(req.params.id);
  const { estado } = req.body;
  let conn;

  try {
    conn = await pool.getConnection();

    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    await conn.query('START TRANSACTION');

    await conn.query('UPDATE USUARIO SET estado = ? WHERE usuario_id = ?', [estado, doctorId]);

    let citasCanceladas = 0;
    // CA11: Cancelar citas futuras
    if (estado === 'INACTIVO') {
      const [result] = await conn.query(`
        UPDATE CITA 
        SET estado = 'CANCELADA' 
        WHERE doctor_id = ? AND estado IN ('RESERVADA', 'CONFIRMADA') AND fecha >= CURDATE()
      `, [doctorId]);
      citasCanceladas = result.affectedRows;
    }

    await conn.query('COMMIT');

    // CA15: Auditoria
    await logAudit({
      usuario_id: req.user?.id,
      accion: estado === 'INACTIVO' ? 'DESACTIVACION_USUARIO' : 'REACTIVACION_USUARIO',
      entidad: 'USUARIO',
      entidad_id: doctorId,
      detalles: estado === 'INACTIVO' ? `Doctor desactivado. Citas futuras canceladas: ${citasCanceladas}` : 'Doctor reactivado.'
    });

    return res.status(200).json({ message: estado === 'INACTIVO' ? 'Doctor desactivado.' : 'Doctor reactivado.' });
  } catch (err) {
    if (conn) try { await conn.query('ROLLBACK'); } catch (_) {}
    console.error('[doctor.updateDoctorStatus]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { getActive, getByService, getDoctorProfile, updateDoctorProfile, updateDoctorStatus };
