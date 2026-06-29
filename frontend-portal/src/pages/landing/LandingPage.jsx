import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, MapPin, Clock, ChevronRight,
  Loader2, Star, Users, CalendarCheck, ShieldCheck,
} from 'lucide-react';
import { getServiciosPublicos, getDoctoresPublicos } from '../../services/public.service';

// ── Constantes del consultorio ────────────────────────────────────────────────
const INFO = {
  nombre:    'Padre Pio',
  tagline:   'Odontología y Estética',
  mision:    'Brindar atención odontológica y estética de alta calidad, integrando tecnología moderna con un trato humano y cercano, para devolver la salud bucal y la confianza a cada uno de nuestros pacientes y sus familias.',
  inicio:    '2024',
  telefono:  '944 366 443',
  direccion: 'Av. Ricardo Palma 679, Urb. Santo Dominguito 13007',
  horario:   'Lunes a sábados · 9:00 am – 8:00 pm',
};

const STATS = [
  { icon: CalendarCheck, label: 'Citas atendidas', value: '1 000+' },
  { icon: Users,         label: 'Pacientes',        value: '500+'  },
  { icon: Star,          label: 'Calificación',     value: '4.3 ★' },
  { icon: ShieldCheck,   label: 'Desde',            value: '2024'  },
];

// ── Utilidades ────────────────────────────────────────────────────────────────
const toTitle = (s) => (s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const iniciales = (nombre, apellido) =>
  ((nombre ?? '').charAt(0) + (apellido ?? '').charAt(0)).toUpperCase();

// ── Componentes ───────────────────────────────────────────────────────────────
function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors"
    >
      {children}
    </a>
  );
}

