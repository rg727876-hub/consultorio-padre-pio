import { useAuth } from '../hooks/useAuth';

const ROL_LABELS = {
  ADMINISTRADOR: 'Administrador',
  DOCTOR:        'Doctor',
  RECEPCIONISTA: 'Recepcionista',
  CAJERO:        'Cajero',
};

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
      <div className="bg-white rounded-2xl shadow-md px-8 py-6 text-center max-w-sm w-full">
        <h1 className="text-xl font-bold text-[#1B3A6B] mb-1">
          Bienvenido, {user?.nombre ?? 'Usuario'}
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          Rol: <span className="font-medium text-gray-700">{ROL_LABELS[user?.rol] ?? user?.rol}</span>
        </p>
        <p className="text-xs text-gray-400 mb-6">
          El dashboard está en construcción. Sprint 1 en progreso.
        </p>
        <button
          onClick={logout}
          className="w-full bg-red-500 hover:bg-red-600 text-white text-sm
                     font-medium py-2 rounded-lg transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
