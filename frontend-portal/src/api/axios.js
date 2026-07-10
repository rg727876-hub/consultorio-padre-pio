import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 40000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('patient_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes('/auth/');
    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('patient_token');
      localStorage.removeItem('patient_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;