const {
  findByDoc, findTitularDoc, createPacienteFamiliar,
  findRelacion, createRelacion, marcarComoFamiliar, getFamiliares,
  getFamiliarDetalle, desvincularRelacion, updateFamiliarInfo,
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

// El ENUM PACIENTE_FAMILIAR.parentesco distingue género (HIJO/HIJA, HERMANO/HERMANA,
// ABUELO/ABUELA), pero la UI ofrece una sola opción combinada ("Hijo/a") para no
// duplicar el selector de género que ya se pide en el mismo formulario. Se resuelve
// aquí el valor exacto antes de guardar. Para sexo='OTRO' (sin forma neutra en el
// ENUM) se usa la forma masculina como fallback.
const PARENTESCO_GENERO = {
  'HIJO/A':    { MASCULINO: 'HIJO',    FEMENINO: 'HIJA'    },
  'HERMANO/A': { MASCULINO: 'HERMANO', FEMENINO: 'HERMANA' },
  'ABUELO/A':  { MASCULINO: 'ABUELO',  FEMENINO: 'ABUELA'  },
};
const resolverParentesco = (parentesco, sexo) => {
  const mapa = PARENTESCO_GENERO[parentesco];
  if (!mapa) return parentesco;
  return mapa[sexo] ?? mapa.MASCULINO;
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
// GET /api/familiar/:id  — Detalle de un familiar (valida relación ACTIVA)
// Registra en auditoría el acceso.
// ─────────────────────────────────────────────────────────────────────────────
const getDetalle = async (req, res) => {
  const titular_id  = req.paciente.id;
  const familiar_id = parseInt(req.params.id, 10);

  if (!familiar_id || isNaN(familiar_id))
    return res.status(400).json({ error: 'ID de familiar inválido' });

  try {
    const familiar = await getFamiliarDetalle(titular_id, familiar_id);
    if (!familiar)
      return res.status(404).json({ error: 'Familiar no encontrado o no vinculado a tu cuenta' });

    await logAudit({
      paciente_id: titular_id,
      accion:      'ACCESO_PERFIL_FAMILIAR',
      entidad:     'PACIENTE',
      entidad_id:  familiar_id,
      detalles:    JSON.stringify({ familiar_id, titular_id }),
      ip_origen:   req.ip,
    });

    return res.json(familiar);
  } catch (err) {
    console.error('[familiar.getDetalle]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/familiar/:id  — Actualiza info de contacto de un familiar
// Valida que el familiar tenga relación ACTIVA con el titular antes de editar.
// ─────────────────────────────────────────────────────────────────────────────
const actualizar = async (req, res) => {
  const titular_id  = req.paciente.id;
  const familiar_id = parseInt(req.params.id, 10);

  if (!familiar_id || isNaN(familiar_id))
    return res.status(400).json({ error: 'ID de familiar inválido' });

  const { telefono, direccion, ocupacion, contacto_emergencia } = req.body;

  // Validaciones
  if (telefono) {
    const tel = String(telefono).replace(/\D/g, '');
    if (!RE_TELEFONO.test(tel))
      return res.status(400).json({ error: 'El teléfono debe tener exactamente 9 dígitos numéricos' });
  }

  if (contacto_emergencia) {
    const telEm = String(contacto_emergencia).replace(/\D/g, '');
    if (!RE_TELEFONO.test(telEm))
      return res.status(400).json({ error: 'El teléfono de emergencia debe tener exactamente 9 dígitos numéricos' });
  }

  try {
    // Verificar relación activa antes de permitir edición
    const familiar = await getFamiliarDetalle(titular_id, familiar_id);
    if (!familiar)
      return res.status(404).json({ error: 'Familiar no encontrado o no vinculado a tu cuenta' });

    await updateFamiliarInfo(familiar_id, {
      telefono:             telefono             ? String(telefono).replace(/\D/g, '')  : null,
      direccion:            direccion            ? String(direccion).trim()              : null,
      ocupacion:            ocupacion            ? String(ocupacion).trim()              : null,
      contacto_emergencia:  contacto_emergencia  ? String(contacto_emergencia).replace(/\D/g, '') : null,
    });

    await logAudit({
      paciente_id: titular_id,
      accion:      'ACTUALIZACION_PERFIL_FAMILIAR',
      entidad:     'PACIENTE',
      entidad_id:  familiar_id,
      detalles:    JSON.stringify({ familiar_id, campos: ['telefono','direccion','ocupacion','contacto_emergencia'] }),
      ip_origen:   req.ip,
    });

    const actualizado = await getFamiliarDetalle(titular_id, familiar_id);
    return res.json(actualizado);
  } catch (err) {
    console.error('[familiar.actualizar]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/familiar/:id/desvincular  — Desvincula al familiar del titular
// Pone estado = 'INACTIVO' y registra fecha_desvinculacion.
// Si el paciente no tiene otros titulares activos, permanece como FAMILIAR (huérfano).
// ─────────────────────────────────────────────────────────────────────────────
const desvincular = async (req, res) => {
  const titular_id  = req.paciente.id;
  const familiar_id = parseInt(req.params.id, 10);

  if (!familiar_id || isNaN(familiar_id))
    return res.status(400).json({ error: 'ID de familiar inválido' });

  try {
    // Verificar relación activa
    const familiar = await getFamiliarDetalle(titular_id, familiar_id);
    if (!familiar)
      return res.status(404).json({ error: 'Familiar no encontrado o no vinculado a tu cuenta' });

    const afectados = await desvincularRelacion(titular_id, familiar_id);
    if (afectados === 0)
      return res.status(409).json({ error: 'La relación ya estaba inactiva' });

    await logAudit({
      paciente_id: titular_id,
      accion:      'DESVINCULACION_FAMILIAR',
      entidad:     'PACIENTE_FAMILIAR',
      entidad_id:  familiar_id,
      detalles:    JSON.stringify({ familiar_id, titular_id, nombre: familiar.nombre, apellido: familiar.apellido }),
      ip_origen:   req.ip,
    });

    return res.json({ message: 'Familiar desvinculado correctamente' });
  } catch (err) {
    console.error('[familiar.desvincular]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/familiar/registrar  — Registra o vincula un familiar
// ─────────────────────────────────────────────────────────────────────────────
const registrar = async (req, res) => {
  const {
    parentesco, tipo_documento, numero_documento,
    nombre, apellido, fecha_nacimiento, sexo, contacto_emergencia,
    confirmar,
  } = req.body;

  const titular_id = req.paciente.id;

  if (!parentesco || !tipo_documento || !numero_documento?.trim())
    return res.status(400).json({ error: 'Parentesco, tipo y número de documento son obligatorios' });

  if (!PARENTESCOS.includes(parentesco))
    return res.status(400).json({ error: 'Parentesco no válido' });

  if (!TIPOS_DOCUMENTO.includes(tipo_documento))
    return res.status(400).json({ error: 'Tipo de documento no válido' });

  const docLimpio = String(numero_documento).trim();
  if (!validarDocumento(tipo_documento, docLimpio))
    return res.status(400).json({ error: msgDocumento(tipo_documento) });

  if (!confirmar) {
    if (!nombre?.trim() || !apellido?.trim() || !fecha_nacimiento || !sexo || !contacto_emergencia?.trim())
      return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });

    if (!SEXOS.includes(sexo))
      return res.status(400).json({ error: 'Género no válido' });

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dob = new Date(fecha_nacimiento + 'T00:00:00');
    if (isNaN(dob.getTime()) || dob >= hoy)
      return res.status(400).json({ error: 'La fecha de nacimiento debe ser anterior al día de hoy' });

    // Todo paciente debe tener al menos un medio de contacto propio (además del
    // titular vinculado, que puede desvincularse más adelante y dejarlo huérfano).
    const telLimpio = String(contacto_emergencia).replace(/\D/g, '');
    if (!RE_TELEFONO.test(telLimpio))
      return res.status(400).json({ error: 'El contacto de emergencia debe tener exactamente 9 dígitos' });
  }

  try {
    const titularDoc = await findTitularDoc(titular_id);
    if (
      titularDoc?.tipo_documento === tipo_documento &&
      titularDoc?.numero_documento === docLimpio
    ) return res.status(400).json({ error: 'No puedes registrarte a ti mismo como familiar' });

    const existente = await findByDoc(tipo_documento, docLimpio);

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
      const parentescoResuelto = resolverParentesco(parentesco, sexo);
      await createRelacion(titular_id, familiar_id, parentescoResuelto);
      await logAudit({
        paciente_id: titular_id,
        accion:      'REGISTRO_FAMILIAR',
        entidad:     'PACIENTE_FAMILIAR',
        entidad_id:  familiar_id,
        detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio, parentesco: parentescoResuelto, operacion: 'REGISTRO_NUEVO' }),
        ip_origen:   req.ip,
      });
      return res.status(201).json({ message: 'Familiar registrado correctamente' });
    }

    const relExistente = await findRelacion(titular_id, existente.paciente_id);
    if (relExistente?.estado === 'ACTIVO')
      return res.status(409).json({
        error: 'Este familiar ya está en tu lista de vinculados.',
        codigo: 'YA_VINCULADO',
      });

    if (existente.estado_cuenta === 'ACTIVO')
      return res.status(409).json({
        error: 'Este DNI ya tiene una cuenta web propia y no puede ser vinculado como familiar.',
        codigo: 'TIENE_CUENTA_ACTIVA',
      });

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
      await marcarComoFamiliar(existente.paciente_id);
      const parentescoResuelto = resolverParentesco(parentesco, existente.sexo);
      await createRelacion(titular_id, existente.paciente_id, parentescoResuelto);
      await logAudit({
        paciente_id: titular_id,
        accion:      'VINCULACION_FAMILIAR',
        entidad:     'PACIENTE_FAMILIAR',
        entidad_id:  existente.paciente_id,
        detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio, parentesco: parentescoResuelto, operacion: 'VINCULACION_SIN_CUENTA' }),
        ip_origen:   req.ip,
      });
      return res.json({ message: 'Familiar vinculado a tu cuenta correctamente' });
    }

    if (existente.estado_cuenta === 'FAMILIAR') {
      const parentescoResuelto = resolverParentesco(parentesco, existente.sexo);
      await createRelacion(titular_id, existente.paciente_id, parentescoResuelto);
      await logAudit({
        paciente_id: titular_id,
        accion:      'VINCULACION_FAMILIAR',
        entidad:     'PACIENTE_FAMILIAR',
        entidad_id:  existente.paciente_id,
        detalles:    JSON.stringify({ tipo_documento, numero_documento: docLimpio, parentesco: parentescoResuelto, operacion: 'VINCULACION_FAMILIAR_EXISTENTE' }),
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

module.exports = { listar, registrar, getDetalle, actualizar, desvincular };
