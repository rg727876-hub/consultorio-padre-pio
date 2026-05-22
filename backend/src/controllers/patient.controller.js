const pool              = require('../config/db');
const { create }        = require('../models/patient.model');
const { logAudit }      = require('../utils/audit.util');

const isDev = process.env.NODE_ENV !== 'production';

// POST /api/patients  — RECEPCIONISTA o ADMINISTRADOR
const register = async (req, res) => {
  const {
    nombre, apellido, tipo_documento, numero_documento,
    telefono, sexo,
    email, fecha_nacimiento, direccion, ocupacion, contacto_emergencia,
  } = req.body;

  // ── Validaciones obligatorias ────────────────────────────────
  if (!nombre?.trim() || !apellido?.trim() || !tipo_documento ||
      !numero_documento?.trim() || !telefono || !sexo)
    return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });

  const tiposValidos = ['DNI', 'CE', 'PASAPORTE'];
  if (!tiposValidos.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  if (tipo_documento === 'DNI' && !/^\d{8}$/.test(String(numero_documento).trim()))
    return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos' });

  const telefonoLimpio = String(telefono).replace(/\D/g, '');
  if (!/^\d{9}$/.test(telefonoLimpio))
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 9 dígitos' });

  if (!['FEMENINO', 'MASCULINO'].includes(sexo))
    return res.status(400).json({ error: 'Sexo no válido' });

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()))
    return res.status(400).json({ error: 'El correo electrónico no es válido' });

  if (contacto_emergencia && !/^\d{9}$/.test(String(contacto_emergencia).trim()))
    return res.status(400).json({ error: 'El contacto de emergencia debe tener exactamente 9 dígitos' });

  if (fecha_nacimiento) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dob = new Date(fecha_nacimiento + 'T00:00:00');
    if (dob >= hoy)
      return res.status(400).json({ error: 'La fecha de nacimiento debe ser anterior al día de hoy' });
  }

  // ── Insertar ─────────────────────────────────────────────────
  try {
    const paciente_id = await create({
      nombre:               String(nombre).trim(),
      apellido:             String(apellido).trim(),
      tipo_documento,
      numero_documento:     String(numero_documento).trim(),
      telefono:             telefonoLimpio,
      sexo,
      email:                email ? String(email).trim().toLowerCase() : null,
      fecha_nacimiento:     fecha_nacimiento || null,
      direccion:            direccion  ? String(direccion).trim()  : null,
      ocupacion:            ocupacion  ? String(ocupacion).trim()  : null,
      contacto_emergencia:  contacto_emergencia ? String(contacto_emergencia).trim() : null,
    });

    await logAudit({
      usuario_id:  req.user?.id,
      paciente_id,
      accion:      'REGISTRO_PACIENTE',
      entidad:     'PACIENTE',
      entidad_id:  paciente_id,
      detalles:    JSON.stringify({ nombre, apellido, tipo_documento, numero_documento }),
      ip_origen:   req.ip,
    });

    return res.status(201).json({
      message:     'Paciente registrado correctamente',
      paciente_id,
    });

  } catch (err) {
    console.error('[patient.register] Error:', err.message);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: `Ya existe un paciente registrado con ese ${tipo_documento}`,
      });
    }

    return res.status(500).json({
      error:  'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// GET /api/patients/search?q=xxx
const search = async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2)
    return res.status(400).json({ error: 'Ingresa al menos 2 caracteres para buscar' });

  try {
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT paciente_id, nombre, apellido,
              tipo_documento, numero_documento,
              telefono, sexo, fecha_nacimiento
       FROM   PACIENTE
       WHERE  estado = 'ACTIVO'
         AND  (numero_documento LIKE ? OR nombre LIKE ? OR apellido LIKE ?)
       ORDER  BY apellido, nombre
       LIMIT  10`,
      [like, like, like]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[patient.search]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register, search };
