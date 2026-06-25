import api from '../api/axios';

export const getServiciosPublicos = () => api.get('/public/servicios');
export const getDoctoresPublicos  = () => api.get('/public/doctores');
