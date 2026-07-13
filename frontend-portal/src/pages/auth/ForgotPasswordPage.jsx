import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck, AlertCircle } from 'lucide-react';
import api from '../../api/axios';

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 relative">
      <Link 
        to="/login" 
        className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} /> Volver al login
      </Link>

      <div className="text-center mb-6">
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

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-primary text-white font-semibold text-sm py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
