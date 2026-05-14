const pool = require('../config/db');

// GET /api/services  — devuelve servicios activos (usado en el form de doctor)
const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT servicio_id, nombre, duracion, costo
       FROM   SERVICIO
       WHERE  estado = 'ACTIVO'
       ORDER BY nombre`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[service.getAll]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getAll };
