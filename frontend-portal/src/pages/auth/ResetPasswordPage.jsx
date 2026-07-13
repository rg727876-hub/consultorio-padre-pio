import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../../api/axios';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate  = useNavigate();

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass,        setShowPass]        = useState(false);
  
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        await api.get(`/auth/patient/reset-password/${token}`);
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
      await api.post('/auth/patient/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Ocurrió un error. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary">Consultorio Padre Pio</h1>
        <p className="text-slate-500 text-sm mt-1">Nueva contraseña</p>
      </div>

      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6 sm:p-8">
        {validating ? (
          <div className="flex flex-col items-center py-10">
            <Loader2 className="animate-spin text-primary mb-4" size={32} />
            <p className="text-slate-500 text-sm">Validando enlace de seguridad...</p>
          </div>
        ) : !tokenValid ? (
          <div className="text-center py-4">
            <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              ✕
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Enlace inválido</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              {errorMsg || 'El enlace que utilizaste no es válido o ya ha expirado.'}
            </p>
            <Link
              to="/forgot-password"
              className="w-full inline-flex justify-center bg-slate-100 text-slate-700 font-semibold text-sm py-3 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Solicitar un nuevo enlace
            </Link>
          </div>
        ) : success ? (
          <div className="text-center py-4">
            <div className="mx-auto w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">¡Contraseña restablecida!</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Tu contraseña ha sido actualizada correctamente. Ya puedes acceder al sistema con tus nuevas credenciales.
            </p>
            <Link
              to="/login"
              className="w-full inline-flex justify-center bg-primary text-white font-semibold text-sm py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ir a Iniciar Sesión
            </Link>
          </div>
        ) : (
          <>
            <p className="text-slate-500 text-sm text-center mb-6">
              Asigna una nueva contraseña segura para tu cuenta.
            </p>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Nueva contraseña<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                    placeholder="Tu nueva contraseña"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
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
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Confirmar contraseña<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); if (errorMsg) setErrorMsg(''); }}
                    placeholder="Repite la nueva contraseña"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-primary text-white font-semibold text-sm py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
