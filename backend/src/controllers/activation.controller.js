const bcrypt   = require('bcryptjs');
const pool     = require('../config/db');
const { logAudit } = require('../utils/audit.util');

const MAX_INTENTOS_DNI = 3;

// GET /api/auth/activate/:token
const verifyToken = async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT ta.token_id, ta.fecha_expira, ta.usado,
              u.nombre, u.apellido, u.intentos_fallidos
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

    if (t.intentos_fallidos >= MAX_INTENTOS_DNI)
      return res.status(403).json({ error: 'Enlace bloqueado por demasiados intentos fallidos.' });

    return res.json({
      valid:            true,
      nombre:           t.nombre,
      apellido:         t.apellido,
      intentosRestantes: MAX_INTENTOS_DNI - t.intentos_fallidos,
    });

  } catch (err) {
    console.error('[activation.verifyToken]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/auth/activate  — body: { token, DNI, password }
const activate = async (req, res) => {
  const { token, DNI, password } = req.body;

  if (!token || !DNI || !password)
    return res.status(400).json({ error: 'Faltan datos para completar la activación' });

  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });

  try {
    const [rows] = await pool.query(
      `SELECT ta.token_id, ta.usuario_id, ta.fecha_expira, ta.usado,
              u.DNI AS dni_registrado, u.nombre, u.intentos_fallidos
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

    if (t.intentos_fallidos >= MAX_INTENTOS_DNI)
      return res.status(403).json({ error: 'Enlace bloqueado por demasiados intentos fallidos' });

    // ── Verificar DNI ────────────────────────────────────────
    if (String(t.dni_registrado) !== String(DNI)) {
      const nuevos = t.intentos_fallidos + 1;

      await pool.execute(
        'UPDATE USUARIO SET intentos_fallidos = ? WHERE usuario_id = ?',
        [nuevos, t.usuario_id]
      );

      await logAudit({
        usuario_id: t.usuario_id,
        accion:     'ACTIVACION_DNI_FALLIDO',
        entidad:    'USUARIO',
        entidad_id: t.usuario_id,
        detalles:   `Intento ${nuevos} de ${MAX_INTENTOS_DNI}`,
      });

      if (nuevos >= MAX_INTENTOS_DNI) {
        return res.status(403).json({
          error: 'Demasiados intentos fallidos. El enlace ha sido bloqueado.',
          bloqueado: true,
        });
      }

      return res.status(401).json({
        error:            'El DNI ingresado no coincide con el registrado',
        intentosRestantes: MAX_INTENTOS_DNI - nuevos,
      });
    }

    // ── DNI correcto → activar cuenta ────────────────────────
    const password_hash = await bcrypt.hash(password, 10);

    await pool.execute(
      `UPDATE USUARIO
       SET password_hash = ?, estado = 'ACTIVO',
           intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE usuario_id = ?`,
      [password_hash, t.usuario_id]
    );

    await pool.execute(
      `UPDATE TOKEN_ACTIVACION
       SET usado = TRUE, fecha_usado = NOW()
       WHERE token_id = ?`,
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

// POST /api/auth/activate/verify-dni  — verifica DNI sin activar la cuenta
const verifyDni = async (req, res) => {
  const { token, DNI } = req.body;

  if (!token || !DNI)
    return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [rows] = await pool.query(
      `SELECT ta.token_id, ta.usuario_id, ta.fecha_expira, ta.usado,
              u.DNI AS dni_registrado, u.intentos_fallidos
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

    if (t.intentos_fallidos >= MAX_INTENTOS_DNI)
      return res.status(403).json({ error: 'Enlace bloqueado por demasiados intentos fallidos.' });

    if (String(t.dni_registrado) !== String(DNI).trim()) {
      const nuevos = t.intentos_fallidos + 1;

      await pool.execute(
        'UPDATE USUARIO SET intentos_fallidos = ? WHERE usuario_id = ?',
        [nuevos, t.usuario_id]
      );

      await logAudit({
        usuario_id: t.usuario_id,
        accion:     'ACTIVACION_DNI_FALLIDO',
        entidad:    'USUARIO',
        entidad_id: t.usuario_id,
        detalles:   `Intento ${nuevos} de ${MAX_INTENTOS_DNI}`,
      });

      if (nuevos >= MAX_INTENTOS_DNI) {
        return res.status(403).json({
          error:     'Demasiados intentos fallidos. El enlace ha sido bloqueado.',
          bloqueado: true,
        });
      }

      return res.status(401).json({
        error:             'El DNI ingresado no coincide con el registrado',
        intentosRestantes: MAX_INTENTOS_DNI - nuevos,
      });
    }

    return res.json({ valid: true });

  } catch (err) {
    console.error('[activation.verifyDni]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { verifyToken, activate, verifyDni };
