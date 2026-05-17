import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Users, Calendar, Stethoscope, ClipboardList,
  CreditCard, BarChart2, LogOut, Menu, X,
  Home, ChevronRight, Clock,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import logo from '../assets/images/Logo-Consultorio-Padre-Pio.png';

// ── Módulos por rol ──────────────────────────────────────────────
const MODULOS = {
  ADMINISTRADOR: [
    {
      label:       'Registrar usuario',
      descripcion: 'Crea cuentas para doctores, recepcionistas y cajeros',
      icon:        UserPlus,
      color:       'bg-blue-50 text-[#0059B3]',
      ruta:        '/admin/usuarios/nuevo',
    },
    {
      label:       'Gestionar usuarios',
      descripcion: 'Ver, editar o desactivar cuentas del personal',
      icon:        Users,
      color:       'bg-indigo-50 text-indigo-600',
      ruta:        '/admin/usuarios',
      proximamente: true,
    },
    {
      label:       'Registrar servicio',
      descripcion: 'Agrega nuevos servicios dentales al sistema',
      icon:        Stethoscope,
      color:       'bg-green-50 text-green-700',
      ruta:        '/admin/servicios/nuevo',
    },
    {
      label:       'Gestionar servicios',
      descripcion: 'Ver, editar o cambiar el estado de los servicios',
      icon:        ClipboardList,
      color:       'bg-teal-50 text-teal-600',
      ruta:        '/admin/servicios',
    },
    {
      label:       'Horarios de doctores',
      descripcion: 'Define los bloques de disponibilidad semanal por doctor',
      icon:        Clock,
      color:       'bg-orange-50 text-orange-600',
      ruta:        '/admin/horarios',
    },
    {
      label:       'Reportes',
      descripcion: 'Estadísticas de atenciones y facturación',
      icon:        BarChart2,
      color:       'bg-purple-50 text-purple-600',
      ruta:        '/admin/reportes',
      proximamente: true,
    },
  ],
  RECEPCIONISTA: [
    {
      label:       'Registrar paciente',
      descripcion: 'Crear historial de nuevo paciente',
      icon:        UserPlus,
      color:       'bg-blue-50 text-[#0059B3]',
      ruta:        '/recepcion/pacientes/nuevo',
      proximamente: true,
    },
    {
      label:       'Agendar cita',
      descripcion: 'Reservar cita con un doctor',
      icon:        Calendar,
      color:       'bg-green-50 text-green-700',
      ruta:        '/recepcion/citas/nueva',
      proximamente: true,
    },
  ],
  DOCTOR: [
    {
      label:       'Mis citas',
      descripcion: 'Ver agenda del día y próximas citas',
      icon:        Calendar,
      color:       'bg-blue-50 text-[#0059B3]',
      ruta:        '/doctor/citas',
      proximamente: true,
    },
  ],
  CAJERO: [
    {
      label:       'Registrar pago',
      descripcion: 'Procesar cobros de consultas',
      icon:        CreditCard,
      color:       'bg-green-50 text-green-700',
      ruta:        '/caja/pagos/nuevo',
      proximamente: true,
    },
  ],
};

const ROL_LABELS = {
  ADMINISTRADOR: 'Administrador',
  DOCTOR:        'Doctor',
  RECEPCIONISTA: 'Recepcionista',
  CAJERO:        'Cajero',
};

// ── Componente principal ─────────────────────────────────────────
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const modulos = MODULOS[user?.rol] ?? [];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Topbar ── */}
      <header className="bg-[#0059B3] text-white shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">

          {/* Logo + nombre */}
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Padre Pio"
              className="h-9 w-auto object-contain brightness-0 invert"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <div className="hidden sm:block leading-tight">
              <p className="text-sm font-bold tracking-tight">Consultorio Padre Pio</p>
              <p className="text-[10px] text-blue-200 uppercase tracking-widest">
                Sistema de gestión
              </p>
            </div>
          </div>

          {/* Info usuario + logout (desktop) */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">
                {user?.nombre} {user?.apellido}
              </p>
              <p className="text-xs text-blue-200">
                {ROL_LABELS[user?.rol] ?? user?.rol}
              </p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20
                         px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut size={15} />
              Salir
            </button>
          </div>

          {/* Menú hamburguesa (mobile) */}
          <button
            className="sm:hidden p-1"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Menú mobile desplegable */}
        {menuOpen && (
          <div className="sm:hidden bg-[#004a99] px-4 py-3 border-t border-blue-400 space-y-3">
            <p className="text-sm font-semibold">
              {user?.nombre} {user?.apellido}
            </p>
            <p className="text-xs text-blue-200">{ROL_LABELS[user?.rol]}</p>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {/* ── Contenido principal ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">

        {/* Bienvenida */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Home size={12} />
            <ChevronRight size={12} />
            <span>Panel principal</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">
            Bienvenido, {user?.nombre}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {user?.rol === 'ADMINISTRADOR'
              ? 'Tienes acceso completo al sistema. ¿Qué deseas hacer hoy?'
              : `Estás en el panel de ${ROL_LABELS[user?.rol]?.toLowerCase()}.`}
          </p>
        </div>

        {/* Tarjetas de módulos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modulos.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.label}
                onClick={() => !mod.proximamente && navigate(mod.ruta)}
                disabled={mod.proximamente}
                className={`relative text-left bg-white rounded-2xl shadow-sm p-5
                            border border-transparent transition-all duration-200
                            ${mod.proximamente
                              ? 'opacity-60 cursor-not-allowed'
                              : 'hover:border-[#0059B3]/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                            }`}
              >
                {mod.proximamente && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold
                                   bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                    Próximamente
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                                 mb-3 ${mod.color}`}>
                  <Icon size={20} />
                </div>
                <p className="font-semibold text-slate-800 text-sm mb-1">{mod.label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{mod.descripcion}</p>
                {!mod.proximamente && (
                  <div className="flex items-center gap-1 mt-3 text-[#0059B3] text-xs font-medium">
                    Abrir <ChevronRight size={13} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="text-center text-[11px] text-slate-400 py-4">
        © {new Date().getFullYear()} Consultorio Padre Pio · Todos los derechos reservados
      </footer>
    </div>
  );
}
