import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, X, Loader2, AlertCircle, Check,
  Users, ChevronRight, ChevronLeft, Pencil,
  ChevronDown, ChevronUp, UserMinus, Trash2,
} from 'lucide-react';
import {
  getFamiliares, registrarFamiliar,
  getFamiliarDetalle, updateFamiliar, desvincularFamiliar,
} from '../../services/patientFamily.service';
import { consultarDniReniec } from '../../services/public.service';
import HistorialClinico from '../../components/HistorialClinico';
import { ProximasCitas, MisPagos } from '../../components/MisCitas';

// ── Constantes ────────────────────────────────────────────────────────────────
const PARENTESCOS = [
  { value: 'HIJO/A',    label: 'Hijo/a'    },
  { value: 'CONYUGE',   label: 'Cónyuge'   },
  { value: 'PADRE',     label: 'Padre'     },
  { value: 'MADRE',     label: 'Madre'     },
  { value: 'HERMANO/A', label: 'Hermano/a' },
  { value: 'ABUELO/A',  label: 'Abuelo/a'  },
  { value: 'OTRO',      label: 'Otro'      },
];
const TIPOS_DOC   = ['DNI', 'CE', 'PASAPORTE'];
const SEXOS       = ['MASCULINO', 'FEMENINO', 'OTRO'];
const MAX_DOC     = { DNI: 8, CE: 12, PASAPORTE: 12 };

const RE_DNI       = /^\d{8}$/;
const RE_CE        = /^[A-Za-z0-9]{9,12}$/;
const RE_PASAPORTE = /^[A-Za-z0-9]{6,12}$/;
const RE_TEL       = /^\d{9}$/;

// ── Utilidades ────────────────────────────────────────────────────────────────
const validarDoc = (tipo, num) => {
  if (tipo === 'DNI')       return RE_DNI.test(num);
  if (tipo === 'CE')        return RE_CE.test(num);
  if (tipo === 'PASAPORTE') return RE_PASAPORTE.test(num);
  return false;
};
const msgDoc = (tipo) => {
  if (tipo === 'DNI')       return 'Debe tener exactamente 8 dígitos';
  if (tipo === 'CE')        return 'Debe tener entre 9 y 12 caracteres alfanuméricos';
  if (tipo === 'PASAPORTE') return 'Debe tener entre 6 y 12 caracteres alfanuméricos';
  return '';
};

const toTitle = (s) => (s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const calcEdad = (fechaNac) => {
  if (!fechaNac) return null;
  const hoy = new Date();
  const dob = new Date(
    (typeof fechaNac === 'string' ? fechaNac : fechaNac.toISOString()).split('T')[0] + 'T00:00:00'
  );
  let edad = hoy.getFullYear() - dob.getFullYear();
  const m = hoy.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < dob.getDate())) edad--;
  return edad;
};

const iniciales = (nombre, apellido) =>
  ((nombre ?? '').charAt(0) + (apellido ?? '').charAt(0)).toUpperCase();

const labelParentesco = (value) =>
  PARENTESCOS.find((p) => p.value === value)?.label ?? toTitle(value ?? '');

// ── Validación formulario registro ───────────────────────────────────────────
const FORM_EMPTY = {
  parentesco: '', tipo_documento: 'DNI', numero_documento: '',
  nombre: '', apellido: '', fecha_nacimiento: '', sexo: '', contacto_emergencia: '',
};
const validateForm = (f) => {
  const e = {};
  if (!f.parentesco)                    e.parentesco       = 'Requerido';
  if (!f.tipo_documento)                e.tipo_documento   = 'Requerido';
  if (!f.numero_documento.trim())       e.numero_documento = 'Requerido';
  else if (!validarDoc(f.tipo_documento, f.numero_documento.trim()))
                                        e.numero_documento = msgDoc(f.tipo_documento);
  if (!f.nombre.trim())                 e.nombre           = 'Requerido';
  if (!f.apellido.trim())               e.apellido         = 'Requerido';
  if (!f.fecha_nacimiento)              e.fecha_nacimiento = 'Requerido';
  else {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    if (new Date(f.fecha_nacimiento + 'T00:00:00') >= hoy)
      e.fecha_nacimiento = 'Debe ser anterior a hoy';
  }
  if (!f.sexo)                          e.sexo             = 'Requerido';
  if (!f.contacto_emergencia.trim())    e.contacto_emergencia = 'Requerido';
  else if (!RE_TEL.test(f.contacto_emergencia.replace(/\D/g, '')))
                                        e.contacto_emergencia = 'Debe tener 9 dígitos';
  return e;
};

