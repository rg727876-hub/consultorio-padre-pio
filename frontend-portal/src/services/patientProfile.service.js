import api from '../api/axios';

export const getProfile   = ()     => api.get('/patient/me');
export const updateProfile = (data) => api.patch('/patient/me', data);
export const uploadPhotoProfile = (formData) => api.post('/patient/me/foto', formData);
