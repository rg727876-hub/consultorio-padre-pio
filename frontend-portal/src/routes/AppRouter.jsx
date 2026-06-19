import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { PatientAuthProvider, usePatientAuth } from '../context/PatientAuthContext';
import RegisterPage from '../pages/auth/RegisterPage';
import LoginPage    from '../pages/auth/LoginPage';

// ── Ruta protegida: redirige a /login si no hay sesión ───────────────────────
function ProtectedRoute({ children }) {
  const { user } = usePatientAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// ── Panel placeholder con botón de cerrar sesión ─────────────────────────────
function PanelPlaceholder({ titulo }) {
  const { user, logout } = usePatientAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold text-primary mb-1">{titulo}</h1>
        {user && (
          <p className="text-slate-500 text-sm mb-4">
            Hola, <span className="font-medium">{user.nombre} {user.apellido}</span>
          </p>
        )}
        <p className="text-slate-400 text-sm">Esta página se construirá en las próximas HUs</p>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-slate-500 hover:text-red-600 underline transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

export default function AppRouter() {
  return (
    <PatientAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/mis-citas" element={
            <ProtectedRoute>
              <PanelPlaceholder titulo="Mis Citas (HU005)" />
            </ProtectedRoute>
          } />
          <Route path="/"  element={<Navigate to="/login" />} />
          <Route path="*"  element={
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
