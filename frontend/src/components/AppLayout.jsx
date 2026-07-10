import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  UserPlus, Calendar, Stethoscope, CreditCard,
  LogOut, Menu, X, Home, Clock, ChevronRight, Receipt, List, CalendarSearch, LayoutGrid, Users,
  UserCog, FileClock, BarChart2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import logo from '../assets/images/Logo-Consultorio-Padre-Pio.png';

const NAV = {
  ADMINISTRADOR: [
    { label: 'Inicio',               icon: Home,          ruta: '/dashboard' },
    { label: 'Gestion de Personal',  icon: Users,         ruta: '/admin/usuarios' },
    { label: 'Gestion de Doctores',  icon: UserCog,       ruta: '/admin/doctores' },
    { label: 'Registrar usuario',    icon: UserPlus,      ruta: '/admin/usuarios/nuevo' },
    { label: 'Registrar servicio',   icon: Stethoscope,   ruta: '/admin/servicios/nuevo' },
    { label: 'Gestionar servicios',  icon: List,          ruta: '/admin/servicios' },
    { label: 'Horarios de doctores', icon: Clock,         ruta: '/admin/horarios' },
    { label: 'Gestión de pacientes', icon: Users,         ruta: '/recepcion/pacientes' },
    { label: 'Reportes',             icon: BarChart2,     ruta: '/admin/reportes' },
  ],
  RECEPCIONISTA: [
    { label: 'Inicio',               icon: Home,          ruta: '/dashboard' },
    { label: 'Registrar paciente',   icon: UserPlus,      ruta: '/recepcion/pacientes/nuevo' },
    { label: 'Gestión de pacientes', icon: Users,         ruta: '/recepcion/pacientes' },
    { label: 'Agendar cita',         icon: Calendar,      ruta: '/recepcion/citas/nueva' },
    { label: 'Gestión de citas',     icon: CalendarSearch, ruta: '/recepcion/citas' },
    { label: 'Agenda médica',        icon: LayoutGrid,    ruta: '/recepcion/agenda' },
  ],
  DOCTOR: [
    { label: 'Inicio',            icon: Home,      ruta: '/dashboard' },
    { label: 'Mi agenda',         icon: Calendar,  ruta: '/doctor/agenda' },
    { label: 'Historial clínico', icon: FileClock, ruta: '/doctor/historial' },
  ],
  CAJERO: [
    { label: 'Inicio',           icon: Home,       ruta: '/dashboard'           },
    { label: 'Registrar pago',   icon: CreditCard, ruta: '/caja/pagos/nuevo'    },
    { label: 'Pagos y comprobantes', icon: Receipt,ruta: '/caja/pagos'          },
  ],
};

const ROL_LABELS = {
  ADMINISTRADOR: 'Administrador',
  DOCTOR:        'Doctor',
  RECEPCIONISTA: 'Recepcionista',
  CAJERO:        'Cajero',
};

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [open, setOpen]  = useState(false);

  const items = NAV[user?.rol] ?? [{ label: 'Inicio', icon: Home, ruta: '/dashboard' }];

  const navLinks = items.map(({ label, icon: Icon, ruta }) => {
    const active = location.pathname === ruta;

    return (
      <button
        key={ruta}
        onClick={() => { navigate(ruta); setOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                    font-medium transition-colors duration-150
                    ${active
                      ? 'bg-[#0059B3] text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
      >
        <Icon size={17} className="flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {active && <ChevronRight size={14} className="flex-shrink-0" />}
      </button>
    );
  });

  const userBlock = (
    <div className="border-t border-slate-200 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#0059B3]/10 flex items-center justify-center
                        text-[#0059B3] text-xs font-bold flex-shrink-0 select-none">
          {(user?.nombre?.[0] ?? '') + (user?.apellido?.[0] ?? '')}
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {user?.nombre} {user?.apellido}
          </p>
          <p className="text-xs text-slate-400">{ROL_LABELS[user?.rol] ?? user?.rol}</p>
        </div>
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500
                     transition-colors flex-shrink-0"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  const logoBlock = (
    <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200 flex-shrink-0">
      <img
        src={logo}
        alt="Padre Pio"
        className="h-8 w-auto object-contain"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
      <div className="leading-tight">
        <p className="text-xs font-bold text-slate-800 tracking-tight">Consultorio</p>
        <p className="text-xs font-bold text-[#0059B3] tracking-tight">Padre Pio</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/40">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-200
                        fixed top-0 left-0 h-full z-20 shadow-sm">
        {logoBlock}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navLinks}
        </nav>
        {userBlock}
      </aside>

      {/* ── Sidebar móvil overlay ── */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200
                            z-40 flex flex-col shadow-xl lg:hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-700">Menú</p>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {navLinks}
            </nav>
            {userBlock}
          </aside>
        </>
      )}

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col lg:ml-60 min-w-0">

        {/* Topbar móvil */}
        <header className="lg:hidden bg-[#0059B3] text-white shadow-md sticky top-0 z-20
                           flex items-center gap-3 px-4 py-3">
          <button onClick={() => setOpen(true)} className="p-1 flex-shrink-0">
            <Menu size={22} />
          </button>
          <img
            src={logo}
            alt="Padre Pio"
            className="h-7 w-auto object-contain brightness-0 invert flex-shrink-0"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <p className="text-sm font-bold flex-1 truncate">Consultorio Padre Pio</p>
          <button
            onClick={logout}
            title="Salir"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <LogOut size={16} />
          </button>
        </header>

        {/* Contenido de página — se reanima en cada navegación */}
        <main key={location.pathname} className="flex-1 min-w-0 animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}
