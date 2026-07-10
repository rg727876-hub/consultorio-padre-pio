const bcrypt = require('bcryptjs');
const pool   = require('../config/db');
const {
  findByDocument, findByEmailCuenta, registerWebAccount,
  findByDocumentForLogin, findByDocumentPreview, linkWebAccount,
} = require('../models/patient.model');
const { generateToken } = require('../utils/jwt.util');
const { logAudit } = require('../utils/audit.util');
const { sendWelcomePatientEmail } = require('../utils/mailer.util');

const isDev = process.env.NODE_ENV !== 'production';

// ── Reglas de validación ─────────────────────────────────────────────────────
const TIPOS_DOCUMENTO = ['DNI', 'CE', 'PASAPORTE'];
const RE_DNI       = /^\d{8}$/;
const RE_CE        = /^[A-Za-z0-9]{9,12}$/;
const RE_PASAPORTE = /^[A-Za-z0-9]{6,12}$/;
const RE_EMAIL     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONO  = /^\d{9}$/;
const RE_PASSWORD  = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const validarDocumento = (tipo, numero) => {
  if (tipo === 'DNI')       return RE_DNI.test(numero);
  if (tipo === 'CE')        return RE_CE.test(numero);
  if (tipo === 'PASAPORTE') return RE_PASAPORTE.test(numero);
  return false;
};

