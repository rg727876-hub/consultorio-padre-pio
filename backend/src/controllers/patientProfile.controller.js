const { findProfileById, updateContactInfo } = require('../models/patient.model');
const { logAudit } = require('../utils/audit.util');

const RE_TELEFONO = /^\d{9}$/;
const isDev = process.env.NODE_ENV !== 'production';

const getProfile = async (req, res) => {
  try {
    const paciente = await findProfileById(req.paciente.id);
    if (!paciente)
      return res.status(404).json({ error: 'Perfil no encontrado' });

    await logAudit({
      paciente_id: paciente.paciente_id,
      accion:      'ACCESO_PERFIL_PACIENTE',
      entidad:     'PACIENTE',
      entidad_id:  paciente.paciente_id,
      ip_origen:   req.ip,
    });

    return res.json(paciente);
  } catch (err) {
    console.error('[patientProfile.getProfile]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

const updateProfile = async (req, res) => {
  const { telefono, direccion, ocupacion, contacto_emergencia } = req.body;
  const pacienteId = req.paciente.id;

  const tel = String(telefono ?? '').replace(/\D/g, '');
  if (!RE_TELEFONO.test(tel))
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 9 dígitos numéricos' });

  if (!direccion?.trim())
    return res.status(400).json({ error: 'La dirección es obligatoria' });

  if (contacto_emergencia) {
    const telEm = String(contacto_emergencia).replace(/\D/g, '');
    if (!RE_TELEFONO.test(telEm))
      return res.status(400).json({ error: 'El teléfono de emergencia debe tener exactamente 9 dígitos numéricos' });
  }

  try {
    await updateContactInfo(pacienteId, {
      telefono: tel,
      direccion: String(direccion).trim(),
      ocupacion: ocupacion ? String(ocupacion).trim() : null,
      contacto_emergencia: contacto_emergencia ? String(contacto_emergencia).trim() : null,
    });

    await logAudit({
      paciente_id: pacienteId,
      accion:      'ACTUALIZACION_PERFIL_PACIENTE',
      entidad:     'PACIENTE',
      entidad_id:  pacienteId,
      detalles:    JSON.stringify({ campos: ['telefono', 'direccion', 'ocupacion', 'contacto_emergencia'] }),
      ip_origen:   req.ip,
    });

    const updated = await findProfileById(pacienteId);
    return res.json(updated);
  } catch (err) {
    console.error('[patientProfile.updateProfile]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  }
};

module.exports = { getProfile, updateProfile };
