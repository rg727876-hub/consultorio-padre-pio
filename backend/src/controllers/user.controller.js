const crypto                  = require('crypto');
const pool                    = require('../config/db');
const { logAudit }            = require('../utils/audit.util');
const { sendActivationEmail } = require('../utils/mailer.util');

const isDev = process.env.NODE_ENV !== 'production';

// GET /api/users — solo ADMINISTRADOR
// Soporta filtro opcional ?rol=DOCTOR
const getAllUsers = async (req, res) => {
  const { rol } = req.query; // Filtro opcional: ?rol=DOCTOR
  let conn;
  try {
    conn = await pool.getConnection();
    try {
      let query = `
        SELECT 
          u.usuario_id, u.nombre, u.apellido, u.email, u.DNI, u.estado, 
          r.nombre_rol, 
          d.especialidad
        FROM USUARIO u
        LEFT JOIN ROL_USUARIO ru ON u.usuario_id = ru.usuario_id
        LEFT JOIN ROL r ON ru.rol_id = r.rol_id
        LEFT JOIN DOCTOR d ON u.usuario_id = d.doctor_id
      `;
      
      if (rol && rol !== 'TODOS') {
        query += ` WHERE r.nombre_rol = ?`;
      }
      
      query += ` ORDER BY u.apellido ASC`;
      
      const params = rol && rol !== 'TODOS' ? [rol] : [];
      const [users] = await conn.query(query, params);
      return res.status(200).json(users);
    } catch (err) {
      // Fallback: some deployments may not have the DOCTOR.especialidad column
      if (err.code === 'ER_BAD_FIELD_ERROR' || /Unknown column 'd\.especialidad'/.test(err.message)) {
        try {
          let fallbackQuery = `
            SELECT 
              u.usuario_id, u.nombre, u.apellido, u.email, u.DNI, u.estado, 
              r.nombre_rol
            FROM USUARIO u
            LEFT JOIN ROL_USUARIO ru ON u.usuario_id = ru.usuario_id
            LEFT JOIN ROL r ON ru.rol_id = r.rol_id
          `;
          
          if (rol && rol !== 'TODOS') {
            fallbackQuery += ` WHERE r.nombre_rol = ?`;
          }
          
          fallbackQuery += ` ORDER BY u.apellido ASC`;
          
          const fbParams = rol && rol !== 'TODOS' ? [rol] : [];
          const [users] = await conn.query(fallbackQuery, fbParams);
          // Ensure response shape includes 'especialidad' for frontend compatibility
          const normalized = users.map(u => ({ ...u, especialidad: null }));
          return res.status(200).json(normalized);
        } catch (err2) {
          console.error('[user.getAllUsers] Fallback error:', err2.message);
          return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err2.message }) });
        }
      }
      console.error('[user.getAllUsers] Error:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
    }
  } catch (dbErr) {
    console.error('[user.getAllUsers] DB connection error:', dbErr.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: dbErr.message }) });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/users  — solo ADMINISTRADOR
