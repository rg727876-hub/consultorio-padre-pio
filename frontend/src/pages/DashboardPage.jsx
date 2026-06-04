import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  UserPlus, Users, Calendar, Stethoscope, ClipboardList,
  CreditCard, BarChart2, ChevronRight, Clock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDotCursor } from '../hooks/useDotCursor';
import api from '../api/axios';
import AppLayout from '../components/AppLayout';

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
      label:        'Gestionar usuarios',
      descripcion:  'Ver, editar o desactivar cuentas del personal',
      icon:         Users,
      color:        'bg-indigo-50 text-indigo-600',
      ruta:         '/admin/usuarios',
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
      label:        'Reportes',
      descripcion:  'Estadísticas de atenciones y facturación',
      icon:         BarChart2,
      color:        'bg-purple-50 text-purple-600',
      ruta:         '/admin/reportes',
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
    },
    {
      label:       'Agendar cita',
      descripcion: 'Reservar cita con un doctor',
      icon:        Calendar,
      color:       'bg-green-50 text-green-700',
      ruta:        '/recepcion/citas/nueva',
    },
    {
      label:       'Gestión de citas',
      descripcion: 'Listar, buscar, cancelar o reprogramar citas',
      icon:        ClipboardList,
      color:       'bg-indigo-50 text-indigo-600',
      ruta:        '/recepcion/citas',
    },
  ],
  DOCTOR: [
    {
      label:        'Mis citas',
      descripcion:  'Ver agenda del día y próximas citas',
      icon:         Calendar,
      color:        'bg-blue-50 text-[#0059B3]',
      ruta:         '/doctor/citas',
      proximamente: true,
    },
  ],
  CAJERO: [
    {
      label:       'Registrar pago',
      descripcion: 'Procesar cobros de consultas y confirmar citas',
      icon:        CreditCard,
      color:       'bg-green-50 text-green-700',
      ruta:        '/caja/pagos/nuevo',
    },
  ],
};

const ROL_LABELS = {
  ADMINISTRADOR: 'Administrador',
  DOCTOR:        'Doctor',
  RECEPCIONISTA: 'Recepcionista',
  CAJERO:        'Cajero',
};

// Saludo según la hora del día
function getSaludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── Componente principal ─────────────────────────────────────────
export default function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const dots       = useDotCursor();
  const modulos    = MODULOS[user?.rol] ?? [];

  const [stats, setStats] = useState({ servicios: null, doctores: null });

  useEffect(() => {
    if (user?.rol !== 'ADMINISTRADOR') return;
    Promise.all([api.get('/services'), api.get('/doctors')])
      .then(([svc, doc]) => setStats({
        servicios: Array.isArray(svc.data) ? svc.data.length : 0,
        doctores:  Array.isArray(doc.data) ? doc.data.length  : 0,
      }))
      .catch(() => {});
  }, [user?.rol]);

  const saludo = getSaludo();

  return (
    <AppLayout>
      <div className="px-4 py-8 max-w-6xl mx-auto w-full">

        {/* Bienvenida — header con degradado de marca */}
        <div
          ref={dots.ref}
          {...dots.handlers}
          className="dot-host mb-8 rounded-2xl bg-gradient-to-r from-[#0059B3] to-[#1B3A6B]
                     px-6 py-6 shadow-sm text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 dot-pattern" />
          <div className="absolute inset-0 dot-cloud" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold">
              {saludo}, {user?.nombre} 👋
            </h2>
            <p className="text-sm text-blue-100/90 mt-1">
              {user?.rol === 'ADMINISTRADOR'
                ? '¿Qué deseas hacer hoy?'
                : `Estás en el panel de ${ROL_LABELS[user?.rol]?.toLowerCase()}.`}
            </p>
          </div>
        </div>

        {/* Stats — solo ADMINISTRADOR */}
        {user?.rol === 'ADMINISTRADOR' && (
          <div className="grid grid-cols-2 gap-4 mb-8 max-w-xs">
            <StatCard
              label="Servicios activos"
              value={stats.servicios}
              icon={Stethoscope}
              colorClass="bg-green-50 text-green-600"
            />
            <StatCard
              label="Doctores"
              value={stats.doctores}
              icon={Users}
              colorClass="bg-blue-50 text-[#0059B3]"
            />
          </div>
        )}

        {/* Tarjetas de módulos — aparición escalonada */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modulos.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.label}
                onClick={() => !mod.proximamente && navigate(mod.ruta)}
                disabled={mod.proximamente}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`animate-fade-up relative text-left bg-white rounded-2xl shadow-sm p-5
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

      </div>

      <footer className="text-center text-[11px] text-slate-400 py-4">
        © {new Date().getFullYear()} Consultorio Padre Pio · Todos los derechos reservados
      </footer>
    </AppLayout>
  );
}

function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        {value === null
          ? <div className="skeleton h-5 w-8" />
          : <p className="text-xl font-bold text-slate-800 leading-none">{value}</p>}
        <p className="text-xs text-slate-500 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  );
}
