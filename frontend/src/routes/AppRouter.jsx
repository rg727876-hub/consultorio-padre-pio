import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PrivateRoute from './PrivateRoute';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';

export default function AppRouter() {
    return (
    <BrowserRouter>
        <AuthProvider>
        <Routes>
          {/* Pública */}
            <Route path="/login" element={<LoginPage />} />

          {/* Protegidas */}
            <Route path="/dashboard" element={
            <PrivateRoute>
                <DashboardPage />
            </PrivateRoute>
            } />

          {/* Agrega más rutas conforme desarrolles cada módulo */}
            {/*
            <Route path="/patients" element={
            <PrivateRoute roles={['ADMINISTRADOR', 'RECEPCIONISTA']}>
                <PatientListPage />
            </PrivateRoute>
            } />
          */}

            <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
        </AuthProvider>
    </BrowserRouter>
    );
}