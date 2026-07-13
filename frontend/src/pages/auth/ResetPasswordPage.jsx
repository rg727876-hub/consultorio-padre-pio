import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useDotCursor } from '../../hooks/useDotCursor';
import logo from '../../assets/images/Logo-Consultorio-Padre-Pio.png';
import api from '../../api/axios';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const dots      = useDotCursor();

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        await api.get(`/auth/staff/reset-password/${token}`);
        setTokenValid(true);
      } catch (err) {
        setErrorMsg(err.response?.data?.error || 'Enlace no válido o expirado.');
      } finally {
        setValidating(false);
      }
    };
    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await api.post('/auth/staff/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Ocurrió un error. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen flex">
      <div
        ref={dots.ref}
        {...dots.handlers}
        className="dot-host hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center
                   px-12 text-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0059B3 0%, #004a99 55%, #1B3A6B 100%)' }}
      >
        <div className="absolute inset-0 dot-pattern" />
        <div className="absolute inset-0 dot-cloud" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-white rounded-3xl p-5 shadow-2xl mb-8">
            <img src={logo} alt="Consultorio Padre Pío" className="h-32 w-32 object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
            Consultorio<br />Padre Pío
          </h1>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="bg-white rounded-2xl p-3 shadow-md mb-3">
              <img src={logo} alt="Consultorio Padre Pío" className="h-16 w-16 object-contain" />
            </div>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-[#1B3A6B] tracking-tight">
              Nueva contraseña
            </h2>
            {!success && !validating && tokenValid && (
              <p className="text-slate-500 mt-2">
                Asigna una nueva contraseña segura para tu cuenta.
              </p>
            )}
          </div>

          {validating ? (
            <div className="flex flex-col items-center py-10">
              <Loader2 className="animate-spin text-[#0059B3] mb-4" size={32} />
              <p className="text-slate-500">Validando enlace de seguridad...</p>
            </div>
          ) : !tokenValid ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                ✕
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Enlace inválido</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                {errorMsg || 'El enlace que utilizaste no es válido o ya ha expirado.'}
              </p>
              <Link
                to="/forgot-password"
                className="w-full inline-flex justify-center py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Solicitar un nuevo enlace
              </Link>
            </div>
          ) : success ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">¡Contraseña restablecida!</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Tu contraseña ha sido actualizada correctamente. Ya puedes acceder al sistema con tus nuevas credenciales.
              </p>
              <Link
                to="/login"
                className="w-full inline-flex justify-center py-2.5 bg-[#8BC63F] hover:bg-[#79b030] text-white font-semibold rounded-xl transition-colors"
              >
                Ir a Iniciar Sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                    placeholder="••••••••"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-11 text-sm bg-white
                               focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 focus:border-[#0059B3]
                               transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 focus:border-[#0059B3]
                             transition-shadow"
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                text-red-700 text-sm rounded-xl px-3 py-2.5">
                  <span className="shrink-0 mt-0.5">✕</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2
                           bg-[#8BC63F] hover:bg-[#79b030] active:bg-[#6aaa38]
                           disabled:opacity-60 disabled:cursor-not-allowed
                           text-white font-semibold py-3 rounded-xl text-sm
                           transition-colors duration-200 shadow-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
