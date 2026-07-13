import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { useDotCursor } from '../../hooks/useDotCursor';
import logo from '../../assets/images/Logo-Consultorio-Padre-Pio.png';
import api from '../../api/axios';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const dots     = useDotCursor();

  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success,  setSuccess]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setErrorMsg('Por favor ingresa tu correo');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Ingresa un correo electrónico válido');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      await api.post('/auth/staff/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Ocurrió un error. Inténtalo de nuevo.');
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

      {/* ── Panel derecho: formulario ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-10 relative">
        <Link 
          to="/login" 
          className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} /> Volver al login
        </Link>

        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="bg-white rounded-2xl p-3 shadow-md mb-3">
              <img src={logo} alt="Consultorio Padre Pío" className="h-16 w-16 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-[#1B3A6B]">Consultorio Padre Pío</h1>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-[#1B3A6B] tracking-tight">
              Recuperar acceso
            </h2>
            <p className="text-slate-500 mt-2">
              Ingresa el correo con el que fuiste registrado en el sistema.
            </p>
          </div>

          {success ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-blue-50 text-[#0059B3] rounded-full flex items-center justify-center mb-4">
                <MailCheck size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Revisa tu bandeja</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Si <strong>{email}</strong> está registrado en nuestro sistema, hemos enviado un enlace para que restablezcas tu contraseña.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  autoComplete="email"
                  placeholder="correo@clinica.com"
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
                           bg-[#0059B3] hover:bg-[#004a99] active:bg-[#003b7a]
                           disabled:opacity-60 disabled:cursor-not-allowed
                           text-white font-semibold py-3 rounded-xl text-sm
                           transition-colors duration-200 shadow-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar enlace de recuperación'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
