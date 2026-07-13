import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDotCursor } from '../../hooks/useDotCursor';
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
  const dots           = useDotCursor();

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
    <div className="min-h-screen lg:h-screen flex">

      {/* ── Panel izquierdo: branding ── */}
      <div
        ref={dots.ref}
        {...dots.handlers}
        className="dot-host hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center
                   px-12 text-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0059B3 0%, #004a99 55%, #1B3A6B 100%)' }}
      >
        {/* Puntos: base estática + nube que va surcando al pasar el cursor */}
        <div className="absolute inset-0 dot-pattern" />
        <div className="absolute inset-0 dot-cloud" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-white rounded-3xl p-5 shadow-2xl mb-8">
            <img
              src={logo}
              alt="Consultorio Padre Pío"
              className="h-32 w-32 object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Consultorio<br />Padre Pío
          </h1>
          <p className="text-blue-100/90 text-base mt-5 max-w-sm leading-relaxed">
            Sistema de gestión interna. Administre citas, pagos y
            comprobantes en un solo lugar.
          </p>
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-md">

          {/* Logo pequeño (solo móvil, donde el panel izquierdo está oculto) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="bg-white rounded-2xl p-3 shadow-md mb-3">
              <img
                src={logo}
                alt="Consultorio Padre Pío"
                className="h-16 w-16 object-contain"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
            <h1 className="text-xl font-bold text-[#1B3A6B]">Consultorio Padre Pío</h1>
          </div>

          {/* Encabezado */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-[#1B3A6B] tracking-tight">
              Bienvenido de nuevo
            </h2>
            <p className="text-slate-500 mt-2">
              Ingrese sus credenciales para acceder a su portal
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Correo */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                autoComplete="email"
                placeholder="correo@clinica.com"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 focus:border-[#0059B3]
                           transition-shadow"
              />
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-[#0059B3] hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-11 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 focus:border-[#0059B3]
                             transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2
                             text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Mensaje de error — solo visible cuando hay error */}
            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200
                              text-red-700 text-sm rounded-xl px-3 py-2.5">
                <span className="shrink-0 mt-0.5">✕</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2
                         bg-[#8BC63F] hover:bg-[#79b030] active:bg-[#6aaa38]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-semibold py-3 rounded-xl text-sm
                         transition-colors duration-200 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Ingresando...
                </>
              ) : 'Ingresar de forma segura'}
            </button>

          </form>

          <p className="text-center text-[11px] text-slate-400 mt-8">
            © {new Date().getFullYear()} Consultorio Padre Pío · Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
