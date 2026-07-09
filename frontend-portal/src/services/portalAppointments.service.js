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
