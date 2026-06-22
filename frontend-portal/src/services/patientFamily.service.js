import api from '../api/axios';

export const getFamiliares      = ()     => api.get('/familiar');
export const registrarFamiliar  = (data) => api.post('/familiar/registrar', data);