function ServiceCard({ servicio }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-3
                    hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <h3 className="font-bold text-slate-800 text-base">{toTitle(servicio.nombre)}</h3>
      {servicio.descripcion && (
        <p className="text-sm text-slate-500 leading-relaxed flex-1">
          {servicio.descripcion}
        </p>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs text-slate-400">{servicio.duracion} min</span>
        <span className="text-sm font-bold text-primary">
          S/ {Number(servicio.costo).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function DoctorCard({ doctor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col
                    items-center text-center gap-3 hover:shadow-md transition-shadow">
      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center
                      text-white text-xl font-black select-none shadow-md">
        {iniciales(doctor.nombre, doctor.apellido)}
      </div>
      <div>
        <p className="font-bold text-slate-800">
          Dr. {toTitle(doctor.nombre)} {toTitle(doctor.apellido)}
        </p>
        {doctor.especialidad && (
          <p className="text-xs text-slate-500 mt-0.5">{doctor.especialidad}</p>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();

  const [servicios, setServicios] = useState([]);
  const [doctores,  setDoctores]  = useState([]);
  const [loadingSvc, setLoadingSvc] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getServiciosPublicos()
      .then(({ data }) => setServicios(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingSvc(false));

    getDoctoresPublicos()
      .then(({ data }) => setDoctores(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingDoc(false));
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#inicio" className="flex items-center gap-2">
            <img src="/ICONOCLINICA.svg" alt="Padre Pio" className="h-8 w-auto" />
            <span className="font-display font-black text-primary text-xl tracking-tight">
              PadrePio
            </span>
          </a>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLink href="#servicios">Servicios</NavLink>
            <NavLink href="#nosotros">Nosotros</NavLink>
            <NavLink href="#doctores">Doctores</NavLink>
            <NavLink href="#contacto">Contacto</NavLink>
          </nav>

          {/* CTAs desktop */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-semibold text-primary border border-primary/30
                         px-4 py-2 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Ingresar
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-bold bg-accent text-white px-4 py-2 rounded-lg
                         hover:bg-[#78b52c] transition-colors"
            >
              Crear cuenta
            </button>
          </div>

          {/* Hamburger mobile */}
          <button
            className="md:hidden p-2 text-slate-600"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current mb-1" />
            <span className="block w-5 h-0.5 bg-current" />
          </button>
        </div>

        {/* Menú mobile */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 flex flex-col gap-3">
            {['servicios','nosotros','doctores','contacto'].map((s) => (
              <a key={s} href={`#${s}`} onClick={() => setMenuOpen(false)}
                className="text-sm font-semibold text-slate-600 capitalize py-1">
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </a>
            ))}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => navigate('/login')}
                className="flex-1 border border-primary/30 text-primary text-sm font-semibold
                           py-2 rounded-lg">
                Ingresar
              </button>
              <button onClick={() => navigate('/register')}
                className="flex-1 bg-accent text-white text-sm font-bold py-2 rounded-lg">
                Crear cuenta
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section
        id="inicio"
        className="pt-16 min-h-screen flex items-center bg-gradient-to-br
                   from-primary/5 via-white to-accent/10"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-widest
                             text-accent bg-accent/10 px-3 py-1 rounded-full mb-4">
              {INFO.tagline}
            </span>
            <h1 className="font-display font-black text-slate-900 leading-tight mb-4"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
              Tu salud dental<br />
              <span className="text-primary">en las mejores manos</span>
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed mb-8 max-w-lg">
              Reserva tus citas en línea, gestiona los tratamientos de toda tu familia
              y accede a tu historial clínico cuando lo necesites.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 bg-accent text-white font-bold
                           px-6 py-3 rounded-xl hover:bg-[#78b52c] transition-colors shadow-sm"
              >
                Crear mi cuenta <ChevronRight size={16} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 border border-primary/30 text-primary
                           font-semibold px-6 py-3 rounded-xl hover:bg-primary/5 transition-colors"
              >
                Ya tengo cuenta
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              ¿Paciente del consultorio?{' '}
              <button onClick={() => navigate('/vincular')}
                className="text-primary underline font-semibold">
                Vincula tu cuenta aquí
              </button>
            </p>
          </div>

          {/* Tarjeta decorativa */}
          <div className="hidden md:flex justify-center">
            <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xs w-full border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <img src="/ICONOCLINICA.svg" alt="Padre Pio" className="h-10 w-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Consultorio Padre Pio</p>
                  <p className="text-xs text-slate-400">Portal de pacientes</p>
                </div>
              </div>
              {[
                { label: 'Reserva citas online',           done: true  },
                { label: 'Historial clínico digital',      done: true  },
                { label: 'Gestión de familiares',          done: true  },
                { label: 'Recordatorios automáticos',      done: false },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0
                                   ${done ? 'bg-accent' : 'bg-slate-100'}`}>
                    {done && <span className="text-white text-[10px] font-black">✓</span>}
                  </div>
                  <span className={`text-sm ${done ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ESTADÍSTICAS ── */}
      <section className="bg-primary py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map(({ icon: Icon, label, value }) => (
              <div key={label}>
                <Icon size={24} className="text-white/60 mx-auto mb-2" />
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-xs text-white/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICIOS ── */}
      <section id="servicios" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-accent">
              Lo que ofrecemos
            </span>
            <h2 className="font-display font-black text-slate-900 text-3xl mt-2">
              Nuestros servicios
            </h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
              Tratamientos dentales y estéticos con tecnología de última generación.
            </p>
          </div>

          {loadingSvc ? (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : servicios.length === 0 ? (
            <p className="text-center text-slate-400 text-sm">
              Próximamente nuestros servicios.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {servicios.map((s) => <ServiceCard key={s.servicio_id} servicio={s} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── NOSOTROS ── */}
      <section id="nosotros" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-accent">
              Quiénes somos
            </span>
            <h2 className="font-display font-black text-slate-900 text-3xl mt-2 mb-4">
              Consultorio Padre Pio
            </h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              {INFO.mision}
            </p>
            <p className="text-slate-500 leading-relaxed">
              Desde inicios del {INFO.inicio} nos comprometemos a ofrecer una experiencia
              de atención cómoda, moderna y personalizada para cada paciente.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: Phone,
                title: 'Llámanos',
                value: INFO.telefono,
                sub:   'Cel. / WhatsApp',
              },
              {
                icon: MapPin,
                title: 'Encuéntranos',
                value: INFO.direccion,
                sub:   'Trujillo, Perú',
              },
              {
                icon: Clock,
                title: 'Horario de atención',
                value: INFO.horario,
                sub:   'Domingos cerrado',
              },
            ].map(({ icon: Icon, title, value, sub }) => (
              <div key={title}
                className="flex items-start gap-4 bg-slate-50 rounded-2xl px-5 py-4 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center
                                justify-center shrink-0 mt-0.5">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                  <p className="text-xs text-slate-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOCTORES ── */}
      <section id="doctores" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-accent">
              Nuestro equipo
            </span>
            <h2 className="font-display font-black text-slate-900 text-3xl mt-2">
              Conoce a nuestros doctores
            </h2>
            <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">
              Profesionales especializados comprometidos con tu salud bucal.
            </p>
          </div>

          {loadingDoc ? (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="animate-spin text-primary" />
            </div>
          ) : doctores.length === 0 ? (
            <p className="text-center text-slate-400 text-sm">
              Próximamente nuestro equipo.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {doctores.map((d) => <DoctorCard key={d.doctor_id} doctor={d} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section id="contacto" className="py-20 bg-primary">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display font-black text-white text-3xl mb-3">
            ¿Listo para cuidar tu sonrisa?
          </h2>
          <p className="text-white/70 mb-8 text-sm leading-relaxed">
            Crea tu cuenta gratis y reserva tu primera cita en minutos.
            Si ya eres paciente del consultorio, vincula tu historial existente.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate('/register')}
              className="inline-flex items-center gap-2 bg-white text-primary font-bold
                         px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors shadow"
            >
              Crear mi cuenta <ChevronRight size={16} />
            </button>
            <button
              onClick={() => navigate('/vincular')}
              className="inline-flex items-center gap-2 border border-white/30 text-white
                         font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              Vincular mi cuenta
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row
                        items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <img src="/ICONOCLINICA.svg" alt="Padre Pio" className="h-6 w-auto brightness-0 invert" />
            <span className="font-display font-black text-white text-base">PadrePio</span>
          </div>
          <p>{INFO.tagline} · {INFO.direccion}</p>
          <p>© {new Date().getFullYear()} Consultorio Padre Pio</p>
        </div>
      </footer>

    </div>
  );
}
