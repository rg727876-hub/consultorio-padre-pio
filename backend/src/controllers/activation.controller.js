const bcrypt       = require('bcryptjs');
const pool         = require('../config/db');
const { logAudit } = require('../utils/audit.util');

const MAX_INTENTOS  = 5;
const BLOQUEO_MIN   = 15;

// ── GET /api/auth/activate/:token ────────────────────────────────
const verifyToken = async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT ta.token_id, ta.fecha_expira, ta.usado,
              u.nombre, u.apellido, u.intentos_fallidos, u.bloqueado_hasta
       FROM   TOKEN_ACTIVACION ta
       JOIN   USUARIO u ON ta.usuario_id = u.usuario_id
       WHERE  ta.token = ?`,
      [token]
    );

    if (!rows.length)
      return res.status(404).json({ error: 'El enlace de activación no es válido' });

    const t = rows[0];

    if (t.usado)
      return res.status(400).json({ error: 'Este enlace ya fue utilizado. Tu cuenta ya está activa.' });

    if (new Date(t.fecha_expira) < new Date())
      return res.status(400).json({ error: 'El enlace de activación ha expirado. Contacta al administrador.' });

    // Bloqueo temporal activo
    if (t.bloqueado_hasta && new Date(t.bloqueado_hasta) > new Date())
      return res.status(429).json({
        error:           'Demasiados intentos fallidos. Espera antes de volver a intentar.',
        bloqueado_hasta: new Date(t.bloqueado_hasta).toISOString(),
      });

    return res.json({
      valid:             true,
      nombre:            t.nombre,
      apellido:          t.apellido,
      intentosRestantes: MAX_INTENTOS - t.intentos_fallidos,
    });
  } catch (err) {
    console.error('[activation.verifyToken]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── POST /api/auth/activate/verify-dni ───────────────────────────
const verifyDni = async (req, res) => {
  const { token, DNI } = req.body;

  if (!token || !DNI)
    return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [rows] = await pool.query(
      `SELECT ta.token_id, ta.usuario_id, ta.fecha_expira, ta.usado,
              u.DNI AS dni_registrado, u.intentos_fallidos, u.bloqueado_hasta
       FROM   TOKEN_ACTIVACION ta
       JOIN   USUARIO u ON ta.usuario_id = u.usuario_id
       WHERE  ta.token = ?`,
      [token]
    );

    if (!rows.length)
      return res.status(404).json({ error: 'Token no válido' });

    const t = rows[0];

    if (t.usado)
      return res.status(400).json({ error: 'Este enlace ya fue utilizado' });

    if (new Date(t.fecha_expira) < new Date())
      return res.status(400).json({ error: 'El enlace ha expirado' });

    // Bloqueo temporal activo
    if (t.bloqueado_hasta && new Date(t.bloqueado_hasta) > new Date())
      return res.status(429).json({
        error:           'Demasiados intentos fallidos. Espera antes de volver a intentar.',
        bloqueado_hasta: new Date(t.bloqueado_hasta).toISOString(),
      });

    // Si el bloqueo ya expiró, los intentos se reinician
    const intentosActuales = (t.bloqueado_hasta && new Date(t.bloqueado_hasta) <= new Date())
      ? 0
      : (t.intentos_fallidos ?? 0);

    // Comparar DNI
    if (String(t.dni_registrado).trim() !== String(DNI).trim()) {
      const nuevos = intentosActuales + 1;

      if (nuevos >= MAX_INTENTOS) {
        const bloqueadoHasta = new Date(Date.now() + BLOQUEO_MIN * 60 * 1000);
        await pool.execute(
          'UPDATE USUARIO SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE usuario_id = ?',
          [bloqueadoHasta, t.usuario_id]
        );
        await logAudit({
          usuario_id: t.usuario_id,
          accion:     'ACTIVACION_BLOQUEADO_TEMP',
          entidad:    'USUARIO',
          entidad_id: t.usuario_id,
          detalles:   `Bloqueado ${BLOQUEO_MIN} min por ${MAX_INTENTOS} intentos fallidos`,
        });
        return res.status(429).json({
          error:           `Demasiados intentos. Intenta de nuevo en ${BLOQUEO_MIN} minutos.`,
          bloqueado_hasta: bloqueadoHasta.toISOString(),
        });
      }

      await pool.execute(
        'UPDATE USUARIO SET intentos_fallidos = ?, bloqueado_hasta = NULL WHERE usuario_id = ?',
        [nuevos, t.usuario_id]
      );
      await logAudit({
        usuario_id: t.usuario_id,
        accion:     'ACTIVACION_DNI_FALLIDO',
        entidad:    'USUARIO',
        entidad_id: t.usuario_id,
        detalles:   `Intento ${nuevos} de ${MAX_INTENTOS}`,
      });
      return res.status(401).json({
        error:             'El DNI ingresado no coincide con el registrado',
        intentosRestantes: MAX_INTENTOS - nuevos,
      });
    }

    // DNI correcto → limpiar intentos
    await pool.execute(
      'UPDATE USUARIO SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE usuario_id = ?',
      [t.usuario_id]
    );
    return res.json({ valid: true });

  } catch (err) {
    console.error('[activation.verifyDni]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── POST /api/auth/activate ──────────────────────────────────────
const activate = async (req, res) => {
  const { token, DNI, password } = req.body;

  if (!token || !DNI || !password)
    return res.status(400).json({ error: 'Faltan datos para completar la activación' });

  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });

  try {
    const [rows] = await pool.query(
      `SELECT ta.token_id, ta.usuario_id, ta.fecha_expira, ta.usado,
              u.DNI AS dni_registrado, u.intentos_fallidos, u.bloqueado_hasta
       FROM   TOKEN_ACTIVACION ta
       JOIN   USUARIO u ON ta.usuario_id = u.usuario_id
       WHERE  ta.token = ?`,
      [token]
    );

    if (!rows.length)
      return res.status(404).json({ error: 'Token no válido' });

    const t = rows[0];

    if (t.usado)
      return res.status(400).json({ error: 'Este enlace ya fue utilizado' });

    if (new Date(t.fecha_expira) < new Date())
      return res.status(400).json({ error: 'El enlace ha expirado' });

    if (t.bloqueado_hasta && new Date(t.bloqueado_hasta) > new Date())
      return res.status(429).json({
        error:           'Cuenta bloqueada temporalmente',
        bloqueado_hasta: new Date(t.bloqueado_hasta).toISOString(),
      });

    if (String(t.dni_registrado).trim() !== String(DNI).trim())
      return res.status(401).json({ error: 'El DNI ingresado no coincide' });

    const password_hash = await bcrypt.hash(password, 10);

    await pool.execute(
      `UPDATE USUARIO
       SET password_hash = ?, estado = 'ACTIVO',
           intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE usuario_id = ?`,
      [password_hash, t.usuario_id]
    );

    await pool.execute(
      `UPDATE TOKEN_ACTIVACION SET usado = TRUE, fecha_usado = NOW() WHERE token_id = ?`,
      [t.token_id]
    );

    await logAudit({
      usuario_id: t.usuario_id,
      accion:     'ACTIVACION_EXITOSA',
      entidad:    'USUARIO',
      entidad_id: t.usuario_id,
      detalles:   'Cuenta activada correctamente',
    });

    return res.json({ message: 'Cuenta activada. Ya puedes iniciar sesión.' });

  } catch (err) {
    console.error('[activation.activate]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { verifyToken, verifyDni, activate };