const MSG_DOCUMENTO = {
  DNI:       'El DNI debe tener exactamente 8 dígitos numéricos',
  CE:        'El CE debe tener entre 9 y 12 caracteres alfanuméricos',
  PASAPORTE: 'El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos',
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/patient/register   — Registro de cuenta web del paciente
// Ruta pública (sin token). Rate-limited por authLimiter en app.js.
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  const {
    tipo_documento,
    numero_documento,
    nombre,
    apellido,
    fecha_nacimiento,
    sexo,
    telefono,
    email,
    password,
    confirmar_password,
    acepta_politica,
  } = req.body;
  const fotoUrl = req.file ? `/uploads/patients/${req.file.filename}` : null;

  // ── Campos obligatorios ───────────────────────────────────────────────────
  if (
    !tipo_documento     ||
    !numero_documento?.trim() ||
    !nombre?.trim()     ||
    !apellido?.trim()   ||
    !fecha_nacimiento   ||
    !sexo               ||
    !telefono           ||
    !email?.trim()      ||
    !password           ||
    !confirmar_password
  ) return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });

  if (!acepta_politica)
    return res.status(400).json({ error: 'Debes aceptar la Política de Privacidad' });

  // ── Nombre y apellido ─────────────────────────────────────────────────────
  const nombreLimpio  = String(nombre).trim().toUpperCase();
  const apellidoLimpio = String(apellido).trim().toUpperCase();

  if (nombreLimpio.length < 2 || nombreLimpio.length > 30)
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres' });

  if (apellidoLimpio.length < 2 || apellidoLimpio.length > 30)
    return res.status(400).json({ error: 'El apellido debe tener entre 2 y 30 caracteres' });

  // ── Tipo de documento ─────────────────────────────────────────────────────
  if (!TIPOS_DOCUMENTO.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  const docLimpio = String(numero_documento).trim();
  if (!validarDocumento(tipo_documento, docLimpio))
    return res.status(400).json({ error: MSG_DOCUMENTO[tipo_documento] });

  // ── Email ─────────────────────────────────────────────────────────────────
  const emailLower = String(email).trim().toLowerCase();
  if (!RE_EMAIL.test(emailLower))
    return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido' });

  // ── Teléfono ──────────────────────────────────────────────────────────────
  const telefonoLimpio = String(telefono).replace(/\D/g, '');
  if (!RE_TELEFONO.test(telefonoLimpio))
    return res.status(400).json({ error: 'El celular debe tener exactamente 9 dígitos' });

  // ── Contraseña ────────────────────────────────────────────────────────────
  if (!RE_PASSWORD.test(password))
    return res.status(400).json({
      error: 'La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial',
    });

  if (password !== confirmar_password)
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });

  // ── Fecha de nacimiento ───────────────────────────────────────────────────
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dob = new Date(fecha_nacimiento + 'T00:00:00');
  if (isNaN(dob.getTime()) || dob >= hoy)
    return res.status(400).json({ error: 'La fecha de nacimiento debe ser anterior al día de hoy' });
  const edad = Math.floor((hoy - dob) / (1000 * 60 * 60 * 24 * 365.25));
  if (edad < 18)
    return res.status(400).json({ error: 'Debes ser mayor de 18 años para crear una cuenta' });
  if (edad > 120)
    return res.status(400).json({ error: 'La fecha de nacimiento no es válida' });

  try {
    // ── Verificar documento (tipo + número) ───────────────────────────────
    const existente = await findByDocument(tipo_documento, docLimpio);
    if (existente) {
      if (existente.estado_cuenta === 'ACTIVO')
        return res.status(409).json({
          error: 'Este documento ya tiene una cuenta activa. Inicia sesión.',
          codigo: 'DOC_CUENTA_ACTIVA',
        });

      if (existente.estado_cuenta === 'FAMILIAR')
        return res.status(409).json({
          error: 'Este documento está registrado como familiar de otro paciente. Puedes activar tu propia cuenta de acceso.',
          codigo: 'DOC_FAMILIAR',
        });

      // estado_cuenta = 'SIN_CUENTA': paciente registrado internamente sin cuenta web
      return res.status(409).json({
        error: 'Este documento está registrado en el consultorio. Para crear tu cuenta web, vincúlala con tu registro existente.',
        codigo: 'DOC_SIN_CUENTA',
      });
    }

    // ── Verificar email_cuenta (único para login web) ──────────────────────
    const emailExiste = await findByEmailCuenta(emailLower);
    if (emailExiste)
      return res.status(409).json({
        error: 'El correo electrónico ya se encuentra registrado.',
        codigo: 'EMAIL_DUPLICADO',
      });

    // ── Crear cuenta ───────────────────────────────────────────────────────
    const password_hash = await bcrypt.hash(password, 12);

    const paciente_id = await registerWebAccount({
      nombre:           nombreLimpio,
      apellido:         apellidoLimpio,
      tipo_documento,
      numero_documento: docLimpio,
      telefono:         telefonoLimpio,
      sexo,
      email_cuenta:     emailLower,
      fecha_nacimiento,
      password_hash,
      foto:             fotoUrl,
    });

    // ── Email de bienvenida (fire-and-forget, no bloquea la respuesta) ─────
    sendWelcomePatientEmail(emailLower, String(nombre).trim()).catch((err) =>
      console.error('[authPatient.register] Correo de bienvenida falló:', err.message)
    );

    // ── Auditoría ──────────────────────────────────────────────────────────
    await logAudit({
      paciente_id,
      accion:     'REGISTRO_WEB_PACIENTE',
      entidad:    'PACIENTE',
      entidad_id: paciente_id,
      detalles:   JSON.stringify({ tipo_documento, numero_documento: docLimpio }),
      ip_origen:  req.ip,
    });

    return res.status(201).json({ message: 'Registro exitoso' });

  } catch (err) {
    console.error('[authPatient.register]', err.message);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/patient/login   — Login con documento + contraseña
// ─────────────────────────────────────────────────────────────────────────────
const MAX_INTENTOS = 5;
const BLOQUEO_MIN  = 15;
const GENERIC_ERROR = 'Documento o contraseña incorrectos.';

const login = async (req, res) => {
  const { tipo_documento, numero_documento, password } = req.body;

  if (!tipo_documento || !numero_documento?.trim() || !password)
    return res.status(400).json({ error: 'Complete todos los campos.' });

  if (!TIPOS_DOCUMENTO.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  const docLimpio = String(numero_documento).trim();
  if (!validarDocumento(tipo_documento, docLimpio))
    return res.status(400).json({ error: MSG_DOCUMENTO[tipo_documento] });

  try {
    const paciente = await findByDocumentForLogin(tipo_documento, docLimpio);

    // Paciente no existe o no tiene cuenta ACTIVA → mensaje genérico (no revelar motivo)
    if (!paciente || paciente.estado_cuenta !== 'ACTIVO') {
      await logAudit({
        accion:    'LOGIN_PACIENTE_FALLIDO',
        entidad:   'PACIENTE',
        detalles:  JSON.stringify({ tipo_documento, numero_documento: docLimpio, motivo: paciente ? paciente.estado_cuenta : 'NO_EXISTE' }),
        ip_origen: req.ip,
      });
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    // Cuenta bloqueada temporalmente
    if (paciente.bloqueado_hasta && new Date(paciente.bloqueado_hasta) > new Date()) {
      const minutosRestantes = Math.ceil(
        (new Date(paciente.bloqueado_hasta) - new Date()) / 60000
      );
      await logAudit({
        paciente_id: paciente.paciente_id,
        accion:      'LOGIN_PACIENTE_BLOQUEADO',
        entidad:     'PACIENTE',
        entidad_id:  paciente.paciente_id,
        detalles:    JSON.stringify({ minutosRestantes }),
        ip_origen:   req.ip,
      });
      return res.status(403).json({
        error: `Cuenta bloqueada temporalmente. Intente nuevamente en ${minutosRestantes} minuto${minutosRestantes === 1 ? '' : 's'}.`,
        codigo: 'CUENTA_BLOQUEADA',
        bloqueado_hasta: new Date(paciente.bloqueado_hasta).toISOString(),
      });
    }

    // Verificar contraseña
    const passwordOk = await bcrypt.compare(password, paciente.password_hash);

    if (!passwordOk) {
      const nuevosIntentos = (paciente.intentos_fallidos ?? 0) + 1;

      if (nuevosIntentos >= MAX_INTENTOS) {
        const bloqueoHasta = new Date(Date.now() + BLOQUEO_MIN * 60 * 1000);
        await pool.query(
          `UPDATE PACIENTE SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE paciente_id = ?`,
          [nuevosIntentos, bloqueoHasta, paciente.paciente_id]
        );
        await logAudit({
          paciente_id: paciente.paciente_id,
          accion:      'LOGIN_PACIENTE_BLOQUEADO_TEMP',
          entidad:     'PACIENTE',
          entidad_id:  paciente.paciente_id,
          detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio }),
          ip_origen:   req.ip,
        });
        return res.status(403).json({
          error: `Cuenta bloqueada temporalmente. Intente nuevamente en ${BLOQUEO_MIN} minutos.`,
          codigo: 'CUENTA_BLOQUEADA',
          bloqueado_hasta: bloqueoHasta.toISOString(),
        });
      }

      await pool.query(
        `UPDATE PACIENTE SET intentos_fallidos = ? WHERE paciente_id = ?`,
        [nuevosIntentos, paciente.paciente_id]
      );
      await logAudit({
        paciente_id: paciente.paciente_id,
        accion:      'LOGIN_PACIENTE_FALLIDO',
        entidad:     'PACIENTE',
        entidad_id:  paciente.paciente_id,
        detalles:    JSON.stringify({ intento: nuevosIntentos, tipo_documento, numero_documento: docLimpio }),
        ip_origen:   req.ip,
      });
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    // Login exitoso: resetear intentos
    await pool.query(
      `UPDATE PACIENTE SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE paciente_id = ?`,
      [paciente.paciente_id]
    );

    const payload = {
      id:       paciente.paciente_id,
      nombre:   paciente.nombre,
      apellido: paciente.apellido,
      email:    paciente.email_cuenta,
      foto:     paciente.foto,
      tipo:     'PACIENTE',
      rol:      'PACIENTE',
    };

    const token = generateToken(payload);

    await logAudit({
      paciente_id: paciente.paciente_id,
      accion:      'LOGIN_PACIENTE_EXITOSO',
      entidad:     'PACIENTE',
      entidad_id:  paciente.paciente_id,
      detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio }),
      ip_origen:   req.ip,
    });

    return res.json({ token, user: payload });

  } catch (err) {
    console.error('[authPatient.login]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/patient/logout  — Solo auditoría; la invalidación es client-side
// ─────────────────────────────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    const paciente_id = req.user?.id ?? null;
    await logAudit({
      paciente_id,
      accion:    'LOGOUT_PACIENTE',
      entidad:   'PACIENTE',
      entidad_id: paciente_id,
      ip_origen: req.ip,
    });
    return res.json({ message: 'Sesión cerrada' });
  } catch (err) {
    console.error('[authPatient.logout]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/patient/preview  — Datos anonimizados para reconocimiento
// ─────────────────────────────────────────────────────────────────────────────
const preview = async (req, res) => {
  const { tipo_documento, numero_documento } = req.body;

  if (!tipo_documento || !numero_documento?.trim())
    return res.status(400).json({ error: 'Tipo y número de documento requeridos' });

  if (!TIPOS_DOCUMENTO.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  const docLimpio = String(numero_documento).trim();

  try {
    // Verificar si ya tiene cuenta activa
    const existente = await findByDocument(tipo_documento, docLimpio);
    if (existente?.estado_cuenta === 'ACTIVO')
      return res.status(409).json({
        error: 'Este documento ya tiene una cuenta activa. Inicia sesión.',
        codigo: 'CUENTA_ACTIVA',
      });

    const paciente = await findByDocumentPreview(tipo_documento, docLimpio);
    if (!paciente)
      return res.status(404).json({ error: 'No se encontró un registro vinculable con ese documento' });

    // Verificar mayoría de edad del paciente en BD
    const dobBD = paciente.fecha_nacimiento instanceof Date
      ? paciente.fecha_nacimiento.toISOString().split('T')[0]
      : String(paciente.fecha_nacimiento).split('T')[0];
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const edadPaciente = Math.floor((hoy - new Date(dobBD + 'T00:00:00')) / (1000 * 60 * 60 * 24 * 365.25));
    if (edadPaciente < 18)
      return res.status(403).json({
        error: 'Usted ya es paciente pero no cumple con los requisitos de registro. Revise la política de privacidad.',
        codigo: 'MENOR_DE_EDAD',
      });

    const iniciales = `${paciente.nombre.charAt(0)}.${paciente.apellido.charAt(0)}.`;
    const docLen = docLimpio.length;
    const documento_parcial = '*'.repeat(Math.max(docLen - 4, 0)) + docLimpio.slice(-4);

    return res.json({ iniciales, tipo_documento: paciente.tipo_documento, documento_parcial });
  } catch (err) {
    console.error('[authPatient.preview]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/patient/vincular  — Vincula cuenta web con historial existente
// ─────────────────────────────────────────────────────────────────────────────
const vincular = async (req, res) => {
  const {
    tipo_documento, numero_documento, fecha_nacimiento,
    email, password, confirmar_password, acepta_politica,
  } = req.body;

  if (!tipo_documento || !numero_documento?.trim() || !fecha_nacimiento ||
      !email?.trim() || !password || !confirmar_password)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  if (!acepta_politica)
    return res.status(400).json({ error: 'Debes aceptar la Política de Privacidad' });

  if (!TIPOS_DOCUMENTO.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  const docLimpio = String(numero_documento).trim();
  if (!validarDocumento(tipo_documento, docLimpio))
    return res.status(400).json({ error: MSG_DOCUMENTO[tipo_documento] });

  const emailLower = String(email).trim().toLowerCase();
  if (!RE_EMAIL.test(emailLower))
    return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido' });

  if (!RE_PASSWORD.test(password))
    return res.status(400).json({
      error: 'La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial',
    });

  if (password !== confirmar_password)
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });

  try {
    // Validar mayoría de edad antes de comparar con BD
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dobIngresada = new Date(fecha_nacimiento + 'T00:00:00');
    if (isNaN(dobIngresada.getTime()) || dobIngresada >= hoy)
      return res.status(400).json({ error: 'La fecha de nacimiento debe ser anterior al día de hoy' });
    const edad = Math.floor((hoy - dobIngresada) / (1000 * 60 * 60 * 24 * 365.25));
    if (edad < 18)
      return res.status(400).json({ error: 'Debes ser mayor de 18 años para vincular tu cuenta' });
    if (edad > 120)
      return res.status(400).json({ error: 'La fecha de nacimiento no es válida' });

    const existente = await findByDocument(tipo_documento, docLimpio);
    if (existente?.estado_cuenta === 'ACTIVO')
      return res.status(409).json({
        error: 'Este documento ya tiene una cuenta activa. Inicia sesión.',
        codigo: 'CUENTA_ACTIVA',
      });

    const paciente = await findByDocumentPreview(tipo_documento, docLimpio);
    if (!paciente)
      return res.status(404).json({ error: 'No se encontró un registro vinculable con ese documento' });

    // Comparar fecha de nacimiento como string YYYY-MM-DD para evitar problemas de zona horaria
    const dobBD = paciente.fecha_nacimiento instanceof Date
      ? paciente.fecha_nacimiento.toISOString().split('T')[0]
      : String(paciente.fecha_nacimiento).split('T')[0];

    if (dobBD !== fecha_nacimiento)  // fecha_nacimiento ya validada arriba
      return res.status(400).json({
        error: 'Los datos no coinciden. Si tienes problemas, comunícate con el consultorio.',
        codigo: 'FECHA_NO_COINCIDE',
      });

    const emailExiste = await findByEmailCuenta(emailLower);
    if (emailExiste)
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.', codigo: 'EMAIL_DUPLICADO' });

    const password_hash = await bcrypt.hash(password, 12);
    await linkWebAccount(paciente.paciente_id, { email_cuenta: emailLower, password_hash });

    sendWelcomePatientEmail(emailLower, paciente.nombre).catch((err) =>
      console.error('[authPatient.vincular] Correo de bienvenida falló:', err.message)
    );

    await logAudit({
      paciente_id: paciente.paciente_id,
      accion:      'VINCULACION_CUENTA_WEB',
      entidad:     'PACIENTE',
      entidad_id:  paciente.paciente_id,
      detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio }),
      ip_origen:   req.ip,
    });

    return res.json({ message: 'Cuenta vinculada exitosamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('[authPatient.vincular]', err.message);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado.' });
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

module.exports = { register, login, logout, preview, vincular };
