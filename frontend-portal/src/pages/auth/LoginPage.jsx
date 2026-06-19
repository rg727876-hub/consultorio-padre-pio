import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, LockKeyhole } from 'lucide-react';
import { loginPatient } from '../../services/authPatient.service';
import { usePatientAuth } from '../../context/PatientAuthContext';

// ── Reglas de validación (espejo del backend) ────────────────────────────────
const RE_DNI       = /^\d{8}$/;
const RE_CE        = /^[A-Za-z0-9]{9,12}$/;
const RE_PASAPORTE = /^[A-Za-z0-9]{6,12}$/;

const DOC_RULES = {
  DNI:       { regex: RE_DNI,       msg: 'Debe tener 8 dígitos numéricos' },
  CE:        { regex: RE_CE,        msg: 'Debe tener entre 9 y 12 caracteres alfanuméricos' },
  PASAPORTE: { regex: RE_PASAPORTE, msg: 'Debe tener entre 6 y 12 caracteres alfanuméricos' },
};

function validarCampo(nombre, valor, form) {
  switch (nombre) {
    case 'numero_documento': {
      const rule = DOC_RULES[form.tipo_documento];
      if (!valor.trim()) return 'Campo requerido';
      if (!rule.regex.test(valor.trim())) return rule.msg;
      return '';
    }
    case 'password':
      return valor ? '' : 'Campo requerido';
    default:
      return '';
  }
}

const inputCls = (touched, error) =>
  `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
   focus:ring-2 focus:ring-primary/30
   ${touched && error
     ? 'border-red-400 bg-red-50 focus:border-red-400'
     : 'border-slate-300 bg-white focus:border-primary'}`;

function Field({ label, error, touched, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">
        {label}<span className="text-red-500 ml-0.5">*</span>
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

// ── Cuenta bloqueada: muestra tiempo restante + opción de limpiar ────────────
function BloqueadoAlert({ bloqueadoHasta, onReset }) {
  const [minutos, setMinutos] = useState(() =>
    Math.max(1, Math.ceil((new Date(bloqueadoHasta) - Date.now()) / 60000))
  );

  useState(() => {
    const id = setInterval(() => {
      const rest = Math.ceil((new Date(bloqueadoHasta) - Date.now()) / 60000);
      if (rest <= 0) { clearInterval(id); setMinutos(0); } else setMinutos(rest);
    }, 60000);
    return () => clearInterval(id);
  });

  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p className="font-medium flex items-center gap-2">
        <LockKeyhole size={16} />
        Cuenta bloqueada temporalmente
      </p>
      <p className="mt-1 text-amber-700">
        Demasiados intentos fallidos. Intenta nuevamente en{' '}
        <span className="font-semibold">{minutos} minuto{minutos === 1 ? '' : 's'}</span>.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 text-amber-800 underline font-medium hover:text-amber-900 transition-colors"
      >
        Probar con otro documento
      </button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate   = useNavigate();
  const { login }  = usePatientAuth();

  const [form, setForm]     = useState({ tipo_documento: 'DNI', numero_documento: '', password: '' });
  const [touched, setTouched]   = useState({});
  const [errors, setErrors]     = useState({});
  const [serverError, setServerError] = useState(null);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newForm = { ...form, [name]: value };
    setForm(newForm);

    if (name === 'tipo_documento' && touched.numero_documento) {
      setErrors((prev) => ({
        ...prev,
        numero_documento: validarCampo('numero_documento', form.numero_documento, newForm),
      }));
    }
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validarCampo(name, value, newForm) }));
    }
    if (serverError) { setServerError(null); setBloqueadoHasta(null); }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validarCampo(name, value, form) }));
  };

  const validateAll = () => {
    const campos = ['numero_documento', 'password'];
    const newErrors  = {};
    const newTouched = {};
    campos.forEach((c) => { newTouched[c] = true; newErrors[c] = validarCampo(c, form[c], form); });
    setTouched(newTouched);
    setErrors(newErrors);
    return Object.values(newErrors).every((e) => !e);
  };

  const handleReset = () => {
    setForm({ tipo_documento: 'DNI', numero_documento: '', password: '' });
    setTouched({});
    setErrors({});
    setServerError(null);
    setBloqueadoHasta(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    setLoading(true);
    setServerError(null);
    setBloqueadoHasta(null);

    try {
      const { data } = await loginPatient({
        tipo_documento:   form.tipo_documento,
        numero_documento: form.numero_documento.trim(),
        password:         form.password,
      });

      login(data.token, data.user);
      navigate('/mis-citas', { replace: true });

    } catch (err) {
      const data   = err.response?.data;
      const codigo = data?.codigo;

      if (codigo === 'CUENTA_BLOQUEADA' && data?.bloqueado_hasta) {
        setBloqueadoHasta(data.bloqueado_hasta);
      } else {
        setServerError(data?.error ?? 'Ocurrió un error. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">

      {/* Cabecera */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary">Consultorio Padre Pio</h1>
        <p className="text-slate-500 text-sm mt-1">Accede a tus citas e historial</p>
      </div>

      {/* Tarjeta */}
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6 sm:p-8">

        {/* Cuenta bloqueada */}
        {bloqueadoHasta && <BloqueadoAlert bloqueadoHasta={bloqueadoHasta} onReset={handleReset} />}

        {/* Error genérico del servidor */}
        {serverError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="flex items-center gap-2">
              <AlertCircle size={16} /> {serverError}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

          {/* Tipo de documento */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Tipo de documento<span className="text-red-500 ml-0.5">*</span>
            </label>
            <select
              name="tipo_documento"
              value={form.tipo_documento}
              onChange={handleChange}
              className={inputCls(false, false)}
            >
              <option value="DNI">DNI</option>
              <option value="CE">Carnet de Extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </div>

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
              maxLength={form.tipo_documento === 'DNI' ? 8 : 12}
              className={inputCls(touched.numero_documento, errors.numero_documento)}
              autoComplete="username"
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
                placeholder="Tu contraseña"
                className={`${inputCls(touched.password, errors.password)} pr-10`}
                autoComplete="current-password"
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

          {/* ¿Olvidaste tu contraseña? */}
          <div className="text-right -mt-1">
            <Link
              to="/recuperar-password"
              className="text-xs text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={loading || !!bloqueadoHasta}
            className="mt-1 w-full bg-primary text-white font-semibold text-sm py-3 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

        </form>

        {/* Link al registro */}
        <p className="mt-5 text-center text-sm text-slate-500">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
