import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }       from '../context/AuthContext';
import PrivateRoute           from './PrivateRoute';
import StaffLoginPage         from '../pages/auth/StaffLoginPage';
import ActivateAccountPage    from '../pages/auth/ActivateAccountPage';
import DashboardPage          from '../pages/DashboardPage';
import RegistroUsuario        from '../pages/admin/RegistroUsuario';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Públicas ── */}
          <Route path="/login"              element={<StaffLoginPage />} />
          <Route path="/activate/:token"    element={<ActivateAccountPage />} />

          {/* ── Protegidas (cualquier staff autenticado) ── */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          } />

          {/* ── Solo Administrador ── */}
          <Route path="/admin/usuarios/nuevo" element={
            <PrivateRoute roles={['ADMINISTRADOR']}>
              <RegistroUsuario />
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
