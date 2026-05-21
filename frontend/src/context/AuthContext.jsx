import { createContext, useState } from 'react';
import api from '../api/axios';

export const AuthContext = createContext();

function readStoredUser() {
    try {
        const saved = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (saved && token) return JSON.parse(saved);
    } catch { /* JSON corrupto → ignorar */ }
    return null;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(readStoredUser);
    const loading = false;

  // Login para staff (email + password)
    const loginStaff = async (email, password) => {
        const { data } = await api.post('/auth/staff/login', { email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        return data;
    };

  // Login para paciente (tipo_doc + numero_doc + password)
    const loginPatient = async (tipo_documento, numero_documento, password) => {
        const { data } = await api.post('/auth/patient/login', {
            tipo_documento, numero_documento, password
        });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
    <AuthContext.Provider value={{
        user, loading, loginStaff, loginPatient, logout
    }}>
        {children}
        </AuthContext.Provider>
    );
}