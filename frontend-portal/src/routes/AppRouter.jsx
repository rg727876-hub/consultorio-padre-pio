import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage from '../pages/auth/RegisterPage';

function Placeholder({ titulo }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-md p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold text-primary mb-2">{titulo}</h1>
        <p className="text-slate-500 text-sm">
          Esta página se construirá en las próximas HUs
        </p>
      </div>
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Placeholder titulo="Login Paciente (HU002)" />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/mis-citas" element={<Placeholder titulo="Mis Citas (HU005)" />} />
        <Route path="/"         element={<Navigate to="/login" />} />
        <Route path="*"         element={<Placeholder titulo="404 - Página no encontrada" />} />
      </Routes>
    </BrowserRouter>
  );
}
