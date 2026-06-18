import api from '../api/axios';

export const registerPatient = (data) =>
  api.post('/auth/patient/register', data);
