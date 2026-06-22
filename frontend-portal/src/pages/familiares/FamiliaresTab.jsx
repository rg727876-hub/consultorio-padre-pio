import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, X, Loader2, AlertCircle, Check,
  Users, ChevronRight,
} from 'lucide-react';
import { getFamiliares, registrarFamiliar } from '../../services/patientFamily.service';

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

const FORM_EMPTY = {
  parentesco: '', tipo_documento: 'DNI', numero_documento: '',
  nombre: '', apellido: '', fecha_nacimiento: '', sexo: '', contacto_emergencia: '',
};

// ── Validación del formulario ─────────────────────────────────────────────────
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
  if (f.contacto_emergencia && !RE_TEL.test(f.contacto_emergencia.replace(/\D/g, '')))
                                        e.contacto_emergencia = 'Debe tener 9 dígitos';
  return e;
};

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

// ── Tarjeta de familiar ───────────────────────────────────────────────────────
function FamiliarCard({ f }) {
  const edad = calcEdad(f.fecha_nacimiento);
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-black text-primary select-none">
          {(f.nombre.charAt(0) + f.apellido.charAt(0)).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {toTitle(f.nombre)} {toTitle(f.apellido)}
        </p>
        <p className="text-xs text-slate-500">
          {toTitle(f.parentesco)}{edad !== null ? ` · ${edad} años` : ''}
        </p>
      </div>
      <span className="text-xs text-slate-400 shrink-0">
        {f.tipo_documento} {f.numero_documento}
      </span>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FamiliaresTab({ onSuccess }) {
  const [familiares, setFamiliares]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [listError, setListError]     = useState(null);

  const [showModal, setShowModal]     = useState(false);

  // Estados del formulario
  const [form, setForm]               = useState(FORM_EMPTY);
  const [touched, setTouched]         = useState({});
  const [errors, setErrors]           = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [serverError, setServerError] = useState(null);

  // Estado del modal de confirmación (B1)
  const [candidato, setCandidato]     = useState(null); // { nombre, apellido, edad }
  const [confirming, setConfirming]   = useState(false);

  const fetchFamiliares = useCallback(async () => {
    setLoading(true); setListError(null);
    try {
      const { data } = await getFamiliares();
      setFamiliares(data.familiares ?? []);
    } catch {
      setListError('No se pudo cargar la lista de familiares.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFamiliares(); }, [fetchFamiliares]);

  // ── Abrir / cerrar modal ──────────────────────────────────────────────────
  const openModal = () => {
    setForm(FORM_EMPTY); setTouched({}); setErrors({});
    setServerError(null); setCandidato(null);
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting || confirming) return;
    setShowModal(false); setCandidato(null);
  };

  // ── Cambios en el formulario ──────────────────────────────────────────────
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

  // ── Enviar formulario (Paso 1) ────────────────────────────────────────────
  const handleSubmit = async () => {
    const allTouched = Object.fromEntries(
      Object.keys(FORM_EMPTY).map((k) => [k, true])
    );
    setTouched(allTouched);
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true); setServerError(null);
    try {
      const payload = {
        parentesco:           form.parentesco,
        tipo_documento:       form.tipo_documento,
        numero_documento:     form.numero_documento.trim(),
        nombre:               form.nombre.trim(),
        apellido:             form.apellido.trim(),
        fecha_nacimiento:     form.fecha_nacimiento,
        sexo:                 form.sexo,
        contacto_emergencia:  form.contacto_emergencia.trim() || undefined,
      };
      const { data } = await registrarFamiliar(payload);

      if (data.requiere_confirmacion) {
        setCandidato(data.candidato);
        return;
      }

      // Éxito directo (Caso A, B4)
      await fetchFamiliares();
      setShowModal(false);
      if (onSuccess) onSuccess(data.message);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Error al registrar el familiar. Intenta nuevamente.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmar vinculación B1 (Paso 2) ────────────────────────────────────
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
      const msg = err.response?.data?.error ?? 'Error al vincular el familiar.';
      setServerError(msg);
      setCandidato(null); // Vuelve al formulario
    } finally {
      setConfirming(false);
    }
  };

  const formErrs = validateForm(form);
  const canSubmit = Object.keys(formErrs).length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Lista ── */}
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
          <div className="bg-white rounded-xl border border-slate-200 py-12 flex flex-col
                          items-center gap-3 text-center px-4">
            <Users size={32} className="text-slate-300" />
            <p className="text-sm text-slate-500">Aún no tienes familiares registrados.</p>
            <button
              onClick={openModal}
              className="mt-1 text-sm font-semibold text-accent hover:underline flex items-center gap-1"
            >
              Registrar mi primer familiar <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {familiares.map((f) => <FamiliarCard key={f.relacion_id} f={f} />)}
          </div>
        )}
      </div>

      {/* ── Modal flotante ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 sm:px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                          flex flex-col max-h-[92vh]">

            {/* Cabecera */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4
                            border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-800">
                {candidato ? 'Confirmar vinculación' : 'Registrar familiar'}
              </h2>
              <button
                onClick={closeModal}
                disabled={submitting || confirming}
                className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
              >
                <X size={19} />
              </button>
            </div>

            {/* ── Vista de confirmación B1 ── */}
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
                  <button
                    onClick={() => { setCandidato(null); setServerError(null); }}
                    disabled={confirming}
                    className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm
                               font-semibold text-slate-600 hover:bg-slate-50 transition-colors
                               disabled:opacity-40"
                  >
                    No, cancelar
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={confirming}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent text-white
                               font-bold text-sm py-2.5 rounded-xl hover:bg-[#78b52c]
                               disabled:opacity-40 transition-colors"
                  >
                    {confirming
                      ? <><Loader2 size={15} className="animate-spin" /> Vinculando…</>
                      : <><Check size={15} /> Sí, es mi familiar</>}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Formulario ── */
              <>
                <div className="overflow-y-auto px-5 py-5 space-y-4">

                  {/* Parentesco */}
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

                  {/* Documento */}
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
                        <input type="text" name="numero_documento" value={form.numero_documento}
                          onChange={handleChange} onBlur={handleBlur}
                          maxLength={MAX_DOC[form.tipo_documento] ?? 12}
                          placeholder={form.tipo_documento === 'DNI' ? '12345678' : ''}
                          className={inp(touched.numero_documento && errors.numero_documento)} />
                      </Field>
                    </div>
                  </div>

                  {/* Nombre y apellido */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nombres" error={touched.nombre && errors.nombre} required>
                      <input type="text" name="nombre" value={form.nombre}
                        onChange={handleChange} onBlur={handleBlur}
                        maxLength={30} className={inp(touched.nombre && errors.nombre)} />
                    </Field>
                    <Field label="Apellidos" error={touched.apellido && errors.apellido} required>
                      <input type="text" name="apellido" value={form.apellido}
                        onChange={handleChange} onBlur={handleBlur}
                        maxLength={30} className={inp(touched.apellido && errors.apellido)} />
                    </Field>
                  </div>

                  {/* Fecha de nacimiento y género */}
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

                  {/* Contacto de emergencia (opcional) */}
                  <Field label="Contacto de emergencia (opcional)" error={touched.contacto_emergencia && errors.contacto_emergencia}>
                    <input type="tel" name="contacto_emergencia" value={form.contacto_emergencia}
                      onChange={handleChange} onBlur={handleBlur}
                      maxLength={9} placeholder="987654321"
                      className={inp(touched.contacto_emergencia && errors.contacto_emergencia)} />
                    <p className="text-[11px] text-slate-400 -mt-0.5">
                      No requerido para familiares menores de edad.
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

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                  <button
                    onClick={closeModal}
                    disabled={submitting}
                    className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm
                               font-semibold text-slate-600 hover:bg-slate-50 transition-colors
                               disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent text-white
                               font-bold text-sm py-2.5 rounded-xl hover:bg-[#78b52c]
                               disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
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