// ── Validación formulario editar familiar ────────────────────────────────────
const validateEditForm = (f) => {
  const e = {};
  if (f.telefono && !RE_TEL.test(f.telefono.replace(/\D/g, '')))
    e.telefono = 'Debe tener exactamente 9 dígitos';
  if (f.contacto_emergencia && !RE_TEL.test(f.contacto_emergencia.replace(/\D/g, '')))
    e.contacto_emergencia = 'Debe tener exactamente 9 dígitos';
  return e;
};
const isEditDirty = (f, o) =>
  (f.telefono?.replace(/\D/g, '')            ?? '') !== (o.telefono            ?? '') ||
  (f.direccion?.trim()                       ?? '') !== (o.direccion           ?? '') ||
  (f.ocupacion?.trim()                       ?? '') !== (o.ocupacion           ?? '') ||
  (f.contacto_emergencia?.replace(/\D/g, '') ?? '') !== (o.contacto_emergencia ?? '');

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Field({ label, error, required, children }) {
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
const inp = (err) =>
  `w-full border rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/25
   ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white focus:border-primary'}`;
const sel = (err) =>
  `w-full border rounded-lg px-3 py-2 text-sm outline-none bg-white transition-colors focus:ring-2 focus:ring-primary/25
   ${err ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-primary'}`;
const readonlyCls =
  'w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed';

// ── Acordeón (placeholder HU004 / historial HU005) ──────────────────────────
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

// ── ════════════════════════════════════════════════════════════════════════ ──
// VISTA DETALLE DE FAMILIAR
// ── ════════════════════════════════════════════════════════════════════════ ──
function FamiliarDetalle({ familiar: initialData, onBack, onDesvinculado, onSuccess }) {
  const [familiar, setFamiliar]             = useState(initialData);
  const [loading, setLoading]               = useState(false);
  const [openAccordions, setOpenAccordions] = useState(new Set());

  // Estado edición
  const [showEdit, setShowEdit]             = useState(false);
  const [editForm, setEditForm]             = useState(null);
  const [editOriginal, setEditOriginal]     = useState(null);
  const [editErrors, setEditErrors]         = useState({});
  const [editTouched, setEditTouched]       = useState({});
  const [editSaving, setEditSaving]         = useState(false);
  const [editServerError, setEditServerError] = useState(null);

  // Estado desvincular
  const [showConfirmDesv, setShowConfirmDesv] = useState(false);
  const [desvinculando, setDesvinculando]     = useState(false);
  const [desvError, setDesvError]             = useState(null);

  const toggleAccordion = (id) =>
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openEdit = () => {
    const initial = {
      telefono:            familiar.telefono            ?? '',
      direccion:           familiar.direccion           ?? '',
      ocupacion:           familiar.ocupacion           ?? '',
      contacto_emergencia: familiar.contacto_emergencia ?? '',
    };
    setEditForm(initial); setEditOriginal(initial);
    setEditErrors({}); setEditTouched({}); setEditServerError(null);
    setShowEdit(true);
  };

  const cancelEdit = () => {
    if (editSaving) return;
    setShowEdit(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    const next = { ...editForm, [name]: value };
    setEditForm(next);
    if (editTouched[name]) setEditErrors(validateEditForm(next));
    if (editServerError)   setEditServerError(null);
  };

  const handleEditBlur = (e) => {
    const { name } = e.target;
    setEditTouched((p) => ({ ...p, [name]: true }));
    setEditErrors(validateEditForm(editForm));
  };

  const handleSave = async () => {
    const allTouched = { telefono: true, contacto_emergencia: true };
    setEditTouched(allTouched);
    const errs = validateEditForm(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setEditSaving(true); setEditServerError(null);
    try {
      const { data } = await updateFamiliar(familiar.paciente_id, {
        telefono:            editForm.telefono            ? editForm.telefono.replace(/\D/g, '')            : null,
        direccion:           editForm.direccion.trim()   || null,
        ocupacion:           editForm.ocupacion.trim()   || null,
        contacto_emergencia: editForm.contacto_emergencia ? editForm.contacto_emergencia.replace(/\D/g, '') : null,
      });
      setFamiliar(data);
      setShowEdit(false);
      if (onSuccess) onSuccess(`Información de ${toTitle(familiar.nombre)} actualizada correctamente`);
    } catch (err) {
      setEditServerError(err?.response?.data?.error ?? 'Error al actualizar. Intenta nuevamente.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDesvincular = async () => {
    setDesvinculando(true); setDesvError(null);
    try {
      await desvincularFamiliar(familiar.paciente_id);
      setShowConfirmDesv(false);
      if (onDesvinculado) onDesvinculado(`Familiar desvinculado correctamente`);
    } catch (err) {
      setDesvError(err?.response?.data?.error ?? 'Error al desvincular. Intenta nuevamente.');
    } finally {
      setDesvinculando(false);
    }
  };

  const edad = calcEdad(familiar.fecha_nacimiento);

  const profileRows = [
    { label: 'Sexo',            value: familiar.sexo ? toTitle(familiar.sexo) : null },
    { label: 'Edad',            value: edad !== null ? `${edad} años` : null },
    { label: 'Teléfono',        value: familiar.telefono },
    { label: 'DNI',             value: `${familiar.tipo_documento} ${familiar.numero_documento}` },
    { label: 'Dirección',       value: familiar.direccion },
    { label: 'Ocupación',       value: familiar.ocupacion ? toTitle(familiar.ocupacion) : null },
    { label: 'Tel. emergencia', value: familiar.contacto_emergencia },
  ];

  const ACCORDIONS = [
    { id: 'proximas',  label: 'Próximas citas',    hu: 'HU004' },
    { id: 'pagos',     label: 'Mis pagos',         hu: 'HU004' },
    { id: 'historial', label: 'Historias clínicas', hu: 'HU005' },
  ];

  const canSave = editForm
    && isEditDirty(editForm, editOriginal)
    && Object.keys(validateEditForm(editForm)).length === 0;

  return (
    <>
      <div className="space-y-4">
        {/* Barra de navegación de detalle */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500
                       hover:text-primary transition-colors"
          >
            <ChevronLeft size={16} /> Volver a familiares
          </button>
        </div>

        {/* Tarjeta de detalle */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="h-24 bg-gradient-to-r from-primary/80 to-accent/60 relative">
            <div className="absolute inset-0 opacity-10"
                 style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          </div>

          <div className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 -mt-10 mb-5 relative z-10">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-primary border-4 border-white
                              flex items-center justify-center shadow-lg
                              text-white text-xl font-black select-none">
                {iniciales(familiar.nombre, familiar.apellido)}
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={openEdit}
                  className="inline-flex items-center gap-1.5 bg-accent text-white text-sm
                             font-bold px-3 py-2 rounded-xl hover:bg-[#78b52c] transition-colors shadow-sm"
                >
                  <Pencil size={13} /> Editar
                </button>
                <button
                  onClick={() => { setDesvError(null); setShowConfirmDesv(true); }}
                  className="inline-flex items-center gap-1.5 border border-red-200 text-red-500
                             text-sm font-bold px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <UserMinus size={13} /> Desvincular
                </button>
              </div>
            </div>

            {/* Nombre y parentesco */}
            <div className="mb-5">
              <h2 className="font-display font-black text-slate-900 text-xl leading-tight">
                {toTitle(familiar.nombre)} {toTitle(familiar.apellido)}
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">{labelParentesco(familiar.parentesco)}</p>
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
                      <ProximasCitas pacienteId={familiar.paciente_id} onSuccess={onSuccess} />
                    )}
                    {acc.id === 'pagos' && openAccordions.has('pagos') && (
                      <MisPagos pacienteId={familiar.paciente_id} />
                    )}
                    {acc.id === 'historial' && openAccordions.has('historial') && (
                      <HistorialClinico pacienteId={familiar.paciente_id} />
                    )}
                  </Accordion>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal editar familiar ── */}
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
                <h2 className="text-base font-bold text-slate-800">Editar información del familiar</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {toTitle(familiar.nombre)} {toTitle(familiar.apellido)}
                </p>
              </div>
              <button onClick={cancelEdit} disabled={editSaving}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-40">
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
                  <Field label="Nombre completo">
                    <input readOnly value={`${toTitle(familiar.nombre)} ${toTitle(familiar.apellido)}`} className={readonlyCls} />
                  </Field>
                  <Field label="Documento">
                    <input readOnly value={`${familiar.tipo_documento} ${familiar.numero_documento}`} className={readonlyCls} />
                  </Field>
                  <Field label="Fecha de nacimiento">
                    <input readOnly value={familiar.fecha_nacimiento?.split('T')[0] ?? ''} className={readonlyCls} />
                  </Field>
                  <Field label="Parentesco">
                    <input readOnly value={labelParentesco(familiar.parentesco)} className={readonlyCls} />
                  </Field>
                </div>
              </div>

              {/* Editables */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Información de contacto
                </p>
                <div className="space-y-3">
                  <Field label="Teléfono" error={editTouched.telefono && editErrors.telefono}>
                    <input type="tel" name="telefono" value={editForm.telefono}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={9} placeholder="987654321"
                      className={inp(editTouched.telefono && editErrors.telefono)} />
                  </Field>
                  <Field label="Dirección de residencia" error={editTouched.direccion && editErrors.direccion}>
                    <input type="text" name="direccion" value={editForm.direccion}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={299} placeholder="Av. Ejemplo 123, Lima"
                      className={inp(editTouched.direccion && editErrors.direccion)} />
                  </Field>
                  <Field label="Ocupación">
                    <input type="text" name="ocupacion" value={editForm.ocupacion}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={80} placeholder="Ej: Estudiante, Docente..."
                      className={inp(false)} />
                  </Field>
                  <Field label="Teléfono de emergencia" error={editTouched.contacto_emergencia && editErrors.contacto_emergencia}>
                    <input type="tel" name="contacto_emergencia" value={editForm.contacto_emergencia}
                      onChange={handleEditChange} onBlur={handleEditBlur}
                      maxLength={9} placeholder="987654321"
                      className={inp(editTouched.contacto_emergencia && editErrors.contacto_emergencia)} />
                  </Field>
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
              <button onClick={cancelEdit} disabled={editSaving}
                className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm
                           font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40">
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

      {/* ── Modal confirmar desvincular ── */}
      {showConfirmDesv && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center
                     bg-black/50 sm:px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !desvinculando) setShowConfirmDesv(false); }}
        >
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-red-500" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Desvincular familiar</h2>
              </div>
              <button
                onClick={() => { if (!desvinculando) setShowConfirmDesv(false); }}
                disabled={desvinculando}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                ¿Estás seguro de desvincular a{' '}
                <span className="font-bold text-slate-800">
                  {toTitle(familiar.nombre)} {toTitle(familiar.apellido)}
                </span>?
                Ya no podrás ver su información ni reservar citas para él/ella.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700 leading-relaxed">
                  El paciente y su historial <strong>NO se eliminan</strong>. Solo se desvincula
                  de tu cuenta. Podrá ser revinculado en el futuro si es necesario.
                </p>
              </div>

              {desvError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                text-red-700 text-sm rounded-lg px-3 py-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{desvError}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { if (!desvinculando) setShowConfirmDesv(false); }}
                disabled={desvinculando}
                className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm
                           font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleDesvincular}
                disabled={desvinculando}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white
                           font-bold text-sm py-2.5 rounded-xl hover:bg-red-600
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {desvinculando
                  ? <><Loader2 size={15} className="animate-spin" /> Desvinculando…</>
                  : <><UserMinus size={15} /> Sí, desvincular</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── ════════════════════════════════════════════════════════════════════════ ──
// COMPONENTE PRINCIPAL
// ── ════════════════════════════════════════════════════════════════════════ ──
export default function FamiliaresTab({ onSuccess, selectedFamiliar, onSelectFamiliar, autoOpenRegister, onAutoOpenHandled }) {
  const [familiares, setFamiliares]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [listError, setListError]         = useState(null);

  // selected/setSelected delegados al padre para persistir entre pestañas
  const selected    = selectedFamiliar;
  const setSelected = onSelectFamiliar;

  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [detalleError, setDetalleError]   = useState(null);

  // Modal registrar (HU008)
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState(FORM_EMPTY);
  const [touched, setTouched]             = useState({});
  const [errors, setErrors]               = useState({});
  const [submitting, setSubmitting]       = useState(false);
  const [serverError, setServerError]     = useState(null);
  const [candidato, setCandidato]         = useState(null);
  const [confirming, setConfirming]       = useState(false);
  const [reniecLoading, setReniecLoading] = useState(false);

  // ── Auto-fetch RENIEC ──────────────────────────────────────────
  useEffect(() => {
    const fetchReniec = async () => {
      if (form.tipo_documento === 'DNI' && form.numero_documento.length === 8) {
        setReniecLoading(true);
        try {
          const res = await consultarDniReniec(form.numero_documento);
          const d = res.data;
          setForm((prev) => ({
            ...prev,
            nombre:           d.first_name || '',
            apellido:         `${d.first_last_name || ''} ${d.second_last_name || ''}`.trim(),
            // Solo autocompleta fecha y sexo si vienen de la BD (ya validado)
            fecha_nacimiento: d.fecha_nacimiento || prev.fecha_nacimiento,
            sexo:             d.sexo             || prev.sexo,
          }));
          setErrors((prev) => ({ ...prev, nombre: null, apellido: null, numero_documento: null }));
        } catch (error) {
          setForm((prev) => ({ ...prev, nombre: '', apellido: '', fecha_nacimiento: '', sexo: '' }));
          setErrors((prev) => ({ 
            ...prev, 
            numero_documento: 'El DNI no existe en RENIEC'
          }));
        } finally {
          setReniecLoading(false);
        }
      } else if (form.tipo_documento === 'DNI') {
        setForm((prev) => ({ ...prev, nombre: '', apellido: '', fecha_nacimiento: '', sexo: '' }));
      }
    };
    fetchReniec();
  }, [form.numero_documento, form.tipo_documento]);

  const fetchFamiliares = useCallback(async () => {
    setLoading(true); setListError(null);
    try {
      const { data } = await getFamiliares();
      setFamiliares(Array.isArray(data?.familiares) ? data.familiares : []);
    } catch {
      setListError('No se pudo cargar la lista de familiares.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFamiliares(); }, [fetchFamiliares]);

  // ── Abrir detalle al hacer clic en un familiar ────────────────────────────
  const handleSelectFamiliar = async (f) => {
    setLoadingDetalle(true); setDetalleError(null);
    try {
      const { data } = await getFamiliarDetalle(f.paciente_id);
      setSelected(data);
    } catch {
      setDetalleError('No se pudo cargar el detalle del familiar.');
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleBack = () => { setSelected(null); setDetalleError(null); };

  const handleDesvinculado = (msg) => {
    setSelected(null);
    fetchFamiliares();
    if (onSuccess) onSuccess(msg);
  };

  const handleFamiliarSuccess = (msg) => {
    if (selected) {
      // Refrescar detalle del familiar editado
      getFamiliarDetalle(selected.paciente_id)
        .then(({ data }) => setSelected(data))
        .catch(() => {});
    }
    if (onSuccess) onSuccess(msg);
  };

  // ── Modal registrar ───────────────────────────────────────────────────────
  const openModal = () => {
    setForm(FORM_EMPTY); setTouched({}); setErrors({});
    setServerError(null); setCandidato(null);
    setShowModal(true);
  };
  const closeModal = () => {
    if (submitting || confirming) return;
    setShowModal(false); setCandidato(null);
  };

  // Permite abrir el modal de registro desde fuera (ej. wizard de reserva de cita, WEB-HU003)
  useEffect(() => {
    if (autoOpenRegister) {
      openModal();
      if (onAutoOpenHandled) onAutoOpenHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenRegister]);

  const handleChange = (e) => {
    const { name } = e.target;
    let value = e.target.value;
    if (name === 'nombre' || name === 'apellido') value = value.toUpperCase();
    const next = { ...form, [name]: value };
    if (name === 'tipo_documento') next.numero_documento = '';
    setForm(next);
    if (touched[name]) setErrors(validateForm(next));
    if (serverError)   setServerError(null);
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    setErrors(validateForm(form));
  };

  const handleSubmit = async () => {
    const allTouched = Object.fromEntries(Object.keys(FORM_EMPTY).map((k) => [k, true]));
    setTouched(allTouched);
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true); setServerError(null);
    try {
      const { data } = await registrarFamiliar({
        parentesco:           form.parentesco,
        tipo_documento:       form.tipo_documento,
        numero_documento:     form.numero_documento.trim(),
        nombre:               form.nombre.trim(),
        apellido:             form.apellido.trim(),
        fecha_nacimiento:     form.fecha_nacimiento,
        sexo:                 form.sexo,
        contacto_emergencia:  form.contacto_emergencia.trim(),
      });
      if (data.requiere_confirmacion) { setCandidato(data.candidato); return; }
      await fetchFamiliares();
      setShowModal(false);
      if (onSuccess) onSuccess(data.message);
    } catch (err) {
      setServerError(err?.response?.data?.error ?? err?.message ?? 'Error al registrar el familiar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmar = async () => {
    setConfirming(true); setServerError(null);
    try {
      await registrarFamiliar({
        parentesco:       form.parentesco,
        tipo_documento:   form.tipo_documento,
        numero_documento: form.numero_documento.trim(),
        nombre:           form.nombre.trim(),
        apellido:         form.apellido.trim(),
        fecha_nacimiento: form.fecha_nacimiento,
        sexo:             form.sexo,
        confirmar:        true,
      });
      await fetchFamiliares();
      setShowModal(false); setCandidato(null);
      if (onSuccess) onSuccess('Familiar vinculado a tu cuenta correctamente');
    } catch (err) {
      setServerError(err.response?.data?.error ?? 'Error al vincular el familiar.');
      setCandidato(null);
    } finally {
      setConfirming(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Vista de carga del detalle
  if (loadingDetalle) return (
    <div className="flex justify-center py-16">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );

  // Vista detalle de familiar seleccionado
  if (selected) return (
    <FamiliarDetalle
      familiar={selected}
      onBack={handleBack}
      onDesvinculado={handleDesvinculado}
      onSuccess={handleFamiliarSuccess}
    />
  );

  // Vista lista
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-700">Mis familiares</h2>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-bold
                       px-3 py-2 rounded-lg hover:bg-[#78b52c] transition-colors"
          >
            <UserPlus size={14} /> Registrar familiar
          </button>
        </div>

        {detalleError && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50
                          border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={16} /> {detalleError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : listError ? (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50
                          border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={16} /> {listError}
          </div>
        ) : familiares.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-14 flex flex-col
                          items-center gap-3 text-center px-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Users size={24} className="text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600">Aún no tienes familiares registrados</p>
              <p className="text-xs text-slate-400 mt-1">
                Vincula a tus familiares para gestionar sus citas desde tu cuenta.
              </p>
            </div>
            <button
              onClick={openModal}
              className="mt-1 inline-flex items-center gap-1.5 bg-accent text-white text-sm
                         font-bold px-4 py-2 rounded-xl hover:bg-[#78b52c] transition-colors"
            >
              <UserPlus size={14} /> Registrar familiar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {familiares.map((f) => {
              const edad = calcEdad(f.fecha_nacimiento);
              return (
                <button
                  key={f.relacion_id}
                  onClick={() => handleSelectFamiliar(f)}
                  className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-xl
                             border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/30
                             hover:-translate-y-0.5 transition-all duration-200 text-left group"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center
                                  justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <span className="text-sm font-black text-primary select-none">
                      {iniciales(f.nombre, f.apellido)}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {toTitle(f.nombre)} {toTitle(f.apellido)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {labelParentesco(f.parentesco)}
                      {edad !== null ? ` · ${edad} años` : ''}
                    </p>
                  </div>
                  {/* Doc + flecha */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:block text-xs text-slate-400">
                      {f.tipo_documento} {f.numero_documento}
                    </span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal registrar familiar (HU008) ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 sm:px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                          flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-4
                            border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-800">
                {candidato ? 'Confirmar vinculación' : 'Registrar familiar'}
              </h2>
              <button onClick={closeModal} disabled={submitting || confirming}
                className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
                <X size={19} />
              </button>
            </div>

            {/* Vista confirmación */}
            {candidato ? (
              <div className="px-5 py-6 flex flex-col gap-5">
                <p className="text-sm text-slate-600">
                  Este DNI ya está registrado en el sistema. ¿Es tu familiar?
                  Confirma para vincularlo a tu cuenta.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 space-y-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {toTitle(candidato.nombre)} {toTitle(candidato.apellido)}
                  </p>
                  {candidato.edad !== null && (
                    <p className="text-xs text-slate-500">{candidato.edad} años</p>
                  )}
                </div>
                {serverError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                  text-red-700 text-sm rounded-lg px-3 py-3">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setCandidato(null); setServerError(null); }}
                    disabled={confirming}
                    className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm
                               font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40">
                    No, cancelar
                  </button>
                  <button onClick={handleConfirmar} disabled={confirming}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent text-white
                               font-bold text-sm py-2.5 rounded-xl hover:bg-[#78b52c]
                               disabled:opacity-40 transition-colors">
                    {confirming
                      ? <><Loader2 size={15} className="animate-spin" /> Vinculando…</>
                      : <><Check size={15} /> Sí, es mi familiar</>}
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario registro */
              <>
                <div className="overflow-y-auto px-5 py-5 space-y-4">
                  <Field label="Parentesco" error={touched.parentesco && errors.parentesco} required>
                    <select name="parentesco" value={form.parentesco}
                      onChange={handleChange} onBlur={handleBlur}
                      className={sel(touched.parentesco && errors.parentesco)}>
                      <option value="">Selecciona</option>
                      {PARENTESCOS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-5 gap-2">
                    <Field label="Tipo" error={touched.tipo_documento && errors.tipo_documento} required>
                      <select name="tipo_documento" value={form.tipo_documento}
                        onChange={handleChange} onBlur={handleBlur}
                        className={sel(touched.tipo_documento && errors.tipo_documento)}>
                        {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <div className="col-span-4">
                      <Field label="Número de documento" error={touched.numero_documento && errors.numero_documento} required>
                        <div className="relative">
                          <input type="text" name="numero_documento" value={form.numero_documento}
                            onChange={handleChange} onBlur={handleBlur}
                            maxLength={MAX_DOC[form.tipo_documento] ?? 12}
                            placeholder={form.tipo_documento === 'DNI' ? '12345678' : ''}
                            className={inp(touched.numero_documento && errors.numero_documento)}
                            disabled={reniecLoading} />
                          {reniecLoading && (
                            <div className="absolute right-3 top-2.5">
                              <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            </div>
                          )}
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nombres" error={touched.nombre && errors.nombre} required>
                      <input type="text" name="nombre" value={form.nombre}
                        onChange={handleChange} onBlur={handleBlur}
                        maxLength={30}
                        className={inp(touched.nombre && errors.nombre) + (form.tipo_documento === 'DNI' ? ' bg-slate-100 cursor-not-allowed text-slate-500' : '')}
                        readOnly={form.tipo_documento === 'DNI'} />
                    </Field>
                    <Field label="Apellidos" error={touched.apellido && errors.apellido} required>
                      <input type="text" name="apellido" value={form.apellido}
                        onChange={handleChange} onBlur={handleBlur}
                        maxLength={30}
                        className={inp(touched.apellido && errors.apellido) + (form.tipo_documento === 'DNI' ? ' bg-slate-100 cursor-not-allowed text-slate-500' : '')}
                        readOnly={form.tipo_documento === 'DNI'} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Fecha de nacimiento" error={touched.fecha_nacimiento && errors.fecha_nacimiento} required>
                      <input type="date" name="fecha_nacimiento" value={form.fecha_nacimiento}
                        onChange={handleChange} onBlur={handleBlur}
                        max={new Date().toISOString().split('T')[0]}
                        className={inp(touched.fecha_nacimiento && errors.fecha_nacimiento)} />
                    </Field>
                    <Field label="Género" error={touched.sexo && errors.sexo} required>
                      <select name="sexo" value={form.sexo}
                        onChange={handleChange} onBlur={handleBlur}
                        className={sel(touched.sexo && errors.sexo)}>
                        <option value="">Selecciona</option>
                        {SEXOS.map((s) => <option key={s} value={s}>{toTitle(s)}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Contacto de emergencia" error={touched.contacto_emergencia && errors.contacto_emergencia} required>
                    <input type="tel" name="contacto_emergencia" value={form.contacto_emergencia}
                      onChange={handleChange} onBlur={handleBlur}
                      maxLength={9} placeholder="987654321"
                      className={inp(touched.contacto_emergencia && errors.contacto_emergencia)} />
                    <p className="text-[11px] text-slate-400 -mt-0.5">
                      Un número por el que el consultorio pueda contactar a este familiar.
                    </p>
                  </Field>

                  {serverError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                    text-red-700 text-sm rounded-lg px-3 py-3">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{serverError}</span>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                  <button onClick={closeModal} disabled={submitting}
                    className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm
                               font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40">
                    Cancelar
                  </button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent text-white
                               font-bold text-sm py-2.5 rounded-xl hover:bg-[#78b52c]
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {submitting
                      ? <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                      : <><Check size={15} /> Registrar familiar</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
