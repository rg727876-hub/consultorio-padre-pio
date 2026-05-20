import { createContext, useState, useEffect } from 'react';
import api from '../api/axios';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
    if (savedUser && token) {
        setUser(JSON.parse(savedUser));
    }
        setLoading(false);
    }, []);

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