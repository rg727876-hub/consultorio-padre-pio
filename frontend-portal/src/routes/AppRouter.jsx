import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PatientAuthProvider, usePatientAuth } from '../context/PatientAuthContext';
import RegisterPage from '../pages/auth/RegisterPage';
import LoginPage    from '../pages/auth/LoginPage';
import ProfilePage  from '../pages/profile/ProfilePage';

function ProtectedRoute({ children }) {
  const { user } = usePatientAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user } = usePatientAuth();
  if (user) return <Navigate to="/perfil" replace />;
  return children;
}

export default function AppRouter() {
  return (
    <PatientAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/perfil"   element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/"         element={<Navigate to="/perfil" replace />} />
          <Route path="*"         element={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-md">
                <h1 className="text-2xl font-bold text-primary mb-2">404 — Página no encontrada</h1>
                <a href="/login" className="text-sm text-primary underline">Volver al inicio</a>
              </div>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </PatientAuthProvider>
  );
}
