const pool = require('../config/db');

// GET /api/doctors — doctores activos (para selector)
const getActive = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.usuario_id AS doctor_id,
              u.nombre, u.apellido, u.DNI,
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                 FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
                WHERE de.doctor_id = d.doctor_id) AS especialidad,
              d.nroColegiatura
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
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                 FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
                WHERE de.doctor_id = d.doctor_id) AS especialidad
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
    console.error('[doctor.getByService]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getActive, getByService };
