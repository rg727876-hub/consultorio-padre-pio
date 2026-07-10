const pool         = require('../config/db');
const { create }   = require('../models/patient.model');
const { logAudit } = require('../utils/audit.util');

const isDev = process.env.NODE_ENV !== 'production';

// ── Constantes ───────────────────────────────────────────────────
const TIPOS_DOCUMENTO = ['DNI', 'CE', 'PASAPORTE'];
const SEXOS_VALIDOS   = ['FEMENINO', 'MASCULINO'];
const RE_TELEFONO     = /^\d{9}$/;
const RE_EMAIL        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helpers ──────────────────────────────────────────────────────
const calcEdad = (fechaNac) => {
  if (!fechaNac) return null;
  const hoy = new Date();
  const dob  = new Date(fechaNac + 'T00:00:00');
  let edad = hoy.getFullYear() - dob.getFullYear();
  const m = hoy.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < dob.getDate())) edad--;
  return edad;
};

// ─────────────────────────────────────────────────────────────────
// POST /api/patients   — Registrar nuevo paciente
// Roles: RECEPCIONISTA, ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  const {
    nombre, apellido, tipo_documento, numero_documento,
    telefono, sexo,
    email, fecha_nacimiento, direccion, ocupacion, contacto_emergencia,
  } = req.body;

  if (!nombre?.trim() || !apellido?.trim() || !tipo_documento ||
      !numero_documento?.trim() || !telefono || !sexo)
    return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });

  if (!TIPOS_DOCUMENTO.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  if (tipo_documento === 'DNI' && !/^\d{8}$/.test(String(numero_documento).trim()))
    return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos' });

  const telefonoLimpio = String(telefono).replace(/\D/g, '');
  if (!RE_TELEFONO.test(telefonoLimpio))
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 9 dígitos' });

  if (!SEXOS_VALIDOS.includes(sexo))
    return res.status(400).json({ error: 'Sexo no válido' });

  if (email && !RE_EMAIL.test(String(email).trim()))
    return res.status(400).json({ error: 'El correo electrónico no es válido' });

  if (contacto_emergencia && !RE_TELEFONO.test(String(contacto_emergencia).trim()))
    return res.status(400).json({ error: 'El contacto de emergencia debe tener exactamente 9 dígitos' });

  if (fecha_nacimiento) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dob = new Date(fecha_nacimiento + 'T00:00:00');
    if (dob >= hoy)
      return res.status(400).json({ error: 'La fecha de nacimiento debe ser anterior al día de hoy' });
  }

  try {
    const paciente_id = await create({
      nombre:              String(nombre).trim(),
      apellido:            String(apellido).trim(),
      tipo_documento,
      numero_documento:    String(numero_documento).trim(),
      telefono:            telefonoLimpio,
      sexo,
      email:               email ? String(email).trim().toLowerCase() : null,
      fecha_nacimiento:    fecha_nacimiento || null,
      direccion:           direccion           ? String(direccion).trim()           : null,
      ocupacion:           ocupacion           ? String(ocupacion).trim()           : null,
      contacto_emergencia: contacto_emergencia ? String(contacto_emergencia).trim() : null,
    });

    await logAudit({
      usuario_id: req.user?.id,
      paciente_id,
      accion:     'REGISTRO_PACIENTE',
      entidad:    'PACIENTE',
      entidad_id: paciente_id,
      detalles:   JSON.stringify({ nombre, apellido, tipo_documento, numero_documento }),
      ip_origen:  req.ip,
    });

    return res.status(201).json({ message: 'Paciente registrado correctamente', paciente_id });

  } catch (err) {
    console.error('[patient.register]', err.message);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: `Ya existe un paciente registrado con ese ${tipo_documento}` });
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/patients/search?q=xxx
// Búsqueda rápida para selects/autocompletes (solo activos, máx 10)
// Roles: RECEPCIONISTA, ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const search = async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2)
    return res.status(400).json({ error: 'Ingresa al menos 2 caracteres para buscar' });

  try {
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT paciente_id, nombre, apellido,
              tipo_documento, numero_documento,
              telefono, sexo, fecha_nacimiento, foto
       FROM   PACIENTE
       WHERE  estado = 'ACTIVO'
         AND  (numero_documento LIKE ? OR nombre LIKE ? OR apellido LIKE ? OR CONCAT(nombre, ' ', apellido) LIKE ?)
       ORDER BY apellido, nombre
       LIMIT  15`,
      [like, like, like, like]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[patient.search]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/patients
// Lista paginada con búsqueda y filtro de estado (HU-011 — Listar)
//
// Query params:
//   q       {string}  búsqueda parcial por DNI, nombre o apellido
//   estado  {string}  'ACTIVO' | 'INACTIVO' | 'TODOS' (default: ACTIVO)
//   page    {number}  página (1-indexed, default: 1)
//
// Ordenamiento:
//   - ACTIVO/INACTIVO → alfabético por apellido, nombre
//   - TODOS           → primero ACTIVOS luego INACTIVOS, dentro de cada grupo
//                       alfabético por apellido, nombre
//
// Roles: RECEPCIONISTA, ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const list = async (req, res) => {
  const q      = String(req.query.q ?? '').trim();
  const estado = (req.query.estado ?? 'ACTIVO').toUpperCase();
  const page   = Math.max(1, Number(req.query.page) || 1);
  const limit  = 20;
  const offset = (page - 1) * limit;

  const ESTADOS_VALIDOS = ['ACTIVO', 'INACTIVO', 'TODOS'];
  if (!ESTADOS_VALIDOS.includes(estado))
    return res.status(400).json({ error: "El filtro estado debe ser 'ACTIVO', 'INACTIVO' o 'TODOS'" });

  const conds  = [];
  const params = [];

  // Filtro de estado
  if (estado !== 'TODOS') {
    conds.push('estado = ?');
    params.push(estado);
  }

  // Búsqueda parcial
  if (q.length >= 2) {
    const like = `%${q}%`;
    conds.push('(numero_documento LIKE ? OR nombre LIKE ? OR apellido LIKE ? OR CONCAT(nombre, \' \', apellido) LIKE ?)');
    params.push(like, like, like, like);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  // Orden: TODOS → activos primero; dentro de grupo → a-z apellido, nombre
  const orderBy = estado === 'TODOS'
    ? `FIELD(estado,'ACTIVO','INACTIVO'), apellido, nombre`
    : `apellido, nombre`;

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM PACIENTE ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT paciente_id, nombre, apellido,
              tipo_documento, numero_documento,
              telefono, sexo, estado, foto,
              DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
              fecha_registro
       FROM   PACIENTE
       ${where}
       ORDER  BY ${orderBy}
       LIMIT  ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Calcular edad en JS para evitar SQL específico de MySQL
    const data = rows.map(p => ({ ...p, edad: calcEdad(p.fecha_nacimiento) }));

    return res.json({
      data,
      total:  Number(total),
      page,
      pages:  Math.ceil(Number(total) / limit),
    });

  } catch (err) {
    console.error('[patient.list]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/patients/:id
// Perfil completo del paciente + historial de citas.
// NO incluye información clínica (diagnósticos, tratamientos, etc.)
// Roles: RECEPCIONISTA, ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    // ── Perfil del paciente ──────────────────────────────────────
    const [[paciente]] = await pool.query(
      `SELECT paciente_id, nombre, apellido,
              tipo_documento, numero_documento,
              telefono, sexo, estado, foto,
              DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
              email, direccion, ocupacion, contacto_emergencia,
              fecha_registro
       FROM   PACIENTE
       WHERE  paciente_id = ?`,
      [id]
    );
    if (!paciente)
      return res.status(404).json({ error: 'Paciente no encontrado' });

    // ── Historial de citas (sin datos clínicos) ──────────────────
    // Incluye citas pasadas y futuras, de la más reciente a la más antigua.
    // Deliberadamente NO hace JOIN con CONSULTA_CLINICA para evitar
    // exponer diagnósticos, tratamientos o notas clínicas.
    const [citas] = await pool.query(
      `SELECT
         c.cita_id, c.codigo_cita, c.fecha,
         TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
         TIME_FORMAT(c.hora_fin,    '%H:%i') AS hora_fin,
         c.estado, c.precio_aplicado,
         s.nombre AS servicio_nombre, s.duracion,
         CONCAT(u.nombre,' ',u.apellido) AS doctor_nombre,
         (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
            FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
           WHERE de.doctor_id = d.doctor_id) AS especialidad
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       JOIN   USUARIO  u ON u.usuario_id  = c.doctor_id
       LEFT JOIN DOCTOR d ON d.doctor_id  = c.doctor_id
       WHERE  c.paciente_id = ?
       ORDER  BY c.fecha DESC, c.hora_inicio DESC`,
      [id]
    );

    return res.json({
      ...paciente,
      edad:  calcEdad(paciente.fecha_nacimiento),
      citas,
    });

  } catch (err) {
    console.error('[patient.getById]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────
// PUT /api/patients/:id   — Editar datos personales
//
// Campos editables: nombre, apellido, sexo, fecha_nacimiento,
//                   telefono, email, direccion, ocupacion,
//                   contacto_emergencia
//
// Campos BLOQUEADOS (identidad): tipo_documento, numero_documento
//
// Roles: RECEPCIONISTA, ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const update = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  const {
    nombre, apellido, sexo, fecha_nacimiento,
    telefono, email, direccion, ocupacion, contacto_emergencia,
  } = req.body;

  // Actualización PARCIAL: solo se validan/actualizan los campos enviados.
  // (El modal de "datos de contacto" no envía nombre/apellido — y no debe.)
  const has = (v) => v !== undefined;

  // ── Validaciones (solo de los campos presentes) ──────────────────
  if (has(nombre) && !String(nombre).trim())
    return res.status(400).json({ error: 'El nombre no puede estar vacío' });
  if (has(apellido) && !String(apellido).trim())
    return res.status(400).json({ error: 'El apellido no puede estar vacío' });

  if (has(telefono) && !RE_TELEFONO.test(String(telefono).replace(/\D/g, '')))
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 9 dígitos' });

  if (has(sexo) && sexo && !SEXOS_VALIDOS.includes(sexo))
    return res.status(400).json({ error: 'Sexo no válido' });

  if (has(email) && email && !RE_EMAIL.test(String(email).trim()))
    return res.status(400).json({ error: 'El correo electrónico no es válido' });

  if (has(contacto_emergencia) && contacto_emergencia &&
      !RE_TELEFONO.test(String(contacto_emergencia).replace(/\D/g, '')))
    return res.status(400).json({ error: 'El contacto de emergencia debe tener exactamente 9 dígitos' });

  if (has(fecha_nacimiento) && fecha_nacimiento) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dob = new Date(fecha_nacimiento + 'T00:00:00');
    if (dob >= hoy)
      return res.status(400).json({ error: 'La fecha de nacimiento debe ser anterior al día de hoy' });
  }

  // ── Construir SET dinámico con los campos presentes ──────────────
  const sets = [];
  const params = [];
  const push = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

  if (has(nombre))           push('nombre',   String(nombre).trim());
  if (has(apellido))         push('apellido', String(apellido).trim());
  if (has(sexo))             push('sexo', sexo || null);
  if (has(fecha_nacimiento)) push('fecha_nacimiento', fecha_nacimiento || null);
  if (has(telefono))         push('telefono', String(telefono).replace(/\D/g, ''));
  if (has(email))            push('email', email ? String(email).trim().toLowerCase() : null);
  if (has(direccion))        push('direccion', direccion ? String(direccion).trim() : null);
  if (has(ocupacion))        push('ocupacion', ocupacion ? String(ocupacion).trim() : null);
  if (has(contacto_emergencia))
    push('contacto_emergencia', contacto_emergencia ? String(contacto_emergencia).trim() : null);

  if (!sets.length)
    return res.status(400).json({ error: 'No se enviaron campos para actualizar' });

  try {
    // Verificar que el paciente existe
    const [[existente]] = await pool.query(
      'SELECT paciente_id FROM PACIENTE WHERE paciente_id = ?',
      [id]
    );
    if (!existente)
      return res.status(404).json({ error: 'Paciente no encontrado' });

    await pool.query(
      `UPDATE PACIENTE SET ${sets.join(', ')} WHERE paciente_id = ?`,
      [...params, id]
    );

    await logAudit({
      usuario_id:  req.user?.id,
      paciente_id: id,
      accion:      'EDICION_PACIENTE',
      entidad:     'PACIENTE',
      entidad_id:  id,
      detalles:    JSON.stringify({ nombre, apellido, sexo, telefono }),
      ip_origen:   req.ip,
    });

    return res.json({ message: 'Datos del paciente actualizados correctamente' });

  } catch (err) {
    console.error('[patient.update]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/patients/:id/deactivate   — Desactivar paciente
//
// Regla de negocio (HU-011):
//   1. Verifica que el paciente existe y está ACTIVO.
//   2. Dentro de UNA sola transacción SQL:
//      a. Cancela todas sus citas futuras con estado RESERVADA o CONFIRMADA.
//      b. Marca al paciente como INACTIVO.
//   3. Responde con cuántas citas fueron canceladas.
//
// Roles: ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const deactivate = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    // ── 1. Leer y bloquear la fila del paciente ──────────────────
    const [[paciente]] = await conn.query(
      `SELECT paciente_id, nombre, apellido, estado
       FROM   PACIENTE
       WHERE  paciente_id = ?
       FOR UPDATE`,
      [id]
    );

    if (!paciente) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    if (paciente.estado === 'INACTIVO') {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: 'El paciente ya está inactivo' });
    }

    // ── 2a. Cancelar citas futuras (RESERVADA | CONFIRMADA) ──────
    const hoy = new Date().toLocaleDateString('en-CA');
    const [cancelResult] = await conn.query(
      `UPDATE CITA
       SET    estado = 'CANCELADA'
       WHERE  paciente_id = ?
         AND  fecha >= ?
         AND  UPPER(estado) IN ('RESERVADA', 'CONFIRMADA')`,
      [id, hoy]
    );
    const citasCanceladas = cancelResult.affectedRows;

    // ── 2b. Desactivar el paciente ───────────────────────────────
    await conn.query(
      `UPDATE PACIENTE SET estado = 'INACTIVO' WHERE paciente_id = ?`,
      [id]
    );

    await conn.query('COMMIT');

    // ── 3. Auditoría ─────────────────────────────────────────────
    await logAudit({
      usuario_id:  req.user?.id,
      paciente_id: id,
      accion:      'DESACTIVACION_PACIENTE',
      entidad:     'PACIENTE',
      entidad_id:  id,
      detalles:    JSON.stringify({
        paciente:        `${paciente.nombre} ${paciente.apellido}`,
        citas_canceladas: citasCanceladas,
      }),
      ip_origen:   req.ip,
    });

    return res.json({
      message:          'Paciente desactivado correctamente',
      citas_canceladas: citasCanceladas,
    });

  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[patient.deactivate]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  } finally {
    if (conn) conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/patients/:id/reactivate   — Reactivar paciente
// Roles: ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const reactivate = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    const [[paciente]] = await pool.query(
      'SELECT paciente_id, nombre, apellido, estado FROM PACIENTE WHERE paciente_id = ?',
      [id]
    );
    if (!paciente)
      return res.status(404).json({ error: 'Paciente no encontrado' });
    if (paciente.estado === 'ACTIVO')
      return res.status(409).json({ error: 'El paciente ya está activo' });

    await pool.query(
      `UPDATE PACIENTE SET estado = 'ACTIVO' WHERE paciente_id = ?`,
      [id]
    );

    await logAudit({
      usuario_id:  req.user?.id,
      paciente_id: id,
      accion:      'REACTIVACION_PACIENTE',
      entidad:     'PACIENTE',
      entidad_id:  id,
      detalles:    JSON.stringify({ paciente: `${paciente.nombre} ${paciente.apellido}` }),
      ip_origen:   req.ip,
    });

    return res.json({ message: 'Paciente reactivado correctamente' });

  } catch (err) {
    console.error('[patient.reactivate]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/patients/:id/foto   — Subir o actualizar foto del paciente
// Roles: RECEPCIONISTA, ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const uploadPhoto = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id)) return res.status(400).json({ error: 'ID de paciente inválido' });

  if (!req.file) {
    return res.status(400).json({ error: 'No se ha subido ningún archivo válido' });
  }

  try {
    const [[patient]] = await pool.query('SELECT paciente_id FROM PACIENTE WHERE paciente_id = ?', [id]);
    if (!patient) {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const photoUrl = req.file.path.startsWith('http') ? req.file.path : `/uploads/patients/${req.file.filename}`;
    await pool.query('UPDATE PACIENTE SET foto = ? WHERE paciente_id = ?', [photoUrl, id]);

    await logAudit({
      usuario_id: req.user?.id, accion: 'ACTUALIZAR_FOTO_PACIENTE', entidad: 'PACIENTE',
      entidad_id: id, detalles: `Foto de perfil actualizada`, ip_origen: req.ip,
    });

    return res.json({ message: 'Foto de paciente actualizada correctamente', foto: photoUrl });
  } catch (err) {
    console.error('[patient.uploadPhoto]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register, search, list, getById, update, deactivate, reactivate, uploadPhoto };
