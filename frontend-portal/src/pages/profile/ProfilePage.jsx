import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronUp, Pencil, X, Check,
  Loader2, AlertCircle, LogOut, Phone, MapPin, Clock,
  User, Users, Calendar, Home,
} from 'lucide-react';
import { getProfile, updateProfile } from '../../services/patientProfile.service';
import { usePatientAuth } from '../../context/PatientAuthContext';
import FamiliaresTab from '../familiares/FamiliaresTab';
import HistorialClinico from '../../components/HistorialClinico';
import { ProximasCitas, MisPagos } from '../../components/MisCitas';
import BookingWizard from '../booking/BookingWizard';

// ── Constantes ────────────────────────────────────────────────────────────────
const INFO = {
  tagline:   'Odontología y Estética',
  telefono:  '944 366 443',
  direccion: 'Av. Ricardo Palma 679, Urb. Santo Dominguito 13007',
  horario:   'Lunes a sábados · 9:00 am – 8:00 pm',
};

// ── Utilidades ────────────────────────────────────────────────────────────────
const calcEdad = (fechaNac) => {
  if (!fechaNac) return null;
  const hoy = new Date();
  const dob = new Date(fechaNac + 'T00:00:00');
  let edad = hoy.getFullYear() - dob.getFullYear();
  const m = hoy.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < dob.getDate())) edad--;
  return edad;
};

const iniciales = (nombre, apellido) =>
  ((nombre ?? '').charAt(0) + (apellido ?? '').charAt(0)).toUpperCase();

