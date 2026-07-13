import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Camera, ArrowUpRight, ChevronDown, Check } from 'lucide-react';
import { registerPatient } from '../../services/authPatient.service';
import { consultarDniReniec } from '../../services/public.service';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';

// ── Mensajes rotativos de la burbuja del panel fotográfico ───────────────────
const BUBBLE_MESSAGES = [
  {
    titulo: '¿Cuándo fue la última vez que fuiste al dentista? 🗓️',
    texto:  'Si ya pasaron más de 6 meses, este es el momento ideal para retomar el control de tu salud bucal.',
  },
  {
    titulo: 'Prevenir es mucho mejor (y más barato) 💡✨',
    texto:  'Una simple revisión a tiempo evita tratamientos complejos y dolorosos en el futuro. Cuidarte es una inversión.',
  },
  {
    titulo: '¡Espera un momento! 🚨',
    texto:  'No necesitas memorizar tus fechas ni perder tus recetas. Estamos aquí para automatizar y simplificar tu cuidado.',
  },
  {
    titulo: '¡Estás a un paso de una sonrisa increíble! 🚀🤍',
    texto:  'Regístrate ahora para agendar tu primera cita, guardar tu historial y recibir recordatorios personalizados.',
  },
];

// ── Reglas de validación (espejo del backend) ────────────────────────────────
const RE_DNI       = /^\d{8}$/;
const RE_CE        = /^[A-Za-z0-9]{9,12}$/;
const RE_PASAPORTE = /^[A-Za-z0-9]{6,12}$/;
const RE_EMAIL     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONO  = /^\d{9}$/;
const RE_PASSWORD  = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const DOC_RULES = {
  DNI:       { regex: RE_DNI,       msg: 'Debe tener 8 dígitos numéricos' },
  CE:        { regex: RE_CE,        msg: 'Debe tener entre 9 y 12 caracteres alfanuméricos' },
  PASAPORTE: { regex: RE_PASAPORTE, msg: 'Debe tener entre 6 y 12 caracteres alfanuméricos' },
};

const ESTADO_INICIAL = {
  tipo_documento:    'DNI',
  numero_documento:  '',
  nombre:            '',
  apellido:          '',
  fecha_nacimiento:  '',
  sexo:              '',
  telefono:          '',
  email:             '',
  password:          '',
  confirmar_password: '',
  acepta_politica:   false,
};

// ── Validar un campo individual ───────────────────────────────────────────────
function validarCampo(nombre, valor, form) {
  switch (nombre) {
    case 'numero_documento': {
      const rule = DOC_RULES[form.tipo_documento];
      if (!valor.trim()) return 'Campo requerido';
      if (!rule.regex.test(valor.trim())) return rule.msg;
      return '';
    }
    case 'nombre':
    case 'apellido': {
      const v = valor.trim();
      if (!v) return 'Campo requerido';
      if (v.length < 2)  return 'Mínimo 2 caracteres';
      if (v.length > 30) return 'Máximo 30 caracteres';
      return '';
    }
    case 'fecha_nacimiento': {
      if (!valor) return 'Campo requerido';
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const dob = new Date(valor + 'T00:00:00');
      if (dob >= hoy) return 'Debe ser anterior al día de hoy';
      const edad = Math.floor((hoy - dob) / (1000 * 60 * 60 * 24 * 365.25));
      if (edad < 18) return 'Debes ser mayor de 18 años para registrarte';
      if (edad > 120) return 'Fecha de nacimiento no válida';
      return '';
    }
    case 'sexo':
      return valor ? '' : 'Selecciona una opción';
    case 'telefono':
      return RE_TELEFONO.test(valor.replace(/\D/g, '')) ? '' : 'Debe tener 9 dígitos';
    case 'email':
      if (!valor.trim()) return 'Campo requerido';
      return RE_EMAIL.test(valor.trim()) ? '' : 'Formato de correo inválido';
    case 'password':
      if (!valor) return 'Campo requerido';
      return RE_PASSWORD.test(valor)
        ? ''
        : 'Mínimo 8 caracteres, una mayúscula, un número y un carácter especial';
    case 'confirmar_password':
      if (!valor) return 'Campo requerido';
      return valor === form.password ? '' : 'Las contraseñas no coinciden';
    default:
      return '';
  }
}

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
  `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors
   focus:ring-2 focus:ring-primary/30 focus:bg-white
   ${touched && error
     ? 'border-red-300 bg-red-50 focus:border-red-400'
     : 'border-transparent bg-slate-100 focus:border-primary/30'}`;

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
  }, [name, value, onBlur]);

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

