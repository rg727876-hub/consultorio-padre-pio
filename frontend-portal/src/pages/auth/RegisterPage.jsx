import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { registerPatient } from '../../services/authPatient.service';
import PrivacyPolicyModal from '../../components/PrivacyPolicyModal';

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
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
   focus:ring-2 focus:ring-primary/30
   ${touched && error
     ? 'border-red-400 bg-red-50 focus:border-red-400'
     : 'border-slate-300 bg-white focus:border-primary'}`;

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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newVal = type === 'checkbox' ? checked : value;
    if (name === 'nombre' || name === 'apellido') newVal = value.toUpperCase();
    const newForm = { ...form, [name]: newVal };
    setForm(newForm);

    // Si el tipo de documento cambia, re-validar el número
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
      await registerPatient({
        tipo_documento:    form.tipo_documento,
        numero_documento:  form.numero_documento.trim(),
        nombre:            form.nombre.trim(),
        apellido:          form.apellido.trim(),
        fecha_nacimiento:  form.fecha_nacimiento,
        sexo:              form.sexo,
        telefono:          form.telefono.replace(/\D/g, ''),
        email:             form.email.trim().toLowerCase(),
        password:          form.password,
        confirmar_password: form.confirmar_password,
        acepta_politica:   form.acepta_politica,
      });
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

  // ── Render éxito ─────────────────────────────────────────────────────────────
  if (success) return <SuccessScreen email={form.email.trim().toLowerCase()} />;

  // ── Render formulario ────────────────────────────────────────────────────────
  return (
    <>
    {showPolicy && (
      <PrivacyPolicyModal
        onClose={() => setShowPolicy(false)}
        onAccept={handlePolicyAccept}
      />
    )}
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-10 px-4">

      {/* Cabecera */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary">Consultorio Padre Pio</h1>
        <p className="text-slate-500 text-sm mt-1">Crea tu cuenta de paciente</p>
      </div>

      {/* Tarjeta */}
      <div className="bg-white rounded-2xl shadow-md w-full max-w-2xl p-6 sm:p-8">

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
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Tipo de documento */}
            <Field label="Tipo de documento" error={errors.tipo_documento} touched={touched.tipo_documento}>
              <select
                name="tipo_documento"
                value={form.tipo_documento}
                onChange={handleChange}
                onBlur={handleBlur}
                className={inputCls(touched.tipo_documento, errors.tipo_documento)}
              >
                <option value="DNI">DNI</option>
                <option value="CE">Carnet de Extranjería</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>
            </Field>

            {/* Número de documento */}
            <Field label="Número de documento" error={errors.numero_documento} touched={touched.numero_documento}>
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
                className={inputCls(touched.numero_documento, errors.numero_documento)}
                maxLength={form.tipo_documento === 'DNI' ? 8 : 12}
              />
            </Field>

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
                className={inputCls(touched.nombre, errors.nombre)}
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
                className={inputCls(touched.apellido, errors.apellido)}
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
              <select
                name="sexo"
                value={form.sexo}
                onChange={handleChange}
                onBlur={handleBlur}
                className={inputCls(touched.sexo, errors.sexo)}
              >
                <option value="">Seleccionar...</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
              </select>
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
          <div className="mt-5 flex items-start gap-3">
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
          <button
            type="submit"
            disabled={loading || !form.acepta_politica}
            className="mt-6 w-full bg-primary text-white font-semibold text-sm py-3 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
          </button>

          {/* Links de navegación */}
          <p className="mt-4 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            ¿Ya eres paciente del consultorio?{' '}
            <Link to="/vincular" className="text-primary font-medium hover:underline">
              Vincula tu cuenta
            </Link>
          </p>

        </form>
      </div>
    </div>
    </>
  );
}
