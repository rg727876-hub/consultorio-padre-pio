import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck, AlertCircle, KeyRound } from 'lucide-react';
import api from '../../api/axios';

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
      <div className="absolute -top-48 -right-48 w-[560px] h-[560px] sm:w-[720px] sm:h-[720px] rounded-full bg-primary/[0.06]" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-accent/10" />
    </div>
  );
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

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
      await api.post('/auth/patient/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Ocurrió un error. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-0 min-h-screen overflow-hidden bg-slate-50 flex flex-col items-center justify-center px-4">
      <DottedBackground />

      <Link
        to="/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} /> Volver al login
      </Link>

      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 mb-4">
          <KeyRound size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-primary">Consultorio Padre Pio</h1>
        <p className="text-slate-500 text-sm mt-1">Recuperar acceso</p>
      </div>

      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-6 sm:p-8">
        {success ? (
          <div className="text-center py-4">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-4">
              <MailCheck size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Revisa tu bandeja</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Si <strong>{email}</strong> está registrado en nuestro sistema, hemos enviado un enlace para que restablezcas tu contraseña.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full mt-2 bg-slate-100 text-slate-700 font-semibold text-sm py-3 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            <p className="text-slate-500 text-sm text-center mb-6">
              Ingresa el correo con el que fuiste registrado en el sistema.
            </p>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Correo electrónico<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(''); }}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}

              <div className="flex justify-center pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-white font-semibold text-sm px-8 py-3 rounded-full
                             hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors shadow-lg shadow-primary/40 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
