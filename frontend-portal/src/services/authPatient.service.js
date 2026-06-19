import api from '../api/axios';

export const registerPatient = (data) =>
  api.post('/auth/patient/register', data);

export const loginPatient = (data) =>
  api.post('/auth/patient/login', data);
