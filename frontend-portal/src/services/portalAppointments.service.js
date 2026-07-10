import api from '../api/axios';

export const getDoctoresPorServicio = (servicioId) =>
  api.get('/portal/appointments/doctors', { params: { servicio_id: servicioId } });

export const getDisponibilidad = (doctorId, servicioId, fecha) =>
  api.get('/portal/appointments/slots', { params: { doctor_id: doctorId, servicio_id: servicioId, fecha } });

export const crearHold = (data) =>
  api.post('/portal/appointments/hold', data);

export const liberarHold = (holdId) =>
  api.delete(`/portal/appointments/hold/${holdId}`);

export const confirmarPago = (data) =>
  api.post('/portal/appointments/confirm-payment', data);

// ── Mis citas (WEB-HU004) ────────────────────────────────────────────────────
export const getMisCitas = (pacienteId, tipo = 'proximas') =>
  api.get('/portal/appointments', { params: { paciente_id: pacienteId, tipo } });

export const getCitaDetalle = (citaId) =>
  api.get(`/portal/appointments/${citaId}`);

export const anularCita = (citaId) =>
  api.patch(`/portal/appointments/${citaId}/cancel`);

export const reprogramarCita = (citaId, data) =>
  api.patch(`/portal/appointments/${citaId}/reschedule`, data);
