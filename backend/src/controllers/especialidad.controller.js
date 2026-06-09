const pool = require('../config/db');

// GET /api/especialidades — catálogo de especialidades activas (para selectores)
const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT especialidad_id, nombre
       FROM   ESPECIALIDAD
       WHERE  estado = 'ACTIVO'
       ORDER  BY nombre`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[especialidad.getAll]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getAll };
