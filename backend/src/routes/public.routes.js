const { Router } = require('express');
const pool       = require('../config/db');

const router = Router();

// GET /api/public/servicios — servicios activos (sin auth, para landing page)
router.get('/servicios', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT servicio_id, nombre, descripcion, duracion, costo
       FROM   SERVICIO
       WHERE  estado = 'ACTIVO'
       ORDER  BY nombre`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[public.servicios]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/public/doctores — doctores activos (sin auth, para landing page)
router.get('/doctores', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.usuario_id AS doctor_id,
              u.nombre, u.apellido,
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                 FROM DOCTOR_ESPECIALIDAD de
                 JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
                WHERE de.doctor_id = d.doctor_id) AS especialidad
       FROM   USUARIO u
       JOIN   ROL_USUARIO ru ON ru.usuario_id = u.usuario_id
       JOIN   ROL r          ON r.rol_id = ru.rol_id
       JOIN   DOCTOR d       ON d.doctor_id = u.usuario_id
       WHERE  r.nombre_rol = 'DOCTOR'
         AND  u.estado = 'ACTIVO'
       ORDER  BY u.apellido, u.nombre`
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