// ── Pantalla de éxito ─────────────────────────────────────────────────────────
function SuccessScreen({ email }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle2 size={56} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-3">¡Registro exitoso!</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Has completado tu registro. Te enviamos un correo de bienvenida a{' '}
          <span className="font-medium text-primary">{email}</span>.{' '}
          Si no lo ves, revisa tu carpeta de spam.
        </p>
        <Link
          to="/login"
          className="inline-block bg-primary text-white font-semibold text-sm px-8 py-3 rounded-lg
                     hover:bg-blue-700 transition-colors"
        >
          Ir al inicio de sesión
        </Link>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm]           = useState(ESTADO_INICIAL);
  const [touched, setTouched]     = useState({});
  const [errors, setErrors]       = useState({});
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [reniecLoading, setReniecLoading] = useState(false);

  // ── Burbuja rotativa: cambia cada 10s o al hacer clic ──────────────────────
  const [msgIndex, setMsgIndex] = useState(0);
  const nextMsg = () => setMsgIndex((i) => (i + 1) % BUBBLE_MESSAGES.length);

  useEffect(() => {
    const id = setTimeout(nextMsg, 10000);
    return () => clearTimeout(id);
  }, [msgIndex]);

  // ── Auto-fetch RENIEC (Lógica integrada de tu compañero) ──────────────────
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
            // Solo autocompleta si el dato viene de la BD (fuente: 'bd')
            fecha_nacimiento: d.fecha_nacimiento || prev.fecha_nacimiento,
            sexo:             d.sexo             || prev.sexo,
          }));
          setErrors((prev) => ({ ...prev, nombre: null, apellido: null }));
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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newVal = type === 'checkbox' ? checked : value;
    if (name === 'nombre' || name === 'apellido') newVal = value.toUpperCase();
    const newForm = { ...form, [name]: newVal };
    setForm(newForm);

    if (name === 'tipo_documento' && touched.numero_documento) {
      setErrors((prev) => ({
        ...prev,
        numero_documento: validarCampo('numero_documento', form.numero_documento, newForm),
      }));
    }

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validarCampo(name, newVal, newForm) }));
    }

    if (serverError) setServerError(null);
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validarCampo(name, value, form) }));
  };

  const validateAll = () => {
    const campos = [
      'numero_documento', 'nombre', 'apellido', 'fecha_nacimiento',
      'sexo', 'telefono', 'email', 'password', 'confirmar_password',
    ];
    const newErrors = {};
    const newTouched = {};
    campos.forEach((c) => {
      newTouched[c] = true;
      newErrors[c]  = validarCampo(c, form[c], form);
    });
    setTouched(newTouched);
    setErrors(newErrors);
    return Object.values(newErrors).every((e) => !e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    if (!form.acepta_politica) {
      setServerError('Debes aceptar la Política de Privacidad para continuar.');
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      const formData = new FormData();
      formData.append('tipo_documento', form.tipo_documento);
      formData.append('numero_documento', form.numero_documento.trim());
      formData.append('nombre', form.nombre.trim());
      formData.append('apellido', form.apellido.trim());
      formData.append('fecha_nacimiento', form.fecha_nacimiento);
      formData.append('sexo', form.sexo);
      formData.append('telefono', form.telefono.replace(/\D/g, ''));
      formData.append('email', form.email.trim().toLowerCase());
      formData.append('password', form.password);
      formData.append('confirmar_password', form.confirmar_password);
      formData.append('acepta_politica', form.acepta_politica);
      if (imageFile) formData.append('foto', imageFile);

      await registerPatient(formData);
      setSuccess(true);
    } catch (err) {
      const data   = err.response?.data;
      const codigo = data?.codigo;
      const msg    = data?.error ?? 'Ocurrió un error. Intenta nuevamente.';
      setServerError({ msg, codigo });
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyAccept = () => {
    setForm((prev) => ({ ...prev, acepta_politica: true }));
    setShowPolicy(false);
  };

  if (success) return <SuccessScreen email={form.email.trim().toLowerCase()} />;

  return (
    <>
    {showPolicy && (
      <PrivacyPolicyModal
        onClose={() => setShowPolicy(false)}
        onAccept={handlePolicyAccept}
      />
    )}
    <div className="min-h-screen md:h-screen flex bg-white md:overflow-hidden">

      {/* ── Panel fotográfico ── */}
      <div className="hidden md:flex md:w-1/2 md:h-full relative overflow-hidden items-center justify-center order-1">
        <img src="/r.png" alt="" className="absolute inset-0 w-full h-full object-cover" />

        {/* Volver al inicio */}
        <Link
          to="/"
          className="absolute top-8 left-8 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur
                     text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-full shadow-md
                     hover:shadow-lg hover:bg-white transition-all"
        >
          <ArrowUpRight size={16} /> Volver al inicio
        </Link>

        {/* Burbuja de texto rotativa */}
        <div className="absolute top-10 right-8 lg:right-10 max-w-[230px]">
          <button
            type="button"
            onClick={nextMsg}
            className="relative block text-left bg-white rounded-2xl rounded-tr-sm shadow-lg
                       px-5 py-4 cursor-pointer hover:shadow-xl transition-shadow border border-slate-100"
          >
            <p className="font-friendly font-bold text-slate-800 text-[15px] leading-snug mb-1.5">
              {BUBBLE_MESSAGES[msgIndex].titulo}
            </p>
            <p className="font-friendly text-slate-500 text-xs leading-relaxed">
              {BUBBLE_MESSAGES[msgIndex].texto}
            </p>
            <span className="absolute -top-2 right-6 w-4 h-4 bg-white border-t border-r border-slate-100 rotate-45 rounded-sm" />
          </button>

          {/* Indicadores de posición */}
          <div className="flex items-center justify-end gap-1.5 mt-3 mr-1">
            {BUBBLE_MESSAGES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === msgIndex ? 'w-5 bg-primary' : 'w-1.5 bg-slate-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulario ── */}
      <div className="w-full md:w-1/2 md:h-full order-2 flex flex-col items-center justify-center py-6 md:py-8 px-4 md:overflow-y-auto">

        {/* Cabecera */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-primary md:hidden">Consultorio Padre Pio</h1>
          <h1 className="hidden md:block text-2xl font-bold text-slate-900">Crea tu cuenta</h1>
          <p className="text-slate-500 text-sm mt-1">Crea tu cuenta de paciente</p>
        </div>

        <div className="w-full max-w-2xl -mt-3 mb-3 md:hidden">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline">
            ← Volver al inicio
          </Link>
        </div>

      <div className="w-full max-w-2xl">

        {/* Error del servidor */}
        {serverError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium flex items-center gap-2">
              <AlertCircle size={16} /> {serverError.msg}
            </p>
            {serverError.codigo === 'DOC_CUENTA_ACTIVA' && (
              <p className="mt-1">
                <Link to="/login" className="underline font-semibold">
                  Ir al inicio de sesión →
                </Link>
              </p>
            )}
            {serverError.codigo === 'DOC_SIN_CUENTA' && (
              <p className="mt-1">
                <button
                  type="button"
                  onClick={() => navigate('/vincular', {
                    state: {
                      tipo_documento:   form.tipo_documento,
                      numero_documento: form.numero_documento.trim(),
                    },
                  })}
                  className="underline font-semibold"
                >
                  Vincular mi cuenta →
                </button>
              </p>
            )}
            {serverError.codigo === 'DOC_FAMILIAR' && (
              <p className="mt-1">
                <button
                  type="button"
                  onClick={() => navigate('/vincular', {
                    state: {
                      tipo_documento:   form.tipo_documento,
                      numero_documento: form.numero_documento.trim(),
                    },
                  })}
                  className="underline font-semibold"
                >
                  Activar mi cuenta propia →
                </button>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Documento + Foto de perfil */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
            <div className="flex-1 grid grid-cols-2 gap-3">
              {/* Tipo de documento */}
              <Field label="Tipo de documento" error={errors.tipo_documento} touched={touched.tipo_documento}>
                <CustomSelect
                  name="tipo_documento"
                  value={form.tipo_documento}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  touched={touched.tipo_documento}
                  error={errors.tipo_documento}
                  options={[
                    { value: 'DNI', label: 'DNI' },
                    { value: 'CE', label: 'Carnet de Extranjería' },
                    { value: 'PASAPORTE', label: 'Pasaporte' },
                  ]}
                />
              </Field>

              {/* Número de documento */}
              <Field label="Número de documento" error={errors.numero_documento} touched={touched.numero_documento}>
                <div className="relative w-full">
                  <input
                    type="text"
                    name="numero_documento"
                    value={form.numero_documento}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={
                      form.tipo_documento === 'DNI' ? '12345678'
                      : form.tipo_documento === 'CE' ? 'A12345678'
                      : 'AB1234'
                    }
                    className={inputCls(touched.numero_documento, errors.numero_documento) + (reniecLoading ? ' bg-slate-100 pr-10' : '')}
                    maxLength={form.tipo_documento === 'DNI' ? 8 : 12}
                    disabled={reniecLoading}
                  />
                  {reniecLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                </div>
              </Field>
            </div>

            {/* Foto de perfil */}
            <div className="flex sm:flex-col items-center gap-2 self-center sm:self-auto shrink-0">
              <label htmlFor="fotoUpload" className="cursor-pointer group">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center
                                shadow-lg shadow-primary/40 overflow-hidden
                                group-hover:bg-blue-700 transition-colors">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={22} className="text-white" />
                  )}
                </div>
              </label>
              <span className="text-xs font-semibold text-slate-500">Agregar foto</span>
              <input
                type="file"
                id="fotoUpload"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Nombres */}
            <Field label="Nombres" error={errors.nombre} touched={touched.nombre}>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="JUAN CARLOS"
                maxLength={30}
                className={inputCls(touched.nombre, errors.nombre) + (form.tipo_documento === 'DNI' ? ' bg-slate-100 cursor-not-allowed text-slate-500' : '')}
                readOnly={form.tipo_documento === 'DNI'}
              />
            </Field>

            {/* Apellidos */}
            <Field label="Apellidos" error={errors.apellido} touched={touched.apellido}>
              <input
                type="text"
                name="apellido"
                value={form.apellido}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="GARCÍA LÓPEZ"
                maxLength={30}
                className={inputCls(touched.apellido, errors.apellido) + (form.tipo_documento === 'DNI' ? ' bg-slate-100 cursor-not-allowed text-slate-500' : '')}
                readOnly={form.tipo_documento === 'DNI'}
              />
            </Field>

            {/* Fecha de nacimiento */}
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
            </Field>

            {/* Género */}
            <Field label="Género" error={errors.sexo} touched={touched.sexo}>
              <div className="flex items-center gap-5 h-full pl-1">
                {[
                  { value: 'MASCULINO', label: 'Masculino' },
                  { value: 'FEMENINO',  label: 'Femenino' },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="radio"
                      name="sexo"
                      value={value}
                      checked={form.sexo === value}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>

            {/* Celular */}
            <Field label="Número de celular" error={errors.telefono} touched={touched.telefono}>
              <input
                type="tel"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="987654321"
                maxLength={9}
                className={inputCls(touched.telefono, errors.telefono)}
              />
            </Field>

            {/* Correo electrónico */}
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

            {/* Contraseña */}
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
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {/* Confirmar contraseña */}
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
                <button
                  type="button"
                  onClick={() => setShowPass2((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPass2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

          </div>

          {/* Indicador de requisitos de contraseña */}
          {form.password && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                { ok: form.password.length >= 8,             label: 'Mínimo 8 caracteres' },
                { ok: /[A-Z]/.test(form.password),           label: 'Una mayúscula' },
                { ok: /\d/.test(form.password),              label: 'Un número' },
                { ok: /[^A-Za-z0-9]/.test(form.password),   label: 'Un carácter especial' },
              ].map(({ ok, label }) => (
                <p key={label} className={`text-xs flex items-center gap-1 ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                  <CheckCircle2 size={12} /> {label}
                </p>
              ))}
            </div>
          )}

          {/* Política de privacidad */}
          <div className="mt-4 flex items-start gap-3">
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
              <button
                type="button"
                onClick={() => setShowPolicy(true)}
                className="text-primary underline hover:text-blue-700 font-medium"
              >
                Política de Privacidad
              </button>{' '}
              del Consultorio Padre Pio
            </label>
          </div>

          {/* Botón de envío */}
          <div className="mt-5 flex justify-center">
            <button
              type="submit"
              disabled={loading || !form.acepta_politica}
              className="bg-primary text-white font-semibold text-sm px-10 py-3 rounded-full
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors shadow-lg shadow-primary/40 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </button>
          </div>

          {/* Links de navegación */}
          <p className="mt-3 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
          <p className="mt-1.5 text-center text-sm text-slate-500">
            ¿Ya eres paciente del consultorio?{' '}
            <Link to="/vincular" className="text-primary font-medium hover:underline">
              Vincula tu cuenta
            </Link>
          </p>

        </form>
      </div>
      </div>
    </div>
    </>
  );
}