import api from '../api/axios';

export const getFamiliares        = ()          => api.get('/familiar');
export const registrarFamiliar    = (data)      => api.post('/familiar/registrar', data);
export const getFamiliarDetalle   = (id)        => api.get(`/familiar/${id}`);
export const updateFamiliar       = (id, data)  => api.patch(`/familiar/${id}`, data);
export const desvincularFamiliar  = (id)        => api.patch(`/familiar/${id}/desvincular`);
