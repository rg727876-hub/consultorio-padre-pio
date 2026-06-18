const bcrypt = require('bcryptjs');
const { findByDocument, findByEmailCuenta, registerWebAccount } = require('../models/patient.model');
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

module.exports = { register };
