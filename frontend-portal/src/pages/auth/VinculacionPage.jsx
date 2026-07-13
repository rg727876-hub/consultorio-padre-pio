import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, LinkIcon, ChevronDown, Check } from 'lucide-react';
import { previewPatient, vincularPatient } from '../../services/authPatient.service';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';

const RE_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PASSWORD = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const RE_DNI      = /^\d{8}$/;
const RE_CE       = /^[A-Za-z0-9]{9,12}$/;
const RE_PASAPORTE = /^[A-Za-z0-9]{6,12}$/;

const DOC_RULES = {
  DNI:       { regex: RE_DNI,       msg: 'Debe tener 8 dígitos numéricos' },
  CE:        { regex: RE_CE,        msg: 'Debe tener entre 9 y 12 caracteres alfanuméricos' },
  PASAPORTE: { regex: RE_PASAPORTE, msg: 'Debe tener entre 6 y 12 caracteres alfanuméricos' },
};

// ── Subcomponentes ────────────────────────────────────────────────────────────
function Field({ label, error, touched, children, required = true }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {touched && error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (touched, error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
   focus:ring-2 focus:ring-primary/30
   ${touched && error
     ? 'border-red-400 bg-red-50 focus:border-red-400'
     : 'border-slate-300 bg-white focus:border-primary'}`;

// ── Select con menú propio (reemplaza el <select> nativo) ────────────────────
function CustomSelect({ name, value, onChange, onBlur, options, error, touched }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen((wasOpen) => {
          if (wasOpen) onBlur?.({ target: { name, value } });
          return false;
        });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, value]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls(touched, error)} flex items-center justify-between gap-2 text-left`}
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : 'Seleccionar...'}
        </span>
        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange({ target: { name, value: opt.value, type: 'select-one' } });
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between
                ${opt.value === value ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {opt.label}
              {opt.value === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fondo con textura de puntos + separación curva decorativa ────────────────
function DottedBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #00000014 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="absolute -top-48 -left-48 w-[560px] h-[560px] sm:w-[720px] sm:h-[720px] rounded-full bg-primary/[0.06]" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-accent/10" />
    </div>
  );
}

// ── Pantalla de éxito ─────────────────────────────────────────────────────────
function SuccessScreen({ esFamiliar }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 size={56} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-3">
          {esFamiliar ? '¡Cuenta activada!' : '¡Cuenta vinculada!'}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          {esFamiliar
            ? 'Tu cuenta ha sido activada exitosamente. Ya puedes iniciar sesión.'
            : 'Cuenta vinculada exitosamente. Ya puedes iniciar sesión con tu correo y contraseña. Tu historial clínico y citas previas se conservan intactos.'}
        </p>
        <Link
          to="/login"
          className="inline-block bg-primary text-white font-semibold text-sm px-8 py-3
                     rounded-lg hover:bg-blue-700 transition-colors"
        >
          Ir al inicio de sesión
        </Link>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function VinculacionPage() {
  const navigate   = useNavigate();
  const location   = useLocation();

  // El documento puede venir desde RegisterPage vía router state
  const stateDoc = location.state ?? null;

  // ── Step 1: buscar documento (si no viene en state) ──────────────────────
  const [docForm, setDocForm]     = useState({
    tipo_documento:   stateDoc?.tipo_documento   ?? 'DNI',
    numero_documento: stateDoc?.numero_documento ?? '',
  });
  const [docError, setDocError]   = useState(null); // { msg, codigo }
  const [docLoading, setDocLoading] = useState(false);

  // ── Step 2: datos preview + formulario ───────────────────────────────────
  const [preview, setPreview]     = useState(null); // { iniciales, tipo_documento, documento_parcial }
  const [docInfo, setDocInfo]     = useState(null); // guardamos { tipo_documento, numero_documento } para el submit

  const [form, setForm] = useState({
    fecha_nacimiento: '',
    email:            '',
    password:         '',
    confirmar_password: '',
    acepta_politica:  false,
  });
  const [touched, setTouched]     = useState({});
  const [errors, setErrors]       = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [success, setSuccess]     = useState(false);

  // Si viene el documento en state, hacer el preview automáticamente
  useEffect(() => {
    if (stateDoc?.tipo_documento && stateDoc?.numero_documento) {
      fetchPreview(stateDoc.tipo_documento, stateDoc.numero_documento);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreview = async (tipo, numero) => {
    setDocLoading(true);
    setDocError(null);
    try {
      const { data } = await previewPatient({ tipo_documento: tipo, numero_documento: numero });
      setPreview(data);
      setDocInfo({ tipo_documento: tipo, numero_documento: numero });
    } catch (err) {
      const data = err.response?.data;
      setDocError({
        msg:    data?.error  ?? 'No se encontró un registro vinculable con ese documento.',
        codigo: data?.codigo ?? null,
      });
      setPreview(null);
    } finally {
      setDocLoading(false);
    }
  };

  const handleDocSubmit = async (e) => {
    e.preventDefault();
    const rule = DOC_RULES[docForm.tipo_documento];
    if (!docForm.numero_documento.trim() || !rule.regex.test(docForm.numero_documento.trim())) {
      setDocError({ msg: rule.msg, codigo: null });
      return;
    }
    await fetchPreview(docForm.tipo_documento, docForm.numero_documento.trim());
  };

  // ── Validar campos del formulario de vinculación ──────────────────────────
  const validarCampo = (nombre, valor) => {
    switch (nombre) {
      case 'fecha_nacimiento': {
        if (!valor) return 'Campo requerido';
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const dob = new Date(valor + 'T00:00:00');
        if (dob >= hoy) return 'Debe ser anterior al día de hoy';
        const edad = Math.floor((hoy - dob) / (1000 * 60 * 60 * 24 * 365.25));
        if (edad < 18) {
          return preview?.es_familiar
            ? 'Solo mayores de 18 años pueden activar su propia cuenta web'
            : 'Debes ser mayor de 18 años para vincular tu cuenta';
        }
        if (edad > 120) return 'Fecha de nacimiento no válida';
        return '';
      }
      case 'email':
        if (!valor.trim()) return 'Campo requerido';
        return RE_EMAIL.test(valor.trim()) ? '' : 'Formato de correo inválido';
      case 'password':
        if (!valor) return 'Campo requerido';
        return RE_PASSWORD.test(valor)
          ? '' : 'Mínimo 8 caracteres, una mayúscula, un número y un carácter especial';
      case 'confirmar_password':
        if (!valor) return 'Campo requerido';
        return valor === form.password ? '' : 'Las contraseñas no coinciden';
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newVal = type === 'checkbox' ? checked : value;
    const newForm = { ...form, [name]: newVal };
    setForm(newForm);
    if (touched[name]) setErrors((prev) => ({ ...prev, [name]: validarCampo(name, newVal) }));
    if (serverError) setServerError(null);
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const campos = ['fecha_nacimiento', 'email', 'password', 'confirmar_password'];
    const newErrors = {};
    const newTouched = {};
    campos.forEach((c) => {
      newTouched[c] = true;
      newErrors[c]  = validarCampo(c, form[c]);
    });
    setTouched(newTouched);
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    if (!form.acepta_politica) {
      setServerError('Debes aceptar la Política de Privacidad para continuar.');
      return;
    }

    setLoading(true);
    setServerError(null);
    try {
      await vincularPatient({
        tipo_documento:     docInfo.tipo_documento,
        numero_documento:   docInfo.numero_documento,
        fecha_nacimiento:   form.fecha_nacimiento,
        email:              form.email.trim().toLowerCase(),
        password:           form.password,
        confirmar_password: form.confirmar_password,
        acepta_politica:    form.acepta_politica,
      });
      setSuccess(true);
    } catch (err) {
      const data   = err.response?.data;
      const msg    = data?.error ?? 'Ocurrió un error. Intenta nuevamente.';
      setServerError({ msg, codigo: data?.codigo });
    } finally {
      setLoading(false);
    }
  };

  if (success) return <SuccessScreen esFamiliar={preview?.es_familiar} />;

  return (
    <>
      {showPolicy && (
        <PrivacyPolicyModal
          onClose={() => setShowPolicy(false)}
          onAccept={() => { setForm((p) => ({ ...p, acepta_politica: true })); setShowPolicy(false); }}
        />
      )}

      <div className="relative z-0 min-h-screen overflow-hidden bg-slate-50 flex flex-col items-center justify-center py-10 px-4">
        <DottedBackground />

        {/* Cabecera */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Consultorio Padre Pio</h1>
          <p className="text-slate-500 text-sm mt-1">Vincula tu cuenta web con tu historial</p>
        </div>

        <div className="w-full max-w-md">

          {/* ── STEP 1: si no hay preview, mostrar búsqueda de documento ── */}
          {!preview && (
            <>
              <div className="relative bg-white rounded-2xl rounded-bl-sm shadow-md px-5 py-4 mb-6">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Si ya tienes historial clínico en el consultorio, ingresa tu documento
                  para vincular tu cuenta web sin perder tus datos.
                </p>
                <span className="absolute -bottom-2 left-6 w-4 h-4 bg-white rotate-45 rounded-sm" />
              </div>

              {docError && docError.codigo === 'CUENTA_ACTIVA' && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  <p className="flex items-center gap-2 font-medium">
                    <AlertCircle size={15} className="shrink-0" /> {docError.msg}
                  </p>
                  <p className="mt-1">
                    <Link to="/login" className="underline font-semibold">Ir al inicio de sesión →</Link>
                  </p>
                </div>
              )}
              {docError && ['MENOR_DE_EDAD', 'MENOR_DE_EDAD_FAMILIAR'].includes(docError.codigo) && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" /> {docError.msg}
                  </p>
                </div>
              )}
              {docError && !['CUENTA_ACTIVA', 'MENOR_DE_EDAD', 'MENOR_DE_EDAD_FAMILIAR'].includes(docError.codigo) && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> {docError.msg}
                </div>
              )}

              <form onSubmit={handleDocSubmit} noValidate className="space-y-4">
                <Field label="Tipo de documento" touched error="">
                  <CustomSelect
                    name="tipo_documento"
                    value={docForm.tipo_documento}
                    onChange={(e) => setDocForm((p) => ({ ...p, tipo_documento: e.target.value }))}
                    options={[
                      { value: 'DNI', label: 'DNI' },
                      { value: 'CE', label: 'Carnet de Extranjería' },
                      { value: 'PASAPORTE', label: 'Pasaporte' },
                    ]}
                  />
                </Field>
                <Field label="Número de documento" touched={!!docError} error={docError?.msg}>
                  <input
                    type="text"
                    value={docForm.numero_documento}
                    onChange={(e) => { setDocForm((p) => ({ ...p, numero_documento: e.target.value })); setDocError(null); }}
                    placeholder={docForm.tipo_documento === 'DNI' ? '12345678' : 'Número de documento'}
                    maxLength={docForm.tipo_documento === 'DNI' ? 8 : 12}
                    className={inputCls(!!docError, docError?.msg)}
                  />
                </Field>

                <div className="flex justify-center pt-1">
                  <button
                    type="submit"
                    disabled={docLoading}
                    className="bg-primary text-white font-semibold text-sm px-10 py-3 rounded-full
                               hover:bg-blue-700 disabled:opacity-50 transition-colors
                               shadow-lg shadow-primary/40 flex items-center justify-center gap-2"
                  >
                    {docLoading
                      ? <><Loader2 size={16} className="animate-spin" /> Buscando…</>
                      : 'Buscar mi registro'}
                  </button>
                </div>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500">
                <button onClick={() => navigate(-1)} className="text-primary font-medium hover:underline">
                  ← Volver
                </button>
              </p>
            </>
          )}

          {/* ── STEP 2: preview + formulario de vinculación ── */}
          {preview && (
            <>
              {/* Tarjeta de reconocimiento */}
              <div className={`flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl ${preview.es_familiar ? 'mb-4' : 'mb-6'}`}>
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center
                                text-white font-black text-base select-none shrink-0">
                  {preview.es_familiar ? preview.nombre_completo.charAt(0) : preview.iniciales}
                </div>
                <div>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-0.5">
                    Registro encontrado
                  </p>
                  {preview.es_familiar ? (
                    <p className="text-sm font-bold text-slate-800">
                      {preview.nombre_completo} · {preview.edad} años
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-slate-800">
                      {preview.tipo_documento} {preview.documento_parcial}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-0.5">
                    ¿No eres tú?{' '}
                    <button
                      onClick={() => { setPreview(null); setDocInfo(null); }}
                      className="text-primary underline"
                    >
                      Cambiar documento
                    </button>
                  </p>
                </div>
              </div>

              {preview.es_familiar && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 leading-relaxed">
                  Este DNI está vinculado como familiar a otra cuenta. ¿Deseas activar tu cuenta web propia?
                  Al activar, te desvincularás automáticamente de los titulares que te tenían registrado y
                  tendrás control total sobre tu información.
                </div>
              )}

              {/* Error del servidor */}
              {serverError && (
                <div className={`mb-5 rounded-lg border px-4 py-3 text-sm
                  ${serverError.codigo === 'CUENTA_ACTIVA'
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <p className="flex items-center gap-2">
                    <AlertCircle size={15} /> {serverError.msg}
                  </p>
                  {(serverError.codigo === 'EMAIL_DUPLICADO' || serverError.codigo === 'CUENTA_ACTIVA') && (
                    <p className="mt-1">
                      <Link to="/login" className="underline font-semibold">Ir al inicio de sesión →</Link>
                    </p>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                <Field label="Fecha de nacimiento" error={errors.fecha_nacimiento} touched={touched.fecha_nacimiento}>
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    value={form.fecha_nacimiento}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    max={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().split('T')[0]; })()}
                    min={(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 120); return d.toISOString().split('T')[0]; })()}
                    className={inputCls(touched.fecha_nacimiento, errors.fecha_nacimiento)}
                  />
                  <p className="text-xs text-slate-400">Para verificar tu identidad. Debes ser mayor de 18 años.</p>
                </Field>

                <Field label="Correo electrónico" error={errors.email} touched={touched.email}>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="correo@ejemplo.com"
                    className={inputCls(touched.email, errors.email)}
                  />
                </Field>

                <Field label="Contraseña" error={errors.password} touched={touched.password}>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Mín. 8 caracteres"
                      className={`${inputCls(touched.password, errors.password)} pr-10`}
                    />
                    <button type="button" onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                {form.password && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {[
                      { ok: form.password.length >= 8,           label: 'Mínimo 8 caracteres' },
                      { ok: /[A-Z]/.test(form.password),         label: 'Una mayúscula' },
                      { ok: /\d/.test(form.password),            label: 'Un número' },
                      { ok: /[^A-Za-z0-9]/.test(form.password),  label: 'Un carácter especial' },
                    ].map(({ ok, label }) => (
                      <p key={label} className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                        <CheckCircle2 size={12} /> {label}
                      </p>
                    ))}
                  </div>
                )}

                <Field label="Confirmar contraseña" error={errors.confirmar_password} touched={touched.confirmar_password}>
                  <div className="relative">
                    <input
                      type={showPass2 ? 'text' : 'password'}
                      name="confirmar_password"
                      value={form.confirmar_password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Repite la contraseña"
                      className={`${inputCls(touched.confirmar_password, errors.confirmar_password)} pr-10`}
                    />
                    <button type="button" onClick={() => setShowPass2((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}>
                      {showPass2 ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                {/* Política de privacidad */}
                <div className="flex items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="acepta_politica"
                    name="acepta_politica"
                    checked={form.acepta_politica}
                    onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer"
                  />
                  <label htmlFor="acepta_politica" className="text-sm text-slate-600 cursor-pointer">
                    He leído y acepto la{' '}
                    <button type="button" onClick={() => setShowPolicy(true)}
                      className="text-primary underline hover:text-blue-700 font-medium">
                      Política de Privacidad
                    </button>{' '}
                    del Consultorio Padre Pio
                  </label>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="flex-1 border border-slate-300 text-slate-600 font-semibold text-sm
                               py-3 rounded-full hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !form.acepta_politica}
                    className="flex-1 bg-primary text-white font-semibold text-sm py-3 rounded-full
                               hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                               transition-colors shadow-lg shadow-primary/40 flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" /> {preview.es_familiar ? 'Activando…' : 'Vinculando…'}</>
                      : <><LinkIcon size={15} /> {preview.es_familiar ? 'Activar mi cuenta' : 'Vincular mi cuenta'}</>}
                  </button>
                </div>

              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}