const toTitle = (str) =>
  (str ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// ── Validación ────────────────────────────────────────────────────────────────
const RE_TEL = /^\d{9}$/;
const validateEdit = (form) => {
  const e = {};
  if (!RE_TEL.test(form.telefono.replace(/\D/g, '')))
    e.telefono = 'Debe tener exactamente 9 dígitos numéricos';
  if (!form.direccion.trim())
    e.direccion = 'La dirección es obligatoria';
  if (form.contacto_emergencia && !RE_TEL.test(form.contacto_emergencia.replace(/\D/g, '')))
    e.contacto_emergencia = 'Debe tener exactamente 9 dígitos numéricos';
  return e;
};
const isFormValid = (f) => Object.keys(validateEdit(f)).length === 0;
const isDirty = (f, o) =>
  f.telefono.replace(/\D/g, '')            !== o.telefono            ||
  f.direccion.trim()                       !== o.direccion           ||
  f.ocupacion.trim()                       !== o.ocupacion           ||
  f.contacto_emergencia.replace(/\D/g, '') !== o.contacto_emergencia;

// ── Acordeón ──────────────────────────────────────────────────────────────────
function Accordion({ id, label, hu, open, onToggle, children }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 text-left
                   bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {open
          ? <ChevronUp  size={16} className="text-slate-400" />
          : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 py-5 bg-slate-50 border-t border-slate-100">
          {children ?? (
            <p className="text-sm text-slate-400 italic text-center py-3">Disponible próximamente ({hu})</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Campo de edición ──────────────────────────────────────────────────────────
function EditField({ label, error, children, required = false }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}
const inputCls = (err) =>
  `w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/25
   ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white focus:border-primary'}`;
const readonlyCls =
  'w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed';

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate   = useNavigate();
  const { logout } = usePatientAuth();

  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState(null);

  const [activeTab, setActiveTab]           = useState('perfil');
  const [openAccordions, setOpenAccordions] = useState(new Set());
  const [menuOpen, setMenuOpen]             = useState(false);
  const [selectedFamiliar, setSelectedFamiliar] = useState(null);
  const [autoOpenRegisterFamiliar, setAutoOpenRegisterFamiliar] = useState(false);

  const [showEdit, setShowEdit]               = useState(false);
  const [editForm, setEditForm]               = useState(null);
  const [editOriginal, setEditOriginal]       = useState(null);
  const [editErrors, setEditErrors]           = useState({});
  const [editTouched, setEditTouched]         = useState({});
  const [editSaving, setEditSaving]           = useState(false);
  const [editServerError, setEditServerError] = useState(null);
  const [successMsg, setSuccessMsg]           = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true); setPageError(null);
    try { const { data } = await getProfile(); setProfile(data); }
    catch { setPageError('No se pudo cargar el perfil. Intenta nuevamente.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const toggleAccordion = (id) =>
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openEdit = () => {
    const initial = {
      telefono:             profile.telefono            ?? '',
      direccion:            profile.direccion           ?? '',
      ocupacion:            profile.ocupacion           ?? '',
      contacto_emergencia:  profile.contacto_emergencia ?? '',
    };
    setEditForm(initial); setEditOriginal(initial);
    setEditErrors({}); setEditTouched({}); setEditServerError(null); setShowEdit(true);
  };

  const cancelEdit = () => {
    setEditForm(editOriginal); setEditErrors({});
    setEditTouched({}); setEditServerError(null); setShowEdit(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    const newForm = { ...editForm, [name]: value };
    setEditForm(newForm);
    if (editTouched[name]) setEditErrors(validateEdit(newForm));
    if (editServerError) setEditServerError(null);
  };

  const handleEditBlur = (e) => {
    const { name } = e.target;
    setEditTouched((prev) => ({ ...prev, [name]: true }));
    setEditErrors(validateEdit(editForm));
  };

  const handleSave = async () => {
    setEditTouched({ telefono: true, direccion: true, contacto_emergencia: true });
    const errs = validateEdit(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setEditSaving(true); setEditServerError(null);
    try {
      const { data } = await updateProfile({
        telefono:            editForm.telefono.replace(/\D/g, ''),
        direccion:           editForm.direccion.trim(),
        ocupacion:           editForm.ocupacion.trim() || null,
        contacto_emergencia: editForm.contacto_emergencia.replace(/\D/g, '') || null,
      });
      setProfile(data); setShowEdit(false);
      setSuccessMsg('Información de perfil actualizada exitosamente.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setEditServerError('Ocurrió un error al actualizar los datos. Por favor, intente nuevamente.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );
  if (pageError) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-slate-600 text-sm">{pageError}</p>
      <button onClick={fetchProfile} className="text-sm text-primary underline">Reintentar</button>
    </div>
  );

  const canSave = editForm && isDirty(editForm, editOriginal) && isFormValid(editForm);
  const edad    = calcEdad(profile.fecha_nacimiento);

  const NAV_TABS = [
    { key: 'bienvenida', label: 'Inicio',        icon: Home     },
    { key: 'perfil',     label: 'Mi Perfil',     icon: User     },
    { key: 'familiares', label: 'Familiares',    icon: Users    },
    { key: 'citas',      label: 'Reservar Cita', icon: Calendar },
  ];

  const profileRows = [
    { label: 'Sexo',            value: profile.sexo ? toTitle(profile.sexo) : null },
    { label: 'Edad',            value: edad !== null ? `${edad} años` : null },
    { label: 'Teléfono',        value: profile.telefono },
    { label: 'DNI',             value: profile.numero_documento },
    { label: 'Dirección',       value: profile.direccion },
    { label: 'Ocupación',       value: profile.ocupacion ? toTitle(profile.ocupacion) : null },
    { label: 'Tel. emergencia', value: profile.contacto_emergencia },
  ];

  const ACCORDIONS = [
    { id: 'proximas',  label: 'Próximas citas',    hu: 'HU004' },
    { id: 'pagos',     label: 'Mis pagos',         hu: 'HU004' },
    { id: 'historial', label: 'Historias clínicas', hu: 'HU005' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── NAVBAR ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5">
            <img src="/ICONOCLINICA.svg" alt="Padre Pio" className="h-8 w-auto" />
            <span className="font-display font-black text-primary text-xl tracking-tight">
              PadrePio
            </span>
          </a>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all
                  ${activeTab === key
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-primary'}`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Usuario + logout desktop */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center
                              text-white text-xs font-black select-none">
                {iniciales(profile.nombre, profile.apellido)}
              </div>
              <span className="text-sm font-semibold text-slate-700">
                {toTitle(profile.nombre)}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500
                         hover:text-red-500 transition-colors px-2 py-2 rounded-lg hover:bg-red-50"
            >
              <LogOut size={15} />
              <span>Salir</span>
            </button>
          </div>

          {/* Hamburger mobile */}
          <button
            className="md:hidden p-2 text-slate-600 rounded-lg hover:bg-slate-100"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="block w-5 h-0.5 bg-current mb-1.5" />
            <span className="block w-5 h-0.5 bg-current mb-1.5" />
            <span className="block w-5 h-0.5 bg-current" />
          </button>
        </div>

        {/* Menú mobile */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 flex flex-col gap-1">
            {NAV_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-left
                  ${activeTab === key
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
            <div className="pt-3 mt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center
                                text-white text-sm font-black select-none">
                  {iniciales(profile.nombre, profile.apellido)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{toTitle(profile.nombre)} {toTitle(profile.apellido)}</p>
                  <p className="text-xs text-slate-400">{profile.email_cuenta}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500
                           text-sm font-semibold py-2.5 rounded-xl hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} /> Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Toast de éxito ── */}
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-accent text-white
                        text-sm font-semibold px-5 py-3 rounded-xl shadow-lg flex items-center
                        gap-2 whitespace-nowrap">
          <Check size={15} /> {successMsg}
        </div>
      )}

      {/* ── CONTENIDO ── */}
      <main className="flex-1 pt-16">

        {/* ── BIENVENIDA ── */}
        {activeTab === 'bienvenida' && (
          <div>
            {/* Hero banner */}
            <div className="bg-gradient-to-br from-primary via-primary/90 to-accent/80 py-16">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
                <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/40
                                flex items-center justify-center mx-auto mb-5
                                text-white text-2xl font-black select-none shadow-lg">
                  {iniciales(profile.nombre, profile.apellido)}
                </div>
                <h1 className="font-display font-black text-white text-3xl sm:text-4xl mb-2">
                  ¡Bienvenido/a, {toTitle(profile.nombre)}!
                </h1>
                <p className="text-white/75 text-base max-w-md mx-auto">
                  Gestiona tus citas y consulta tu información de forma rápida y segura.
                </p>
              </div>
            </div>

            {/* Tarjetas de acceso rápido */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-8 pb-16">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    key: 'perfil',
                    icon: User,
                    title: 'Mi Perfil',
                    desc: 'Revisa y actualiza tus datos personales y de contacto.',
                    color: 'bg-blue-50 border-blue-100',
                    iconColor: 'text-blue-500 bg-blue-100',
                  },
                  {
                    key: 'familiares',
                    icon: Users,
                    title: 'Familiares',
                    desc: 'Gestiona los miembros de tu familia vinculados a tu cuenta.',
                    color: 'bg-accent/10 border-accent/20',
                    iconColor: 'text-accent bg-accent/20',
                  },
                  {
                    key: 'citas',
                    icon: Calendar,
                    title: 'Reservar Cita',
                    desc: 'Agenda tu próxima visita con nuestros especialistas.',
                    color: 'bg-primary/5 border-primary/10',
                    iconColor: 'text-primary bg-primary/10',
                  },
                ].map(({ key, icon: Icon, title, desc, color, iconColor }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`text-left p-5 rounded-2xl border bg-white shadow-sm
                                hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${color}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconColor}`}>
                      <Icon size={18} />
                    </div>
                    <p className="font-bold text-slate-800 mb-1">{title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </button>
                ))}
              </div>

              {/* Info rápida del consultorio */}
              <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider text-slate-400">
                  Información del consultorio
                </h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { icon: Phone,  label: 'Teléfono / WhatsApp', value: INFO.telefono },
                    { icon: MapPin, label: 'Dirección',           value: INFO.direccion },
                    { icon: Clock,  label: 'Horario',             value: INFO.horario   },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                        <p className="text-xs text-slate-700 font-medium mt-0.5 leading-snug">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MI PERFIL ── */}
        {activeTab === 'perfil' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

            {/* Banner con gradiente */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="h-28 bg-gradient-to-r from-primary to-primary/70 relative">
                <div className="absolute inset-0 opacity-10"
                     style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              </div>

              <div className="px-6 pb-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 mb-6 relative z-10">
                  {/* Avatar */}
                  <div className="w-24 h-24 rounded-2xl bg-primary border-4 border-white
                                  flex items-center justify-center shadow-lg
                                  text-white text-2xl font-black select-none">
                    {iniciales(profile.nombre, profile.apellido)}
                  </div>
                  <button
                    onClick={openEdit}
                    className="self-start sm:self-auto inline-flex items-center gap-2 bg-accent text-white
                               text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#78b52c] transition-colors shadow-sm"
                  >
                    <Pencil size={13} /> Editar información
                  </button>
                </div>

                <div className="mb-6">
                  <h2 className="font-display font-black text-slate-900 text-2xl leading-tight">
                    {toTitle(profile.nombre)} {toTitle(profile.apellido)}
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">{profile.email_cuenta}</p>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  {/* Tabla de datos */}
                  <div className="md:w-[42%]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Información personal
                    </p>
                    <div className="rounded-xl overflow-hidden border border-slate-100">
                      {profileRows.map((row, i) => (
                        <div
                          key={row.label}
                          className={`flex items-center px-4 py-3
                            ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
                        >
                          <span className="w-1/2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            {row.label}
                          </span>
                          <span className="w-1/2 text-sm text-slate-800 text-right font-medium">
                            {row.value ?? <span className="text-slate-300 font-normal">No registrado</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Acordeones */}
                  <div className="md:w-[58%] space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                      Historial médico
                    </p>
                    {ACCORDIONS.map((acc) => (
                      <Accordion
                        key={acc.id}
                        {...acc}
                        open={openAccordions.has(acc.id)}
                        onToggle={toggleAccordion}
                      >
                        {acc.id === 'proximas' && openAccordions.has('proximas') && (
                          <ProximasCitas
                            pacienteId={profile.paciente_id}
                            onSuccess={(msg) => {
                              setSuccessMsg(msg);
                              setTimeout(() => setSuccessMsg(null), 4000);
                            }}
                          />
                        )}
                        {acc.id === 'pagos' && openAccordions.has('pagos') && (
                          <MisPagos pacienteId={profile.paciente_id} />
                        )}
                        {acc.id === 'historial' && openAccordions.has('historial') && (
                          <HistorialClinico pacienteId={profile.paciente_id} />
                        )}
                      </Accordion>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FAMILIARES ── */}
        {activeTab === 'familiares' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <FamiliaresTab
              selectedFamiliar={selectedFamiliar}
              onSelectFamiliar={setSelectedFamiliar}
              autoOpenRegister={autoOpenRegisterFamiliar}
              onAutoOpenHandled={() => setAutoOpenRegisterFamiliar(false)}
              onSuccess={(msg) => {
                setSuccessMsg(msg);
                setTimeout(() => setSuccessMsg(null), 4000);
              }}
            />
          </div>
        )}

        {/* ── RESERVAR UNA CITA ── */}
        {activeTab === 'citas' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <BookingWizard
              titular={profile}
              onRegistrarFamiliar={() => {
                setAutoOpenRegisterFamiliar(true);
                setActiveTab('familiares');
              }}
            />
          </div>
        )}

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            {/* Marca */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/ICONOCLINICA.svg" alt="Padre Pio" className="h-7 w-auto brightness-0 invert" />
                <span className="font-display font-black text-white text-lg">PadrePio</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {INFO.tagline}. Atención odontológica de calidad con un trato humano y cercano.
              </p>
            </div>

            {/* Contacto */}
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Contacto</p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <Phone size={12} className="text-slate-500 mt-0.5 shrink-0" />
                  <span>{INFO.telefono}</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin size={12} className="text-slate-500 mt-0.5 shrink-0" />
                  <span>{INFO.direccion}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock size={12} className="text-slate-500 mt-0.5 shrink-0" />
                  <span>{INFO.horario}</span>
                </li>
              </ul>
            </div>

            {/* Portal */}
            <div>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Portal Paciente</p>
              <ul className="space-y-2 text-xs">
                {NAV_TABS.map(({ key, label }) => (
                  <li key={key}>
                    <button
                      onClick={() => setActiveTab(key)}
                      className="hover:text-white transition-colors"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center
                          justify-between gap-2 text-xs">
            <p>© {new Date().getFullYear()} Consultorio Padre Pio. Todos los derechos reservados.</p>
            <p className="text-slate-600">Portal de Pacientes · {INFO.tagline}</p>
          </div>
        </div>
      </footer>

      {/* ── Modal de edición ── */}
      {showEdit && editForm && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center
                     bg-black/50 sm:px-4"
          onClick={(e) => { if (e.target === e.currentTarget) cancelEdit(); }}
        >
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                          flex flex-col max-h-[92vh]">

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-800">Editar mi información</h2>
                <p className="text-xs text-slate-400 mt-0.5">Los datos de identidad no pueden modificarse</p>
              </div>
              <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={19} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-5">

              {/* Solo lectura */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Datos de identidad — solo lectura
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <EditField label="Nombre completo">
                    <input readOnly value={`${toTitle(profile.nombre)} ${toTitle(profile.apellido)}`} className={readonlyCls} />
                  </EditField>
                  <EditField label="Documento">
                    <input readOnly value={`${profile.tipo_documento} ${profile.numero_documento}`} className={readonlyCls} />
                  </EditField>
                  <EditField label="Correo electrónico">
                    <input readOnly value={profile.email_cuenta ?? ''} className={readonlyCls} />
                  </EditField>
                  <EditField label="Fecha de nacimiento">
                    <input readOnly value={profile.fecha_nacimiento ?? ''} className={readonlyCls} />
                  </EditField>
                </div>
              </div>

              {/* Editables */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Información de contacto
                </p>
                <div className="space-y-3">
                  <EditField label="Teléfono principal" error={editTouched.telefono && editErrors.telefono} required>
                    <input type="tel" name="telefono" value={editForm.telefono}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={9} placeholder="987654321"
                      className={inputCls(editTouched.telefono && editErrors.telefono)} />
                  </EditField>
                  <EditField label="Dirección de residencia" error={editTouched.direccion && editErrors.direccion} required>
                    <input type="text" name="direccion" value={editForm.direccion}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={299} placeholder="Av. Ejemplo 123, Lima"
                      className={inputCls(editTouched.direccion && editErrors.direccion)} />
                  </EditField>
                  <EditField label="Ocupación">
                    <input type="text" name="ocupacion" value={editForm.ocupacion}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={80} placeholder="Ej: Docente, Ingeniero..."
                      className={inputCls(false)} />
                  </EditField>
                  <EditField label="Teléfono de emergencia" error={editTouched.contacto_emergencia && editErrors.contacto_emergencia}>
                    <input type="tel" name="contacto_emergencia" value={editForm.contacto_emergencia}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={9} placeholder="987654321"
                      className={inputCls(editTouched.contacto_emergencia && editErrors.contacto_emergencia)} />
                  </EditField>
                </div>
              </div>

              {editServerError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                text-red-700 text-sm rounded-lg px-3 py-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{editServerError}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={cancelEdit}
                className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm
                           font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!canSave || editSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-accent text-white
                           font-bold text-sm py-2.5 rounded-xl hover:bg-[#78b52c]
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {editSaving
                  ? <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                  : <><Check size={15} /> Guardar cambios</>}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
