const bcrypt = require('bcryptjs');
const pool   = require('../config/db');
const { generateToken } = require('../utils/jwt.util');

const MAX_INTENTOS   = 5;
const BLOQUEO_MIN    = 15;

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });

  try {
    // Obtener usuario + su rol (JOIN con ROL_USUARIO y ROL)
    const [rows] = await pool.query(
      `SELECT u.usuario_id, u.nombre, u.apellido, u.email, u.avatar,
              u.password_hash, u.estado,
              u.intentos_fallidos, u.bloqueado_hasta,
              r.nombre_rol AS rol
       FROM   USUARIO u
       LEFT JOIN ROL_USUARIO ru ON u.usuario_id = ru.usuario_id
       LEFT JOIN ROL r           ON ru.rol_id   = r.rol_id
       WHERE  u.email = ?`,
      [email]
    );

    if (!rows.length)
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

    const user = rows[0];

    // ── Cuenta bloqueada ───────────────────────────────────────
    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      const minutosRestantes = Math.ceil(
        (new Date(user.bloqueado_hasta) - new Date()) / 60000
      );
      return res.status(403).json({
        error: `Cuenta bloqueada por demasiados intentos. Intenta en ${minutosRestantes} min.`,
      });
    }

    // ── Cuenta inactiva / pendiente ────────────────────────────
    if (user.estado !== 'ACTIVO')
      return res.status(403).json({
        error: user.estado === 'PENDIENTE'
          ? 'Tu cuenta aún no ha sido activada. Revisa tu correo.'
          : 'Tu cuenta está inactiva. Contacta al administrador.',
      });

    // ── Verificar contraseña ───────────────────────────────────
    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      const nuevosIntentos = (user.intentos_fallidos ?? 0) + 1;

      if (nuevosIntentos >= MAX_INTENTOS) {
        const bloqueoHasta = new Date(Date.now() + BLOQUEO_MIN * 60 * 1000);
        await pool.query(
          `UPDATE USUARIO
           SET intentos_fallidos = ?, bloqueado_hasta = ?
           WHERE usuario_id = ?`,
          [nuevosIntentos, bloqueoHasta, user.usuario_id]
        );
        return res.status(403).json({
          error: `Demasiados intentos fallidos. Cuenta bloqueada ${BLOQUEO_MIN} minutos.`,
        });
      }

      await pool.query(
        `UPDATE USUARIO SET intentos_fallidos = ? WHERE usuario_id = ?`,
        [nuevosIntentos, user.usuario_id]
      );
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // ── Login exitoso: resetear intentos ──────────────────────
    await pool.query(
      `UPDATE USUARIO
       SET intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE usuario_id = ?`,
      [user.usuario_id]
    );

    const payload = {
      id:       user.usuario_id,
      nombre:   user.nombre,
      apellido: user.apellido,
      email:    user.email,
      rol:      user.rol,
      avatar:   user.avatar,
    };

    const token = generateToken(payload);

    return res.json({
      token,
      user: payload,
    });

  } catch (err) {
    console.error('[authStaff.login]', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };
