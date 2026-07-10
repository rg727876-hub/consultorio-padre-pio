import api from '../api/axios';

export const getHistorial          = (pacienteId) => api.get(`/mi-historial/${pacienteId}`);
export const registrarDescargaPDF  = (pacienteId) => api.post(`/mi-historial/${pacienteId}/descarga`);
