import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PrivateRoute from './PrivateRoute';
import StaffLoginPage from '../pages/auth/StaffLoginPage';
import ActivateAccountPage from '../pages/auth/ActivateAccountPage';
import DashboardPage from '../pages/DashboardPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<StaffLoginPage />} />
          <Route path="/activate/:token" element={<ActivateAccountPage />} />

          {/* Protegidas */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          } />

          {/* Agrega rutas conforme desarrolles cada módulo */}

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}