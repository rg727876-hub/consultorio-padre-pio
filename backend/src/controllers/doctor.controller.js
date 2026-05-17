const pool = require('../config/db');

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
    console.error('[doctor.getActive]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getActive };
