import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronUp, Pencil, X, Check,
  Loader2, AlertCircle,
} from 'lucide-react';
import { getProfile, updateProfile } from '../../services/patientProfile.service';
import { usePatientAuth } from '../../context/PatientAuthContext';
import FamiliaresTab from '../familiares/FamiliaresTab';

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
  f.telefono.replace(/\D/g, '')         !== o.telefono            ||
  f.direccion.trim()                    !== o.direccion           ||
  f.ocupacion.trim()                    !== o.ocupacion           ||
  f.contacto_emergencia.replace(/\D/g, '') !== o.contacto_emergencia;

// ── Acordeón ──────────────────────────────────────────────────────────────────
function Accordion({ id, label, hu, open, onToggle }) {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left
                   bg-primary text-white hover:bg-primary/90 transition-colors"
      >
        <span className="text-sm font-semibold">{label}</span>
        {open
          ? <ChevronUp  size={16} className="text-white/80" />
          : <ChevronDown size={16} className="text-white/80" />}
      </button>
      {open && (
        <div className="px-4 py-8 bg-white border-t border-slate-100 text-center">
          <p className="text-sm text-muted italic">Disponible próximamente ({hu})</p>
        </div>
      )}
    </div>
  );
}

// ── Campo de edición ──────────────────────────────────────────────────────────
function EditField({ label, error, children, required = false }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-muted uppercase tracking-wider">
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
  'w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-muted cursor-not-allowed';

// ── Página principal ──────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate   = useNavigate();
  const { logout } = usePatientAuth();

  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [pageError, setPageError]     = useState(null);

  const [activeTab, setActiveTab]           = useState('perfil');
  const [openAccordions, setOpenAccordions] = useState(new Set());

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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );
  if (pageError) return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4 px-4">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-slate-600 text-sm">{pageError}</p>
      <button onClick={fetchProfile} className="text-sm text-primary underline">Reintentar</button>
    </div>
  );

  const canSave = editForm && isDirty(editForm, editOriginal) && isFormValid(editForm);
  const edad    = calcEdad(profile.fecha_nacimiento);

  const NAV_TABS = [
    { key: 'bienvenida', label: 'BIENVENIDA' },
    { key: 'perfil',     label: 'MI PERFIL' },
    { key: 'familiares', label: 'FAMILIARES' },
    { key: 'citas',      label: 'RESERVAR UNA CITA' },
  ];

  const profileRows = [
    { label: 'Sexo',            value: profile.sexo ? toTitle(profile.sexo) : null },
    { label: 'Edad',            value: edad !== null ? String(edad) : null },
    { label: 'Teléfono',        value: profile.telefono },
    { label: 'DNI',             value: profile.numero_documento },
    { label: 'Dirección',       value: profile.direccion },
    { label: 'Ocupación',       value: profile.ocupacion ? toTitle(profile.ocupacion) : null },
    { label: 'Tel. emergencia', value: profile.contacto_emergencia },
  ];

  const ACCORDIONS = [
    { id: 'proximas',  label: 'Próximas citas',    hu: 'HU004' },
    { id: 'historial', label: 'Historias clínicas', hu: 'HU005' },
  ];

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="pt-4 pb-2 text-center">
            <h1 className="font-display font-bold text-primary"
                style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.5px' }}>
              PadrePio
            </h1>
          </div>
          <nav className="flex items-center justify-between pb-0 overflow-x-auto gap-1">
            {NAV_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`shrink-0 px-3 py-1 mb-2.5 text-xs font-semibold tracking-widest rounded transition-all
                  ${activeTab === key
                    ? 'bg-accent text-white'
                    : 'text-primary hover:text-primary/60'}`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="shrink-0 px-3 py-1 mb-2.5 text-xs font-semibold tracking-widest text-primary hover:text-primary/60 transition-colors"
            >
              SALIR DEL PORTAL
            </button>
          </nav>
        </div>
      </header>

      {/* ── Toast de éxito ── */}
      {successMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-accent text-white
                        text-sm font-semibold px-5 py-3 rounded-xl shadow-lg flex items-center
                        gap-2 whitespace-nowrap">
          <Check size={15} /> {successMsg}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* ── BIENVENIDA ── */}
        {activeTab === 'bienvenida' && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <h2 className="text-2xl font-bold text-primary mb-2">
              ¡Bienvenido/a, {toTitle(profile.nombre)}!
            </h2>
            <p className="text-slate-500 text-sm">
              Gestiona tus citas y consulta tu información de forma segura.
            </p>
          </div>
        )}

        {/* ── MI PERFIL ── */}
        {activeTab === 'perfil' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="h-16 bg-slate-200" />

            <div className="px-5 pb-5 flex flex-col md:flex-row gap-5 md:gap-8">

              {/* Columna izquierda */}
              <div className="md:w-[38%]">
                <div className="-mt-9 mb-3">
                  <div className="w-[72px] h-[72px] rounded-full bg-primary border-4 border-white
                                  flex items-center justify-center
                                  text-white text-xl font-black shadow-md select-none">
                    {iniciales(profile.nombre, profile.apellido)}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h2 className="font-display font-bold text-slate-800 text-lg leading-tight">
                    {toTitle(profile.nombre)} {toTitle(profile.apellido)}
                  </h2>
                  <button
                    onClick={openEdit}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-accent
                               hover:text-[#70a828] transition-colors"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                </div>

                <div className="rounded overflow-hidden">
                  {profileRows.map((row, i) => (
                    <div
                      key={row.label}
                      className={`flex items-center px-3 py-2
                        ${i % 2 === 0 ? 'bg-[#dff0c0]' : 'bg-white'}`}
                    >
                      <span className="w-1/2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        {row.label}
                      </span>
                      <span className="w-1/2 text-sm text-slate-800 text-right">
                        {row.value ?? <span className="text-slate-300">—</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columna derecha: acordeones */}
              <div className="md:w-[62%] md:pt-12 space-y-2.5">
                {ACCORDIONS.map((acc) => (
                  <Accordion
                    key={acc.id}
                    {...acc}
                    open={openAccordions.has(acc.id)}
                    onToggle={toggleAccordion}
                  />
                ))}
              </div>

            </div>
          </div>
        )}

        {/* ── FAMILIARES ── */}
        {activeTab === 'familiares' && (
          <FamiliaresTab
            onSuccess={(msg) => {
              setSuccessMsg(msg);
              setTimeout(() => setSuccessMsg(null), 4000);
            }}
          />
        )}

        {/* ── RESERVAR UNA CITA ── */}
        {activeTab === 'citas' && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-muted text-sm">
            La reserva de citas estará disponible próximamente (HU004)
          </div>
        )}

      </main>

      {/* ── Modal de edición ── */}
      {showEdit && editForm && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center
                     bg-black/40 sm:px-4"
          onClick={(e) => { if (e.target === e.currentTarget) cancelEdit(); }}
        >
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                          flex flex-col max-h-[92vh]">

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-800">Editar mi información</h2>
              <button onClick={cancelEdit} className="text-muted hover:text-slate-600 transition-colors">
                <X size={19} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 space-y-5">

              {/* Solo lectura */}
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
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
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
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
