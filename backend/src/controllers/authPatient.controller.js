const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt.util');
const { logAudit } = require('../utils/audit.util');

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

const login = async (req, res) => {
  const { tipo_documento, numero_documento, password } = req.body;

  if (!tipo_documento || !numero_documento || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    const [[paciente]] = await conn.query(
      `SELECT paciente_id, nombre, apellido, email_cuenta, password_hash, estado_cuenta, estado, intentos_fallidos, bloqueado_hasta
       FROM PACIENTE 
       WHERE tipo_documento = ? AND numero_documento = ? FOR UPDATE`,
      [tipo_documento, numero_documento]
    );

    if (!paciente || paciente.estado_cuenta !== 'ACTIVO') {
      await conn.query('ROLLBACK');
      return res.status(401).json({ error: 'Documento o contraseña incorrectos.' });
    }

    if (paciente.estado !== 'ACTIVO') {
      await conn.query('ROLLBACK');
      return res.status(403).json({ error: 'Cuenta de paciente inactiva. Comunícate con la clínica.' });
    }

    if (paciente.bloqueado_hasta && new Date() < new Date(paciente.bloqueado_hasta)) {
      await conn.query('ROLLBACK');
      const faltanMs = new Date(paciente.bloqueado_hasta) - new Date();
      const faltanMin = Math.ceil(faltanMs / 60000);
      return res.status(403).json({ error: `Demasiados intentos fallidos. Cuenta bloqueada ${faltanMin} minutos.` });
    }

    const isValid = await bcrypt.compare(password, paciente.password_hash);

    if (!isValid) {
      const nuevosIntentos = paciente.intentos_fallidos + 1;
      let bloqueoHasta = null;

      if (nuevosIntentos >= MAX_INTENTOS) {
        bloqueoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000);
      }

      await conn.query(
        'UPDATE PACIENTE SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE paciente_id = ?',
        [nuevosIntentos, bloqueoHasta, paciente.paciente_id]
      );
      await conn.query('COMMIT');

      if (bloqueoHasta) {
        return res.status(403).json({ error: `Demasiados intentos fallidos. Cuenta bloqueada ${BLOQUEO_MINUTOS} minutos.` });
      }

      return res.status(401).json({ error: 'Documento o contraseña incorrectos.' });
    }

    // Contraseña correcta
    await conn.query(
      'UPDATE PACIENTE SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE paciente_id = ?',
      [paciente.paciente_id]
    );
    await conn.query('COMMIT');

    await logAudit({
      paciente_id: paciente.paciente_id,
      accion: 'LOGIN_PACIENTE',
      ip_origen: req.ip
    });

    const token = generateToken({ id: paciente.paciente_id, rol: 'PACIENTE' });

    res.json({
      token,
      user: {
        id: paciente.paciente_id,
        nombre: paciente.nombre,
        apellido: paciente.apellido,
        rol: 'PACIENTE'
      }
    });

  } catch (error) {
    if (conn) await conn.query('ROLLBACK');
    console.error('[authPatient.login]', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

const register = async (req, res) => {
  const { nombre, apellido, tipo_documento, numero_documento, sexo, telefono, email_cuenta, password, fecha_nacimiento } = req.body;

  if (!nombre || !apellido || !tipo_documento || !numero_documento || !email_cuenta || !password || !fecha_nacimiento) {
    return res.status(400).json({ error: 'Complete todos los campos obligatorios' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    
    // Verificamos si existe por documento
    const [[existenteDoc]] = await conn.query(
      'SELECT paciente_id, estado_cuenta FROM PACIENTE WHERE tipo_documento = ? AND numero_documento = ?',
      [tipo_documento, numero_documento]
    );

    if (existenteDoc) {
      if (existenteDoc.estado_cuenta === 'ACTIVO') {
        return res.status(409).json({ error: 'Este documento ya tiene una cuenta activa. Inicia sesión.' });
      } else {
        return res.status(409).json({ error: 'Este documento está registrado... vincúlala con tu registro existente.' });
      }
    }

    // Verificamos correo
    const [[existenteEmail]] = await conn.query(
      'SELECT paciente_id FROM PACIENTE WHERE email_cuenta = ?',
      [email_cuenta]
    );

    if (existenteEmail) {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await conn.query(
      `INSERT INTO PACIENTE 
       (nombre, apellido, tipo_documento, numero_documento, sexo, telefono, email_cuenta, password_hash, fecha_nacimiento, estado_cuenta, fecha_creacion_cuenta) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', NOW())`,
      [nombre, apellido, tipo_documento, numero_documento, sexo, telefono, email_cuenta, passwordHash, fecha_nacimiento]
    );

    await logAudit({
      paciente_id: result.insertId,
      accion: 'REGISTRO_WEB_PACIENTE',
      ip_origen: req.ip
    });

    res.status(201).json({ message: 'Cuenta creada exitosamente.' });
  } catch (error) {
    console.error('[authPatient.register]', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

const linkAccount = async (req, res) => {
  const { tipo_documento, numero_documento, fecha_nacimiento, email_cuenta, password } = req.body;

  if (!tipo_documento || !numero_documento || !fecha_nacimiento || !email_cuenta || !password) {
    return res.status(400).json({ error: 'Complete todos los campos' });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const [[paciente]] = await conn.query(
      'SELECT paciente_id, fecha_nacimiento, estado_cuenta FROM PACIENTE WHERE tipo_documento = ? AND numero_documento = ?',
      [tipo_documento, numero_documento]
    );

    if (!paciente) {
      return res.status(404).json({ error: 'No se encontró registro para este documento' });
    }

    if (paciente.estado_cuenta === 'ACTIVO') {
      return res.status(409).json({ error: 'Esta cuenta ya está vinculada y activa' });
    }

    // Comparar fecha de nacimiento (Solo año, mes, dia para no lidiar con T00:00:00Z de JS)
    const dbDate = new Date(paciente.fecha_nacimiento).toISOString().split('T')[0];
    const inputDate = new Date(fecha_nacimiento).toISOString().split('T')[0];

    if (dbDate !== inputDate) {
      return res.status(403).json({ error: 'Los datos no coinciden. Si tienes problemas, comunícate con el consultorio.' });
    }

    const [[existenteEmail]] = await conn.query(
      'SELECT paciente_id FROM PACIENTE WHERE email_cuenta = ? AND paciente_id != ?',
      [email_cuenta, paciente.paciente_id]
    );

    if (existenteEmail) {
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado en otra cuenta.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await conn.query(
      `UPDATE PACIENTE 
       SET email_cuenta = ?, password_hash = ?, estado_cuenta = 'ACTIVO', fecha_creacion_cuenta = NOW() 
       WHERE paciente_id = ?`,
      [email_cuenta, passwordHash, paciente.paciente_id]
    );

    await logAudit({
      paciente_id: paciente.paciente_id,
      accion: 'VINCULACION_WEB_PACIENTE',
      ip_origen: req.ip
    });

    res.json({ message: 'Cuenta vinculada y activada exitosamente.' });
  } catch (error) {
    console.error('[authPatient.link]', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { login, register, linkAccount };
