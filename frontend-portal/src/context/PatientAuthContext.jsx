import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios';

const PatientAuthContext = createContext(null);

export function PatientAuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('patient_user')); }
    catch { return null; }
  });

  const login = useCallback((token, userData) => {
    localStorage.setItem('patient_token', token);
    localStorage.setItem('patient_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/patient/logout'); } catch { /* fire-and-forget */ }
    localStorage.removeItem('patient_token');
    localStorage.removeItem('patient_user');
    setUser(null);
  }, []);

  return (
    <PatientAuthContext.Provider value={{ user, login, logout }}>
      {children}
    </PatientAuthContext.Provider>
  );
}

export const usePatientAuth = () => useContext(PatientAuthContext);
