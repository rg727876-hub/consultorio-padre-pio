const {
  findByDoc, findTitularDoc, createPacienteFamiliar,
  findRelacion, createRelacion, marcarComoFamiliar, getFamiliares,
} = require('../models/familiar.model');
const { logAudit } = require('../utils/audit.util');

const isDev = process.env.NODE_ENV !== 'production';

const TIPOS_DOCUMENTO = ['DNI', 'CE', 'PASAPORTE'];
const PARENTESCOS     = ['HIJO/A','CONYUGE','PADRE','MADRE','HERMANO/A','ABUELO/A','OTRO'];
const SEXOS           = ['MASCULINO', 'FEMENINO', 'OTRO'];
const RE_DNI          = /^\d{8}$/;
const RE_CE           = /^[A-Za-z0-9]{9,12}$/;
const RE_PASAPORTE    = /^[A-Za-z0-9]{6,12}$/;
const RE_TELEFONO     = /^\d{9}$/;

const validarDocumento = (tipo, numero) => {
  if (tipo === 'DNI')       return RE_DNI.test(numero);
  if (tipo === 'CE')        return RE_CE.test(numero);
  if (tipo === 'PASAPORTE') return RE_PASAPORTE.test(numero);
  return false;
};

const msgDocumento = (tipo) => {
  if (tipo === 'DNI')       return 'El DNI debe tener exactamente 8 dígitos numéricos';
  if (tipo === 'CE')        return 'El CE debe tener entre 9 y 12 caracteres alfanuméricos';
  if (tipo === 'PASAPORTE') return 'El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos';
  return 'Tipo de documento no válido';
};