const register = async (req, res) => {
  const {
    nombre, apellido, DNI, email, telefono, direccion,
    rol, especialidad, nroColegiatura, servicios = [],
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
    if (!especialidad || !String(especialidad).trim())
      return res.status(400).json({ error: 'La especialidad es requerida para doctores' });
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
        'INSERT INTO DOCTOR (doctor_id, especialidad, nroColegiatura) VALUES (?, ?, ?)',
        [usuario_id, String(especialidad).trim(), Number(nroColegiatura)]
      );

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

// GET /api/users/:id — solo ADMINISTRADOR
const getUserById = async (req, res) => {
  const { id } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    try {
      const [users] = await conn.query(`
        SELECT 
          u.usuario_id, u.nombre, u.apellido, u.email, u.DNI, u.telefono, u.direccion,
          u.estado, u.fecha_registro,
          r.nombre_rol, 
          d.especialidad, d.nroColegiatura
        FROM USUARIO u
        LEFT JOIN ROL_USUARIO ru ON u.usuario_id = ru.usuario_id
        LEFT JOIN ROL r ON ru.rol_id = r.rol_id
        LEFT JOIN DOCTOR d ON u.usuario_id = d.doctor_id
        WHERE u.usuario_id = ?
      `, [id]);

      if (!users.length) return res.status(404).json({ error: 'Usuario no encontrado' });

      // CA16: Historial de Auditoría
      const [audit] = await conn.query(`
        SELECT accion, detalles, fecha_evento, 
          (SELECT CONCAT(nombre, ' ', apellido) FROM USUARIO actor WHERE actor.usuario_id = a.usuario_id) as autor
        FROM AUDITORIA a
        WHERE entidad = 'USUARIO' AND entidad_id = ?
        ORDER BY fecha_evento DESC
        LIMIT 20
      `, [id]);

      return res.status(200).json({ ...users[0], auditoria: audit });
    } catch (err) {
      // Fallback if DOCTOR table missing expected columns
      if (err.code === 'ER_BAD_FIELD_ERROR' || /Unknown column 'd\.especialidad'/.test(err.message)) {
        try {
          const [users] = await conn.query(`
            SELECT 
              u.usuario_id, u.nombre, u.apellido, u.email, u.DNI, u.telefono, u.direccion,
              u.estado, u.fecha_registro,
              r.nombre_rol
            FROM USUARIO u
            LEFT JOIN ROL_USUARIO ru ON u.usuario_id = ru.usuario_id
            LEFT JOIN ROL r ON ru.rol_id = r.rol_id
            WHERE u.usuario_id = ?
          `, [id]);

          if (!users.length) return res.status(404).json({ error: 'Usuario no encontrado' });

          const [audit] = await conn.query(`
            SELECT accion, detalles, fecha_evento, 
              (SELECT CONCAT(nombre, ' ', apellido) FROM USUARIO actor WHERE actor.usuario_id = a.usuario_id) as autor
            FROM AUDITORIA a
            WHERE entidad = 'USUARIO' AND entidad_id = ?
            ORDER BY fecha_evento DESC
            LIMIT 20
          `, [id]);

          return res.status(200).json({ ...users[0], especialidad: null, nroColegiatura: null, auditoria: audit });
        } catch (err2) {
          console.error('[user.getUserById] Fallback error:', err2.message);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      }
      console.error('[user.getUserById] Error:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    // CA16: Historial de Auditoría
    const [audit] = await conn.query(`
      SELECT accion, detalles, fecha_evento, 
        (SELECT CONCAT(nombre, ' ', apellido) FROM USUARIO actor WHERE actor.usuario_id = a.usuario_id) as autor
      FROM AUDITORIA a
      WHERE entidad = 'USUARIO' AND entidad_id = ?
      ORDER BY fecha_evento DESC
      LIMIT 20
    `, [id]);

    return res.status(200).json({ ...users[0], auditoria: audit });
  } catch (err) {
    console.error('[user.getUserById] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/users/:id — solo ADMINISTRADOR
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, email, telefono, direccion } = req.body;
  let conn;

  try {
    conn = await pool.getConnection();

    // Validar usuario
    const [users] = await conn.query('SELECT estado, email FROM USUARIO WHERE usuario_id = ?', [id]);
    if (!users.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const user = users[0];

    // Verificar unicidad de email
    const [existing] = await conn.query('SELECT usuario_id FROM USUARIO WHERE email = ? AND usuario_id != ?', [email, id]);
    if (existing.length) return res.status(400).json({ error: 'El correo ya está en uso por otro usuario' });

    await conn.query('START TRANSACTION');

    // CA8: Si es Pendiente y cambió el correo, reemitir invitación
    if (user.estado === 'PENDIENTE' && user.email !== email) {
      // Invalidar tokens viejos
      await conn.query('UPDATE TOKEN_ACTIVACION SET usado = TRUE, fecha_usado = NOW() WHERE usuario_id = ? AND usado = FALSE', [id]);
      
      const token = crypto.randomBytes(32).toString('hex');
      const horas = Number(process.env.ACTIVATION_TOKEN_HOURS) || 24;
      const expiry = new Date(Date.now() + horas * 3600000);
      
      await conn.query(
        'INSERT INTO TOKEN_ACTIVACION (usuario_id, token, fecha_expira) VALUES (?, ?, ?)',
        [id, token, expiry]
      );
      
      sendActivationEmail(email.trim().toLowerCase(), String(nombre).trim(), token)
        .catch((e) => console.error('[mailer] Error de activación reenvío CA8:', e.message));
    }

    // CA4: Editar contacto (no DNI, no Rol)
    await conn.query(
      'UPDATE USUARIO SET nombre=?, apellido=?, email=?, telefono=?, direccion=? WHERE usuario_id=?',
      [nombre.trim(), apellido.trim(), email.trim().toLowerCase(), telefono, direccion, id]
    );

    await conn.query('COMMIT');

    // CA15: Auditoria
    await logAudit({
      usuario_id: req.user?.id,
      accion: 'EDICION_PERFIL_USUARIO',
      entidad: 'USUARIO',
      entidad_id: id,
      detalles: JSON.stringify({ oldEmail: user.email, newEmail: email })
    });

    return res.status(200).json({ message: 'Datos actualizados correctamente.' });
  } catch (err) {
    if (conn) try { await conn.query('ROLLBACK'); } catch (_) {}
    console.error('[user.updateUser] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

// PUT /api/users/:id/status — solo ADMINISTRADOR
const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // 'ACTIVO' o 'INACTIVO'
  let conn;

  try {
    conn = await pool.getConnection();

    // Validar estado válido
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }

    // CA11: Regla estricta: No desactivar al último administrador
    if (estado === 'INACTIVO') {
      const [admins] = await conn.query(`
        SELECT u.usuario_id 
        FROM USUARIO u
        JOIN ROL_USUARIO ru ON u.usuario_id = ru.usuario_id
        JOIN ROL r ON ru.rol_id = r.rol_id
        WHERE r.nombre_rol = 'ADMINISTRADOR' AND u.estado = 'ACTIVO'
      `);
      
      if (admins.length <= 1 && admins.some(a => a.usuario_id === parseInt(id))) {
        return res.status(403).json({ error: 'No se puede desactivar este usuario porque es el único administrador activo del sistema.' });
      }
    }

    await conn.query('UPDATE USUARIO SET estado = ? WHERE usuario_id = ?', [estado, id]);

    // CA15: Auditoria
    await logAudit({
      usuario_id: req.user?.id,
      accion: estado === 'INACTIVO' ? 'DESACTIVACION_USUARIO' : 'REACTIVACION_USUARIO',
      entidad: 'USUARIO',
      entidad_id: id,
      detalles: 'Cambio de estado a ' + estado
    });

    const msg = estado === 'INACTIVO' ? 'Usuario desactivado correctamente.' : 'Usuario reactivado correctamente.';
    return res.status(200).json({ message: msg });
  } catch (err) {
    console.error('[user.updateUserStatus] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/users/:id/resend-activation — solo ADMINISTRADOR
const resendActivation = async (req, res) => {
  const { id } = req.params;
  let conn;

  try {
    conn = await pool.getConnection();
    const [users] = await conn.query('SELECT nombre, email, estado FROM USUARIO WHERE usuario_id = ?', [id]);
    
    if (!users.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const user = users[0];
    if (user.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden reenviar accesos a usuarios pendientes.' });
    }

    await conn.query('START TRANSACTION');

    // CA9: Anular anteriores
    await conn.query('UPDATE TOKEN_ACTIVACION SET usado = TRUE, fecha_usado = NOW() WHERE usuario_id = ? AND usado = FALSE', [id]);

    const token = crypto.randomBytes(32).toString('hex');
    const horas = Number(process.env.ACTIVATION_TOKEN_HOURS) || 24;
    const expiry = new Date(Date.now() + horas * 3600000);
    
    await conn.query(
      'INSERT INTO TOKEN_ACTIVACION (usuario_id, token, fecha_expira) VALUES (?, ?, ?)',
      [id, token, expiry]
    );

    await conn.query('COMMIT');

    sendActivationEmail(user.email, user.nombre, token)
      .catch((e) => console.error('[mailer] Error resendActivation:', e.message));

    // CA15: Auditoria
    await logAudit({
      usuario_id: req.user?.id,
      accion: 'REENVIO_ACTIVACION',
      entidad: 'USUARIO',
      entidad_id: id,
      detalles: 'Se emitió una nueva invitación válida por 24h.'
    });

    return res.status(200).json({ message: 'Correo de activación reenviado correctamente.' });
  } catch (err) {
    if (conn) try { await conn.query('ROLLBACK'); } catch (_) {}
    console.error('[user.resendActivation] Error:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { register, getAllUsers, getUserById, updateUser, updateUserStatus, resendActivation };
