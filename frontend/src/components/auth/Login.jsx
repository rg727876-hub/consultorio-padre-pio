import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import logo from '../../assets/images/Logo-Consultorio-Padre-Pio.png';

const ROLE_PATHS = {
  ADMINISTRADOR: '/dashboard',
  DOCTOR:        '/dashboard',
  RECEPCIONISTA: '/dashboard',
  CAJERO:        '/dashboard',
};

export default function Login() {
  const { loginStaff } = useAuth();
  const navigate       = useNavigate();

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');

  // Borra el mensaje de error cada vez que el usuario escribe
  const clearError = () => {
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación local
    if (!email || !password) {
      setErrorMsg('Por favor ingresa tu correo y contraseña');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Ingresa un correo electrónico válido');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const data = await loginStaff(email, password);
      navigate(ROLE_PATHS[data.user?.rol] ?? '/dashboard');
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.error ?? '';
      if (status === 403 && msg) {
        setErrorMsg(msg);
      } else {
        setErrorMsg('Correo o contraseña incorrectos');
      }
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

            {/* Correo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                autoComplete="email"
                placeholder="correo@clinica.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] transition-shadow"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] transition-shadow"
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
            </div>

            {/* Mensaje de error — solo visible cuando hay error */}
            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200
                              text-red-700 text-sm rounded-lg px-3 py-2.5">
                <span className="shrink-0 mt-0.5">✕</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2
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
