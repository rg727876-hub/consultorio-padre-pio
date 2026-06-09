const crypto                  = require('crypto');
const pool                    = require('../config/db');
const { logAudit }            = require('../utils/audit.util');
const { sendActivationEmail } = require('../utils/mailer.util');

const isDev = process.env.NODE_ENV !== 'production';

// POST /api/users  — solo ADMINISTRADOR
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
    conn.release();
  }
};

module.exports = { register };
