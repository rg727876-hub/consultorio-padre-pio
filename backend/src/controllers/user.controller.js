const crypto                  = require('crypto');
const pool                    = require('../config/db');
const { logAudit }            = require('../utils/audit.util');
const { sendActivationEmail } = require('../utils/mailer.util');

const isDev = process.env.NODE_ENV !== 'production';

const register = async (req, res) => {
  const {
    nombre, apellido, DNI, email, telefono, direccion,
    rol, especialidades = [], nroColegiatura, servicios = [],
  } = req.body;

  // ── Validaciones básicas ──────────────────────────────────────
  if (!nombre || !apellido || !DNI || !email || !telefono || !rol)
    return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });

  if (!/^\d{8}$/.test(String(DNI).trim()))
    return res.status(400).json({ error: 'El DNI debe tener exactamente 8 dígitos' });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'El correo electrónico no es válido' });

  const telefonoLimpio = String(telefono).replace(/\D/g, '');
  if (!/^\d{9}$/.test(telefonoLimpio))
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 9 dígitos' });

  const rolesValidos = ['ADMINISTRADOR', 'RECEPCIONISTA', 'CAJERO', 'DOCTOR'];
  if (!rolesValidos.includes(rol))
    return res.status(400).json({ error: 'Rol no válido' });

  if (rol === 'DOCTOR') {
    // La especialidad es OPCIONAL (un recién egresado puede no tenerla).
    if (!nroColegiatura || !String(nroColegiatura).trim())
      return res.status(400).json({ error: 'El número de colegiatura es requerido para doctores' });
  }

  // ── Obtener conexión ──────────────────────────────────────────
  let conn;
  try {
    conn = await pool.getConnection();
  } catch (dbErr) {
    console.error('[user.register] No se pudo obtener conexión:', dbErr.message);
    return res.status(500).json({
      error: 'No se pudo conectar a la base de datos',
      ...(isDev && { detail: dbErr.message }),
    });
  }

  try {
    await conn.query('START TRANSACTION');

    // 1. Insertar USUARIO
    const [userResult] = await conn.query(
      `INSERT INTO USUARIO (nombre, apellido, DNI, email, telefono, direccion, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
      [
        String(nombre).trim(),
        String(apellido).trim(),
        String(DNI).trim(),
        String(email).trim().toLowerCase(),
        telefonoLimpio,
        direccion ? String(direccion).trim() : null,
      ]
    );
    const usuario_id = userResult.insertId;

    // 2. Buscar rol_id
    const [roles] = await conn.query(
      'SELECT rol_id FROM ROL WHERE nombre_rol = ?',
      [rol]
    );
    if (!roles.length) {
      throw new Error(`Rol "${rol}" no existe en la tabla ROL. Verifica que el seed fue ejecutado.`);
    }

    // 3. Asignar ROL_USUARIO
    await conn.query(
      'INSERT INTO ROL_USUARIO (rol_id, usuario_id) VALUES (?, ?)',
      [roles[0].rol_id, usuario_id]
    );

    // 4. Si es Doctor
    if (rol === 'DOCTOR') {
      await conn.query(
        'INSERT INTO DOCTOR (doctor_id, nroColegiatura) VALUES (?, ?)',
        [usuario_id, Number(nroColegiatura)]
      );

      // Especialidades (N:N) — se ignoran ids duplicados/ inválidos
      const espIds = [...new Set(especialidades.map(Number).filter(Boolean))];
      for (const especialidad_id of espIds) {
        await conn.query(
          'INSERT INTO DOCTOR_ESPECIALIDAD (doctor_id, especialidad_id) VALUES (?, ?)',
          [usuario_id, especialidad_id]
        );
      }

      for (const servicio_id of servicios) {
        await conn.query(
          'INSERT INTO SERVICIO_DOCTOR (doctor_id, servicio_id) VALUES (?, ?)',
          [usuario_id, servicio_id]
        );
      }
    }

    // 5. Token de activación
    const token  = crypto.randomBytes(32).toString('hex');
    const horas  = Number(process.env.ACTIVATION_TOKEN_HOURS) || 24;
    const expiry = new Date(Date.now() + horas * 3600000);

    await conn.query(
      'INSERT INTO TOKEN_ACTIVACION (usuario_id, token, fecha_expira) VALUES (?, ?, ?)',
      [usuario_id, token, expiry]
    );

    await conn.query('COMMIT');

    // 6. Email (no bloquea si falla)
    sendActivationEmail(String(email).trim().toLowerCase(), String(nombre).trim(), token)
      .catch((e) => console.error('[mailer] Error de activación:', e.message));

    // 7. Auditoría
    await logAudit({
      usuario_id: req.user?.id,
      accion:     'REGISTRO_USUARIO',
      entidad:    'USUARIO',
      entidad_id: usuario_id,
      detalles:   JSON.stringify({ nombre, apellido, email, rol }),
      ip_origen:  req.ip,
    });

    return res.status(201).json({
      message:    `Usuario registrado. Se envió un correo de activación a ${email}`,
      usuario_id,
    });

  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (_) { /* ignorar */ }

    console.error('[user.register] Error:', err.message);

    if (err.code === 'ER_DUP_ENTRY') {
      const campo = err.message.toLowerCase().includes('email') ? 'correo electrónico' : 'DNI';
      return res.status(409).json({ error: `El ${campo} ya está registrado en el sistema` });
    }

    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });

  } finally {
    if (conn) conn.release();
  }
};

// Subquery reutilizable: rol y especialidades del usuario
const SUB_ROL =
  `(SELECT r.nombre_rol FROM ROL_USUARIO ru JOIN ROL r ON r.rol_id = ru.rol_id
     WHERE ru.usuario_id = u.usuario_id LIMIT 1)`;
const SUB_ESP =
  `(SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
      FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
     WHERE de.doctor_id = u.usuario_id)`;

const ROLES_VALIDOS  = ['ADMINISTRADOR', 'RECEPCIONISTA', 'CAJERO', 'DOCTOR', 'PERSONAL'];
const ESTADOS_VALIDOS = ['ACTIVO', 'INACTIVO', 'PENDIENTE', 'TODOS'];

// ─────────────────────────────────────────────────────────────────
// GET /api/users  — Listar/buscar personal (paginado) — solo ADMINISTRADOR
// Query: q, rol, estado (ACTIVO|INACTIVO|PENDIENTE|TODOS), page
// Orden: TODOS → Activos, Pendientes, Inactivos; dentro a-z apellido,nombre
// ─────────────────────────────────────────────────────────────────
const list = async (req, res) => {
  const q      = String(req.query.q ?? '').trim();
  const rol    = String(req.query.rol ?? '').toUpperCase();
  const estado = (req.query.estado ?? 'ACTIVO').toUpperCase();
  const page   = Math.max(1, Number(req.query.page) || 1);
  const limit  = 20;
  const offset = (page - 1) * limit;

  if (!ESTADOS_VALIDOS.includes(estado))
    return res.status(400).json({ error: "Estado debe ser ACTIVO, INACTIVO, PENDIENTE o TODOS" });

  const conds  = [];
  const params = [];

  if (estado !== 'TODOS') { conds.push('u.estado = ?'); params.push(estado); }

  if (q.length >= 2) {
    const like = `%${q}%`;
    conds.push('(u.DNI LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)');
    params.push(like, like, like);
  }

  if (rol && ROLES_VALIDOS.includes(rol)) {
    if (rol === 'PERSONAL') {
      conds.push(`NOT EXISTS (SELECT 1 FROM ROL_USUARIO ru JOIN ROL r ON r.rol_id = ru.rol_id
                             WHERE ru.usuario_id = u.usuario_id AND r.nombre_rol = 'DOCTOR')`);
    } else {
      conds.push(`EXISTS (SELECT 1 FROM ROL_USUARIO ru JOIN ROL r ON r.rol_id = ru.rol_id
                           WHERE ru.usuario_id = u.usuario_id AND r.nombre_rol = ?)`);
      params.push(rol);
    }
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const orderBy = estado === 'TODOS'
    ? `FIELD(u.estado,'ACTIVO','PENDIENTE','INACTIVO'), u.apellido, u.nombre`
    : `u.apellido, u.nombre`;

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM USUARIO u ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT u.usuario_id, u.DNI, u.nombre, u.apellido, u.email, u.estado,
              ${SUB_ROL} AS rol,
              ${SUB_ESP} AS especialidad
       FROM   USUARIO u
       ${where}
       ORDER  BY ${orderBy}
       LIMIT  ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      data:  rows,
      total: Number(total),
      page,
      pages: Math.ceil(Number(total) / limit),
    });
  } catch (err) {
    console.error('[user.list]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/users/:id  — Perfil completo del usuario — solo ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const getById = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de usuario inválido' });

  try {
    const [[user]] = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.apellido, u.email, u.DNI, u.telefono,
              u.direccion, u.estado, u.fecha_registro,
              d.nroColegiatura,
              ${SUB_ROL} AS rol,
              ${SUB_ESP} AS especialidad
       FROM   USUARIO u
       LEFT JOIN DOCTOR d ON d.doctor_id = u.usuario_id
       WHERE  u.usuario_id = ?`,
      [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(user);
  } catch (err) {
    console.error('[user.getById]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/users/:id/deactivate  — solo ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const deactivate = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de usuario inválido' });
  if (req.user?.id === id)
    return res.status(409).json({ error: 'No puedes desactivar tu propia cuenta' });

  try {
    const [[user]] = await pool.query(
      'SELECT usuario_id, nombre, apellido, estado FROM USUARIO WHERE usuario_id = ?', [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.estado === 'INACTIVO')
      return res.status(409).json({ error: 'El usuario ya está inactivo' });

    // CA11: no permitir desactivar al último administrador activo
    const [[{ esAdmin }]] = await pool.query(
      `SELECT COUNT(*) AS esAdmin FROM ROL_USUARIO ru JOIN ROL r ON r.rol_id = ru.rol_id
        WHERE ru.usuario_id = ? AND r.nombre_rol = 'ADMINISTRADOR'`, [id]
    );
    if (esAdmin) {
      const [[{ activos }]] = await pool.query(
        `SELECT COUNT(*) AS activos FROM USUARIO u
           JOIN ROL_USUARIO ru ON ru.usuario_id = u.usuario_id
           JOIN ROL r          ON r.rol_id = ru.rol_id
          WHERE r.nombre_rol = 'ADMINISTRADOR' AND u.estado = 'ACTIVO'`
      );
      if (activos <= 1)
        return res.status(409).json({
          error: 'No se puede desactivar este usuario porque es el único administrador activo del sistema.',
        });
    }

    await pool.query("UPDATE USUARIO SET estado = 'INACTIVO' WHERE usuario_id = ?", [id]);

    await logAudit({
      usuario_id: req.user?.id, accion: 'DESACTIVAR_USUARIO', entidad: 'USUARIO',
      entidad_id: id, detalles: `${user.nombre} ${user.apellido}`, ip_origen: req.ip,
    });
    return res.json({ message: 'Usuario desactivado correctamente' });
  } catch (err) {
    console.error('[user.deactivate]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// PATCH /api/users/:id/reactivate  — solo ADMINISTRADOR
// Si nunca activó su cuenta (sin password) vuelve a PENDIENTE; si no, a ACTIVO.
// ─────────────────────────────────────────────────────────────────
const reactivate = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de usuario inválido' });

  try {
    const [[user]] = await pool.query(
      'SELECT usuario_id, nombre, apellido, estado, password_hash FROM USUARIO WHERE usuario_id = ?', [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.estado !== 'INACTIVO')
      return res.status(409).json({ error: 'Solo se pueden reactivar usuarios inactivos' });

    const nuevoEstado = user.password_hash ? 'ACTIVO' : 'PENDIENTE';
    await pool.query('UPDATE USUARIO SET estado = ? WHERE usuario_id = ?', [nuevoEstado, id]);

    await logAudit({
      usuario_id: req.user?.id, accion: 'REACTIVAR_USUARIO', entidad: 'USUARIO',
      entidad_id: id, detalles: `${user.nombre} ${user.apellido} → ${nuevoEstado}`, ip_origen: req.ip,
    });
    return res.json({ message: 'Usuario reactivado correctamente', estado: nuevoEstado });
  } catch (err) {
    console.error('[user.reactivate]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Emite un nuevo token de activación (24h) e invalida los anteriores sin usar.
async function emitirTokenActivacion(runner, usuario_id) {
  await runner.query(
    "UPDATE TOKEN_ACTIVACION SET usado = TRUE, fecha_usado = NOW() WHERE usuario_id = ? AND usado = FALSE",
    [usuario_id]
  );
  const token  = crypto.randomBytes(32).toString('hex');
  const horas  = Number(process.env.ACTIVATION_TOKEN_HOURS) || 24;
  const expiry = new Date(Date.now() + horas * 3600000);
  await runner.query(
    "INSERT INTO TOKEN_ACTIVACION (usuario_id, token, fecha_expira) VALUES (?, ?, ?)",
    [usuario_id, token, expiry]
  );
  return token;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────
// PUT /api/users/:id  — Editar datos de contacto (CA4–CA8) — ADMINISTRADOR
// Editable: nombre, apellido, email, telefono, direccion.
// Bloqueado: DNI y rol (no se leen del body).
// ─────────────────────────────────────────────────────────────────
const update = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de usuario inválido' });

  const { nombre, apellido, email, telefono, direccion } = req.body;

  if (!nombre?.trim() || !apellido?.trim())
    return res.status(400).json({ error: 'Nombre y apellido son obligatorios' });
  if (!email || !RE_EMAIL.test(String(email).trim()))
    return res.status(400).json({ error: 'El correo electrónico no es válido' });
  const telLimpio = String(telefono ?? '').replace(/\D/g, '');
  if (!/^\d{9,}$/.test(telLimpio))
    return res.status(400).json({ error: 'El teléfono debe tener al menos 9 dígitos' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    const [[user]] = await conn.query(
      'SELECT usuario_id, nombre, apellido, email, estado FROM USUARIO WHERE usuario_id = ? FOR UPDATE',
      [id]
    );
    if (!user) { await conn.query('ROLLBACK'); return res.status(404).json({ error: 'Usuario no encontrado' }); }

    const nuevoEmail = String(email).trim().toLowerCase();

    // CA5: correo único (no debe pertenecer a otro usuario)
    const [[dup]] = await conn.query(
      'SELECT usuario_id FROM USUARIO WHERE email = ? AND usuario_id <> ? LIMIT 1',
      [nuevoEmail, id]
    );
    if (dup) { await conn.query('ROLLBACK'); return res.status(409).json({ error: 'El correo ya está registrado por otro usuario' }); }

    await conn.query(
      `UPDATE USUARIO SET nombre = ?, apellido = ?, email = ?, telefono = ?, direccion = ?
        WHERE usuario_id = ?`,
      [
        String(nombre).trim(), String(apellido).trim(), nuevoEmail, telLimpio,
        direccion ? String(direccion).trim() : null, id,
      ]
    );

    // CA8: si era PENDIENTE y cambió el correo → reenviar activación al nuevo correo
    const emailCambio = nuevoEmail !== String(user.email).toLowerCase();
    let reinvitado = false;
    let nuevoToken = null;
    if (user.estado === 'PENDIENTE' && emailCambio) {
      nuevoToken = await emitirTokenActivacion(conn, id);
      reinvitado = true;
    }

    await conn.query(
      `INSERT INTO AUDITORIA (usuario_id, accion, entidad, entidad_id, detalles, ip_origen)
       VALUES (?, 'EDICION_USUARIO', 'USUARIO', ?, ?, ?)`,
      [req.user?.id ?? null, id,
       JSON.stringify({ nombre, apellido, email: nuevoEmail, emailCambio, reinvitado }), req.ip ?? null]
    );

    await conn.query('COMMIT');

    if (reinvitado) {
      sendActivationEmail(nuevoEmail, String(nombre).trim(), nuevoToken)
        .catch(e => console.error('[mailer] reinvitación:', e.message));
    }

    return res.json({ message: 'Datos actualizados correctamente', reinvitado });
  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[user.update]', err.message);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El correo ya está registrado por otro usuario' });
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  } finally {
    if (conn) conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/users/:id/resend-activation  — (CA9) — ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const resendActivation = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de usuario inválido' });

  try {
    const [[user]] = await pool.query(
      'SELECT usuario_id, nombre, email, estado FROM USUARIO WHERE usuario_id = ?', [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.estado !== 'PENDIENTE')
      return res.status(409).json({ error: 'Solo se puede reenviar la activación a usuarios pendientes' });

    const token = await emitirTokenActivacion(pool, id);

    await logAudit({
      usuario_id: req.user?.id, accion: 'REENVIO_ACTIVACION', entidad: 'USUARIO',
      entidad_id: id, detalles: `Reenvío a ${user.email}`, ip_origen: req.ip,
    });

    sendActivationEmail(user.email, user.nombre, token)
      .catch(e => console.error('[mailer] reenvío activación:', e.message));

    return res.json({ message: 'Correo de activación reenviado correctamente' });
  } catch (err) {
    console.error('[user.resendActivation]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/users/:id/activity  — (CA16) historial de auditoría — ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────
const getActivity = async (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id))
    return res.status(400).json({ error: 'ID de usuario inválido' });

  try {
    const [rows] = await pool.query(
      `SELECT a.auditoria_id, a.accion, a.detalles, a.fecha_evento,
              CONCAT(actor.nombre,' ',actor.apellido) AS actor
       FROM   AUDITORIA a
       LEFT JOIN USUARIO actor ON a.usuario_id = actor.usuario_id
       WHERE  a.entidad = 'USUARIO' AND a.entidad_id = ?
       ORDER  BY a.fecha_evento DESC
       LIMIT  50`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[user.getActivity]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register, list, getById, update, deactivate, reactivate, resendActivation, getActivity };
