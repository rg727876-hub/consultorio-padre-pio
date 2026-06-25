const pool         = require('../config/db');
const { logAudit } = require('../utils/audit.util');

const isDev = process.env.NODE_ENV !== 'production';

// GET /api/services  — servicios activos (para selector de doctor)
const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT servicio_id, nombre, descripcion, duracion, costo, buffer, imagen, estado
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

// POST /api/services  — solo ADMINISTRADOR
const create = async (req, res) => {
  const {
    nombre, descripcion, duracion,
    costo, buffer = 0, imagen, estado = 'ACTIVO',
  } = req.body;

  // ── Validaciones ─────────────────────────────────────────────
  if (!nombre || !String(nombre).trim())
    return res.status(400).json({ error: 'El nombre del servicio es requerido' });

  if (String(nombre).trim().length > 50)
    return res.status(400).json({ error: 'El nombre no puede superar 50 caracteres' });

  const duracionNum = Number(duracion);
  if (!duracion || isNaN(duracionNum) || duracionNum <= 0 || !Number.isInteger(duracionNum))
    return res.status(400).json({ error: 'La duración debe ser un número entero mayor a 0' });

  const costoNum = Number(costo);
  if (!costo || isNaN(costoNum) || costoNum <= 0)
    return res.status(400).json({ error: 'El precio debe ser un número mayor a 0' });

  const bufferNum = Number(buffer);
  if (isNaN(bufferNum) || bufferNum < 0 || !Number.isInteger(bufferNum))
    return res.status(400).json({ error: 'El tiempo de espera debe ser un número entero mayor o igual a 0' });

  if (!['ACTIVO', 'INACTIVO'].includes(estado))
    return res.status(400).json({ error: 'Estado no válido' });

  try {
    const [result] = await pool.query(
      `INSERT INTO SERVICIO (nombre, descripcion, duracion, costo, buffer, imagen, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        String(nombre).trim(),
        descripcion ? String(descripcion).trim() : null,
        duracionNum,
        costoNum,
        bufferNum,
        imagen ? String(imagen).trim() : null,
        estado,
      ]
    );

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'REGISTRO_SERVICIO',
      entidad:    'SERVICIO',
      entidad_id: result.insertId,
      detalles:   JSON.stringify({ nombre, duracion: duracionNum, costo: costoNum }),
      ip_origen:  req.ip,
    });

    return res.status(201).json({
      message:     'Servicio registrado correctamente',
      servicio_id: result.insertId,
    });

  } catch (err) {
    console.error('[service.create]', err.message);

    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El nombre del servicio ya se encuentra registrado.' });

    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED')
      return res.status(400).json({ error: 'La duración debe ser mayor a 0 y el tiempo de espera mayor o igual a 0' });

    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// GET /api/services/all  — todos los servicios (admin)
const getAdmin = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT servicio_id, nombre, descripcion, duracion, costo, buffer, imagen, estado
       FROM   SERVICIO
       ORDER BY nombre`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[service.getAdmin]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/services/:id  — actualizar servicio (admin)
const update = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de servicio inválido' });

  const {
    nombre, descripcion, duracion,
    costo, buffer, imagen, estado,
  } = req.body;

  // ── Validaciones ─────────────────────────────────────────────
  if (!nombre || !String(nombre).trim())
    return res.status(400).json({ error: 'El nombre del servicio es requerido' });

  if (String(nombre).trim().length > 50)
    return res.status(400).json({ error: 'El nombre no puede superar 50 caracteres' });

  const duracionNum = Number(duracion);
  if (!duracion || isNaN(duracionNum) || duracionNum <= 0 || !Number.isInteger(duracionNum))
    return res.status(400).json({ error: 'La duración debe ser un número entero mayor a 0' });

  const costoNum = Number(costo);
  if (!costo || isNaN(costoNum) || costoNum <= 0)
    return res.status(400).json({ error: 'El precio debe ser un número mayor a 0' });

  const bufferNum = Number(buffer ?? 0);
  if (isNaN(bufferNum) || bufferNum < 0 || !Number.isInteger(bufferNum))
    return res.status(400).json({ error: 'El tiempo de espera debe ser un número entero mayor o igual a 0' });

  if (!['ACTIVO', 'INACTIVO'].includes(estado))
    return res.status(400).json({ error: 'Estado no válido' });

  try {
    const [result] = await pool.query(
      `UPDATE SERVICIO
       SET nombre=?, descripcion=?, duracion=?, costo=?, buffer=?, imagen=?, estado=?
       WHERE servicio_id=?`,
      [
        String(nombre).trim(),
        descripcion ? String(descripcion).trim() : null,
        duracionNum,
        costoNum,
        bufferNum,
        imagen ? String(imagen).trim() : null,
        estado,
        id,
      ]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Servicio no encontrado' });

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'ACTUALIZAR_SERVICIO',
      entidad:    'SERVICIO',
      entidad_id: id,
      detalles:   JSON.stringify({ nombre, duracion: duracionNum, costo: costoNum, estado }),
      ip_origen:  req.ip,
    });

    return res.json({ message: 'Servicio actualizado correctamente' });

  } catch (err) {
    console.error('[service.update]', err.message);

    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El nombre del servicio ya se encuentra registrado.' });

    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

module.exports = { getAll, getAdmin, create, update };