const calcEdad = (fechaNac) => {
  const raw = fechaNac instanceof Date
    ? fechaNac.toISOString().split('T')[0]
    : String(fechaNac).split('T')[0];
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy - new Date(raw + 'T00:00:00')) / (1000 * 60 * 60 * 24 * 365.25));
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/familiar  — Lista familiares activos del titular autenticado
// ─────────────────────────────────────────────────────────────────────────────
const listar = async (req, res) => {
  try {
    const familiares = await getFamiliares(req.paciente.id);
    return res.json({ familiares });
  } catch (err) {
    console.error('[familiar.listar]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/familiar/registrar  — Registra o vincula un familiar
//
// Paso 1 (confirmar ausente o false):
//   Valida todos los campos, busca en BD, maneja subcasos.
//   Si B1 (SIN_CUENTA): devuelve 200 { requiere_confirmacion: true, candidato }
//   para que el frontend muestre el modal de confirmación.
//
// Paso 2 (confirmar = true):
//   Solo necesita parentesco + documento; vincula directamente (B1 confirmado).
// ─────────────────────────────────────────────────────────────────────────────
const registrar = async (req, res) => {
  const {
    parentesco, tipo_documento, numero_documento,
    nombre, apellido, fecha_nacimiento, sexo, contacto_emergencia,
    confirmar,
  } = req.body;

  const titular_id = req.paciente.id;

  // ── Siempre obligatorios ──────────────────────────────────────────────────
  if (!parentesco || !tipo_documento || !numero_documento?.trim())
    return res.status(400).json({ error: 'Parentesco, tipo y número de documento son obligatorios' });

  if (!PARENTESCOS.includes(parentesco))
    return res.status(400).json({ error: 'Parentesco no válido' });

  if (!TIPOS_DOCUMENTO.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  const docLimpio = String(numero_documento).trim();
  if (!validarDocumento(tipo_documento, docLimpio))
    return res.status(400).json({ error: msgDocumento(tipo_documento) });

  // ── Validaciones solo en el primer paso (cuando se crean datos nuevos) ────
  if (!confirmar) {
    if (!nombre?.trim() || !apellido?.trim() || !fecha_nacimiento || !sexo)
      return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });

    if (!SEXOS.includes(sexo))
      return res.status(400).json({ error: 'Género no válido' });

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dob = new Date(fecha_nacimiento + 'T00:00:00');
    if (isNaN(dob.getTime()) || dob >= hoy)
      return res.status(400).json({ error: 'La fecha de nacimiento debe ser anterior al día de hoy' });

    if (contacto_emergencia) {
      const telLimpio = String(contacto_emergencia).replace(/\D/g, '');
      if (!RE_TELEFONO.test(telLimpio))
        return res.status(400).json({ error: 'El contacto de emergencia debe tener exactamente 9 dígitos' });
    }
  }

  try {
    // ── El familiar no puede tener el mismo documento que el titular ──────
    const titularDoc = await findTitularDoc(titular_id);
    if (
      titularDoc?.tipo_documento === tipo_documento &&
      titularDoc?.numero_documento === docLimpio
    ) return res.status(400).json({ error: 'No puedes registrarte a ti mismo como familiar' });

    const existente = await findByDoc(tipo_documento, docLimpio);

    // ── CASO A: paciente no existe → crear nuevo con estado FAMILIAR ──────
    if (!existente) {
      const familiar_id = await createPacienteFamiliar({
        nombre:               String(nombre).trim().toUpperCase(),
        apellido:             String(apellido).trim().toUpperCase(),
        tipo_documento,
        numero_documento:     docLimpio,
        fecha_nacimiento,
        sexo,
        contacto_emergencia:  contacto_emergencia ? String(contacto_emergencia).replace(/\D/g, '') : null,
      });
      await createRelacion(titular_id, familiar_id, parentesco);
      await logAudit({
        paciente_id: titular_id,
        accion:      'REGISTRO_FAMILIAR',
        entidad:     'PACIENTE_FAMILIAR',
        entidad_id:  familiar_id,
        detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio, parentesco, operacion: 'REGISTRO_NUEVO' }),
        ip_origen:   req.ip,
      });
      return res.status(201).json({ message: 'Familiar registrado correctamente' });
    }

    // ── B3: relación activa ya existe con este titular ────────────────────
    const relExistente = await findRelacion(titular_id, existente.paciente_id);
    if (relExistente?.estado === 'ACTIVO')
      return res.status(409).json({
        error: 'Este familiar ya está en tu lista de vinculados.',
        codigo: 'YA_VINCULADO',
      });

    // ── B2: paciente tiene cuenta web activa propia ───────────────────────
    if (existente.estado_cuenta === 'ACTIVO')
      return res.status(409).json({
        error: 'Este DNI ya tiene una cuenta web propia y no puede ser vinculado como familiar.',
        codigo: 'TIENE_CUENTA_ACTIVA',
      });

    // ── B1: registrado presencialmente sin cuenta web ─────────────────────
    if (existente.estado_cuenta === 'SIN_CUENTA') {
      if (!confirmar) {
        return res.json({
          requiere_confirmacion: true,
          candidato: {
            nombre:   existente.nombre,
            apellido: existente.apellido,
            edad:     calcEdad(existente.fecha_nacimiento),
          },
        });
      }
      // Paso 2: confirmado por el titular
      await marcarComoFamiliar(existente.paciente_id);
      await createRelacion(titular_id, existente.paciente_id, parentesco);
      await logAudit({
        paciente_id: titular_id,
        accion:      'VINCULACION_FAMILIAR',
        entidad:     'PACIENTE_FAMILIAR',
        entidad_id:  existente.paciente_id,
        detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio, parentesco, operacion: 'VINCULACION_SIN_CUENTA' }),
        ip_origen:   req.ip,
      });
      return res.json({ message: 'Familiar vinculado a tu cuenta correctamente' });
    }

    // ── B4: ya es FAMILIAR de otro titular → permitir vinculación múltiple ─
    if (existente.estado_cuenta === 'FAMILIAR') {
      await createRelacion(titular_id, existente.paciente_id, parentesco);
      await logAudit({
        paciente_id: titular_id,
        accion:      'VINCULACION_FAMILIAR',
        entidad:     'PACIENTE_FAMILIAR',
        entidad_id:  existente.paciente_id,
        detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio, parentesco, operacion: 'VINCULACION_FAMILIAR_EXISTENTE' }),
        ip_origen:   req.ip,
      });
      return res.json({ message: 'Familiar vinculado a tu cuenta correctamente' });
    }

    return res.status(422).json({ error: 'Estado de cuenta del paciente no reconocido' });

  } catch (err) {
    console.error('[familiar.registrar]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

module.exports = { listar, registrar };
