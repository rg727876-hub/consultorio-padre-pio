import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, MapPin, Clock, ChevronRight, ChevronLeft,
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

const mediaUrl = (path) => {
  if (!path) return null;
  return path.startsWith('http') ? path : `${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${path}`;
};

// ── Componentes ───────────────────────────────────────────────────────────────
function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="text-xs font-semibold uppercase tracking-widest text-slate-500
                hover:text-primary transition-colors"
    >
      {children}
    </a>
  );
}

function ServiceCard({ servicio }) {
  const navigate = useNavigate();
  const foto = mediaUrl(servicio.imagen);

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300
                    overflow-hidden flex flex-col h-full border border-slate-100">
      <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
        {foto ? (
          <img src={foto} alt={servicio.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl
                          bg-gradient-to-br from-primary/15 to-accent/15">
            🦷
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center text-center px-5 py-6">
        <h3 className="font-bold text-slate-800 text-base">{toTitle(servicio.nombre)}</h3>
        <p className="text-primary font-bold text-sm mt-1">
          S/ {Number(servicio.costo).toFixed(2)}
        </p>
        {servicio.descripcion && (
          <p className="text-xs text-slate-500 leading-relaxed mt-2 line-clamp-3">
            {servicio.descripcion}
          </p>
        )}
        <div className="mt-auto w-full pt-4">
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="text-xs font-semibold text-primary border border-primary/30
                       rounded-full px-5 py-2 hover:bg-primary/5 transition-colors"
          >
            Reservar cita
          </button>
        </div>
      </div>
    </div>
  );
}

function ServicesCarousel({ servicios }) {
  const scrollRef = useRef(null);

  const scrollByCard = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector('[data-card]');
    const amount = card ? card.offsetWidth + 20 : 280;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex items-stretch gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2
                   [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {servicios.map((s) => (
          <div
            key={s.servicio_id}
            data-card
            className="snap-start shrink-0 w-[75%] sm:w-64 lg:w-72"
          >
            <ServiceCard servicio={s} />
          </div>
        ))}
      </div>

      {servicios.length > 4 && (
        <>
          <button
            onClick={() => scrollByCard(-1)}
            className="hidden sm:flex absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                       bg-white shadow-lg items-center justify-center hover:bg-slate-50 transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <button
            onClick={() => scrollByCard(1)}
            className="hidden sm:flex absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                       bg-white shadow-lg items-center justify-center hover:bg-slate-50 transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </>
      )}
    </div>
  );
}

function DoctorCircle({ doctor }) {
  const foto = mediaUrl(doctor.avatar);

  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden shadow-md bg-slate-100 shrink-0">
        {foto ? (
          <img src={foto} alt={doctor.nombre} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary
                          text-white font-black text-lg select-none">
            {iniciales(doctor.nombre, doctor.apellido)}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800">Dr. {toTitle(doctor.apellido)}</p>
        {doctor.especialidad && (
          <p className="text-xs text-slate-400 mt-0.5">{doctor.especialidad}</p>
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

  const heroDoctores = doctores.slice(0, 3);

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
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md shadow-[0_1px_0_0_rgba(15,23,42,0.06)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Fila 1: marca centrada */}
          <div className="pt-3 pb-2 flex flex-col items-center text-center">
            <a href="#inicio" className="flex items-center gap-2">
              <img src="/ICONOCLINICA.svg" alt="Padre Pio" className="h-6 w-auto" />
              <span className="font-display font-black text-primary text-2xl tracking-[0.08em]">
                PadrePio
              </span>
            </a>
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400 mt-1">
              {INFO.tagline}
            </span>
          </div>

          {/* Fila 2: nav centrado + CTAs */}
          <div className="relative flex items-center justify-center h-12 border-t border-slate-100">
            <nav className="hidden md:flex items-center gap-9">
              <NavLink href="#servicios">Servicios</NavLink>
              <NavLink href="#nosotros">Nosotros</NavLink>
              <NavLink href="#doctores">Doctores</NavLink>
              <NavLink href="#contacto">Contacto</NavLink>
            </nav>

            {/* CTAs desktop */}
            <div className="hidden md:flex items-center gap-2 absolute right-0">
              <button
                onClick={() => navigate('/login')}
                className="text-xs font-semibold text-slate-600 hover:text-primary
                           px-3 py-1.5 rounded-full transition-colors"
              >
                Ingresar
              </button>
              <button
                onClick={() => navigate('/register')}
                className="text-xs font-bold bg-primary text-white px-4 py-2 rounded-full
                           hover:bg-blue-700 transition-colors shadow-sm shadow-primary/20"
              >
                Crear cuenta
              </button>
            </div>

            {/* Hamburger mobile */}
            <button
              className="md:hidden absolute right-0 p-2 text-slate-600"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="block w-5 h-0.5 bg-current mb-1" />
              <span className="block w-5 h-0.5 bg-current mb-1" />
              <span className="block w-5 h-0.5 bg-current" />
            </button>
          </div>
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
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold
                           py-2 rounded-full">
                Ingresar
              </button>
              <button onClick={() => navigate('/register')}
                className="flex-1 bg-primary text-white text-sm font-bold py-2 rounded-full">
                Crear cuenta
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section
        id="inicio"
        className="relative pt-28 sm:pt-32 min-h-screen flex items-center overflow-hidden bg-white"
      >
        {/* Lavado crema solo a la izquierda, perdiéndose hacia la derecha */}
        <div className="absolute inset-y-0 left-0 w-full sm:w-1/2
                        bg-gradient-to-r from-[#F7F1E7] via-[#F7F1E7]/40 to-transparent pointer-events-none" />

        {/* Manchas decorativas de fondo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* Foto vertical completa, anclada a la derecha */}
        <div
          className="hidden md:block absolute inset-y-0 right-0 h-full"
          style={{ aspectRatio: '736 / 1104' }}
        >
          <img src="/rrr.jpg" alt="" className="w-full h-full object-cover" />
          {/* Difuminado hacia blanco en el borde izquierdo de la foto */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/30 to-transparent" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest
                             text-accent bg-accent/10 px-4 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              {INFO.tagline}
            </span>
            <h1 className="font-display font-black text-slate-900 leading-[1.08] mb-5"
                style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4rem)' }}>
              Tu salud dental<br />
              <span className="text-primary">en las mejores manos</span>
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed mb-9 max-w-lg">
              Reserva tus citas en línea, gestiona los tratamientos de toda tu familia
              y accede a tu historial clínico cuando lo necesites.
            </p>
            <div className="flex flex-wrap gap-3 mb-7">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 bg-accent text-white font-bold
                           px-7 py-3.5 rounded-full hover:bg-[#78b52c] hover:-translate-y-0.5
                           transition-all shadow-lg shadow-accent/25"
              >
                Crear mi cuenta <ChevronRight size={16} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 border-2 border-primary/15 text-primary
                           font-semibold px-7 py-3.5 rounded-full hover:bg-primary/5 hover:-translate-y-0.5
                           transition-all"
              >
                Ya tengo cuenta
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-7">
              ¿Paciente del consultorio?{' '}
              <button onClick={() => navigate('/vincular')}
                className="text-primary underline font-semibold">
                Vincula tu cuenta aquí
              </button>
            </p>

            {heroDoctores.length > 0 && (
              <div className="flex items-center gap-5">
                {heroDoctores.map((d) => {
                  const foto = mediaUrl(d.avatar);
                  return (
                    <div key={d.doctor_id} className="flex flex-col items-center gap-1.5">
                      {foto ? (
                        <img
                          src={foto}
                          alt={d.nombre}
                          className="w-12 h-12 rounded-full object-cover shadow-sm border-2 border-white ring-1 ring-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center
                                        text-white text-xs font-black shadow-sm border-2 border-white ring-1 ring-slate-200">
                          {iniciales(d.nombre, d.apellido)}
                        </div>
                      )}
                      <span className="text-[11px] text-slate-500 font-medium text-center leading-tight max-w-[4.5rem]">
                        Dr. {toTitle(d.apellido)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── ESTADÍSTICAS ── */}
      <section className="bg-[#F7F1E7] py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 text-center">
            {STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-3">
                  <Icon size={20} className="text-primary" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-800">{value}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
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
            <ServicesCarousel servicios={servicios} />
          )}
        </div>
      </section>

      {/* ── NOSOTROS ── */}
      <section id="nosotros" className="relative py-24 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-16 items-center">

          {/* Foto con marco decorativo e insignia flotante */}
          <div className="relative order-2 md:order-1 max-w-sm mx-auto md:max-w-none">
            <div className="absolute -inset-4 border-2 border-accent/30 rounded-[2rem] -z-10 hidden sm:block" />
            <div className="rounded-[2rem] overflow-hidden shadow-xl aspect-[4/5] bg-slate-100">
              <img
                src="/rrrr.jpg"
                alt="Consultorio Padre Pio"
                className="w-full h-full object-cover"
                style={{ objectPosition: '50% 30%' }}
              />
            </div>

            <div className="absolute -bottom-6 -right-2 sm:-right-8 bg-white rounded-2xl shadow-xl
                            px-5 py-4 border border-slate-100 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg leading-none">{INFO.inicio}</p>
                <p className="text-[11px] text-slate-400 mt-1">Cuidando sonrisas desde</p>
              </div>
            </div>
          </div>

          {/* Texto */}
          <div className="order-1 md:order-2">
            <span className="text-xs font-bold uppercase tracking-widest text-accent">
              Quiénes somos
            </span>
            <h2 className="font-display font-black text-slate-900 text-3xl mt-2 mb-5">
              Consultorio Padre Pio
            </h2>
            <p className="text-slate-500 leading-relaxed mb-4">
              {INFO.mision}
            </p>
            <p className="text-slate-500 leading-relaxed">
              Desde inicios del {INFO.inicio} nos comprometemos a ofrecer una experiencia
              de atención cómoda, moderna y personalizada para cada paciente.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-9 pt-8 border-t border-slate-100">
              {[
                { icon: Phone, title: 'Llámanos', value: INFO.telefono },
                { icon: MapPin, title: 'Encuéntranos', value: INFO.direccion },
                { icon: Clock, title: 'Horario', value: INFO.horario },
              ].map(({ icon: Icon, title, value }) => (
                <div key={title}>
                  <Icon size={18} className="text-primary mb-2" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-1 leading-snug">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DOCTORES ── */}
      <section
        id="doctores"
        className="relative py-24 overflow-hidden"
        style={{
          backgroundColor: '#fafaf9',
          backgroundImage: 'radial-gradient(circle, #0000000f 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-16 items-center">

          {/* Texto */}
          <div>
            <p className="font-script text-5xl sm:text-6xl text-accent/80 leading-none mb-2 select-none">
              nuestro equipo
            </p>
            <h2 className="font-display font-black text-slate-900 text-3xl sm:text-4xl leading-tight mb-5">
              TU SONRISA EN MANOS DE EXPERTOS
            </h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              Nos apasiona cuidar de tu salud dental con la calidez y el profesionalismo
              que mereces. Contamos con un staff de especialistas altamente calificados,
              listos para brindarte una atención personalizada utilizando tecnología de
              vanguardia en cada tratamiento.
            </p>

            <ul className="space-y-3">
              {[
                { emoji: '🪥', text: 'Especialistas certificados' },
                { emoji: '✨', text: 'Tecnología y confort clínico' },
                { emoji: '🤍', text: 'Atención empática y sin dolor' },
              ].map(({ emoji, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <span className="text-lg">{emoji}</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Fotos circulares del equipo */}
          <div>
            {loadingDoc ? (
              <div className="flex justify-center py-10">
                <Loader2 size={28} className="animate-spin text-primary" />
              </div>
            ) : doctores.length === 0 ? (
              <p className="text-center text-slate-400 text-sm">
                Próximamente nuestro equipo.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8">
                {doctores.slice(0, 6).map((d) => <DoctorCircle key={d.doctor_id} doctor={d} />)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL / CONTACTO ── */}
      <section id="contacto" className="py-20 bg-primary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">

          {/* Texto + CTA + datos de contacto */}
          <div>
            <h2 className="font-display font-black text-white text-3xl mb-3">
              ¿Listo para cuidar tu sonrisa?
            </h2>
            <p className="text-white/70 mb-7 text-sm leading-relaxed">
              Crea tu cuenta gratis y reserva tu primera cita en minutos.
              Si ya eres paciente del consultorio, vincula tu historial existente.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 bg-white text-primary font-bold
                           px-6 py-3 rounded-full hover:bg-slate-50 transition-colors shadow"
              >
                Crear mi cuenta <ChevronRight size={16} />
              </button>
              <button
                onClick={() => navigate('/vincular')}
                className="inline-flex items-center gap-2 border border-white/30 text-white
                           font-semibold px-6 py-3 rounded-full hover:bg-white/10 transition-colors"
              >
                Vincular mi cuenta
              </button>
            </div>

            <div className="space-y-3 border-t border-white/15 pt-6">
              <a
                href={`https://wa.me/51${INFO.telefono.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white text-sm font-semibold hover:underline w-fit"
              >
                <Phone size={16} className="shrink-0" /> {INFO.telefono} · Escríbenos por WhatsApp
              </a>
              <p className="flex items-center gap-3 text-white/70 text-sm">
                <MapPin size={16} className="shrink-0" /> {INFO.direccion}
              </p>
              <p className="flex items-center gap-3 text-white/70 text-sm">
                <Clock size={16} className="shrink-0" /> {INFO.horario}
              </p>
            </div>
          </div>

          {/* Mapa */}
          <div className="rounded-2xl overflow-hidden shadow-xl h-72 md:h-full min-h-[280px]">
            <iframe
              title="Ubicación Consultorio Padre Pio"
              src={`https://www.google.com/maps?q=${encodeURIComponent(INFO.direccion)}&output=embed`}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid sm:grid-cols-2 md:grid-cols-4 gap-10">

          {/* Marca */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/ICONOCLINICA.svg" alt="Padre Pio" className="h-7 w-auto brightness-0 invert" />
              <span className="font-display font-black text-white text-lg">PadrePio</span>
            </div>
            <p className="text-sm leading-relaxed">
              {INFO.tagline}. Cuidando tu salud bucal con tecnología moderna y un trato cercano.
            </p>
          </div>

          {/* Enlaces */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">Enlaces</h3>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#servicios" className="hover:text-white transition-colors">Servicios</a></li>
              <li><a href="#nosotros" className="hover:text-white transition-colors">Nosotros</a></li>
              <li><a href="#doctores" className="hover:text-white transition-colors">Doctores</a></li>
              <li><a href="#contacto" className="hover:text-white transition-colors">Contacto</a></li>
            </ul>
          </div>

          {/* Mi cuenta */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">Mi cuenta</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">
                  Ingresar
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/register')} className="hover:text-white transition-colors">
                  Crear cuenta
                </button>
              </li>
              <li>
                <button onClick={() => navigate('/vincular')} className="hover:text-white transition-colors">
                  Vincular cuenta
                </button>
              </li>
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">Contacto</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Phone size={14} className="mt-0.5 shrink-0" /> {INFO.telefono}
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0" /> {INFO.direccion}
              </li>
              <li className="flex items-start gap-2">
                <Clock size={14} className="mt-0.5 shrink-0" /> {INFO.horario}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row
                          items-center justify-between gap-2 text-xs">
            <p>© {new Date().getFullYear()} Consultorio Padre Pio. Todos los derechos reservados.</p>
            <p>Hecho con cuidado en Trujillo, Perú</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
