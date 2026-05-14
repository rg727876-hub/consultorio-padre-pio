import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import logo from '../../assets/images/Logo-Consultorio-Padre-Pio.png';

const ROLE_PATHS = {
  ADMINISTRADOR: '/dashboard',
  DOCTOR:        '/dashboard',
  RECEPCIONISTA: '/dashboard',
  CAJERO:        '/dashboard',
};

function validate({ email, password }) {
  const errors = {};
  if (!email)
    errors.email = 'El correo es requerido';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = 'Ingresa un correo electrónico válido';
  if (!password)
    errors.password = 'La contraseña es requerida';
  return errors;
}

function parseServerError(err) {
  const status = err.response?.status;
  const msg    = err.response?.data?.error ?? '';
  if (status === 403) return msg;
  return 'Correo o contraseña incorrectos';
}

export default function Login() {
  const { loginStaff } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]             = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [errors, setErrors]         = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      const data = await loginStaff(form.email, form.password);
      navigate(ROLE_PATHS[data.user?.rol] ?? '/dashboard');
    } catch (err) {
      toast.error(parseServerError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">

        <div className="bg-white rounded-2xl shadow-md px-8 pt-10 pb-8">

          {/* Logo + título */}
          <div className="flex flex-col items-center mb-8">
            <img
              src={logo}
              alt="Consultorio Padre Pio"
              className="h-20 w-auto object-contain mb-4"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h1 className="text-[1.35rem] font-bold text-[#1B3A6B] leading-snug text-center tracking-tight">
              Consultorio Padre Pio
            </h1>
            <p className="text-xs text-gray-400 mt-1 tracking-wide uppercase">
              Sistema de gestión interna
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            <Field label="Correo electrónico" error={errors.email}>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                placeholder="correo@clinica.com"
                className={inputCls(errors.email)}
              />
            </Field>

            <Field label="Contraseña" error={errors.password}>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputCls(errors.password, 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 flex items-center justify-center gap-2
                         bg-[#7DC242] hover:bg-[#6aaa38] active:bg-[#5c9430]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-semibold py-2.5 rounded-lg text-sm
                         transition-colors duration-200 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Ingresando...
                </>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-5">
          © {new Date().getFullYear()} Consultorio Padre Pio · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}

function inputCls(hasError, extra = '') {
  const border = hasError
    ? 'border-red-400 focus:ring-red-400'
    : 'border-gray-300 focus:ring-[#1B3A6B]';
  return `w-full border ${border} rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:ring-2 transition-shadow ${extra}`;
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1">⚠ {error}</p>
      )}
    </div>
  );
}
