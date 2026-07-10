import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock, ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../../../api/axios';
import AppLayout from '../../../components/AppLayout';

// ─────────────────────────────────────────────────────────────────
// Guard de doble autenticación para el Dashboard de Reportes.
// Comportamiento estricto: solicita la contraseña en CADA entrada al
// módulo (no se persiste autorización en sessionStorage).
// Lockout local: tras 3 intentos fallidos consecutivos se bloquea el
// acceso al módulo durante 15 minutos. El bloqueo se guarda en
// localStorage y sobrevive recargas hasta que expira.
// ─────────────────────────────────────────────────────────────────

const MAX_INTENTOS    = 3;
const LOCK_MIN        = 15;
const LS_FAIL_COUNT   = 'reportes_fail_count';
const LS_LOCK_UNTIL   = 'reportes_lock_until';

function getLockRemainingMs() {
  const until = Number(localStorage.getItem(LS_LOCK_UNTIL) || 0);
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

export default function ReportesAuthGuard({ children }) {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password,      setPassword]      = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState(null);
  const [intentos,      setIntentos]      = useState(() => Number(localStorage.getItem(LS_FAIL_COUNT) || 0));
  const [lockMsLeft,    setLockMsLeft]    = useState(() => getLockRemainingMs());

  // Tick para refrescar el contador de bloqueo
  useEffect(() => {
    if (lockMsLeft <= 0) return undefined;
    const id = setInterval(() => {
      const remaining = getLockRemainingMs();
      setLockMsLeft(remaining);
      if (remaining === 0) {
        localStorage.removeItem(LS_LOCK_UNTIL);
        localStorage.removeItem(LS_FAIL_COUNT);
        setIntentos(0);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockMsLeft]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || lockMsLeft > 0) return;
    if (!password) {
      setError('Ingresa tu contraseña');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/staff/reauthenticate', { password });
      // Éxito: reseteo contador y libero acceso
      localStorage.removeItem(LS_FAIL_COUNT);
      localStorage.removeItem(LS_LOCK_UNTIL);
      setIntentos(0);
      setAuthenticated(true);
    } catch (err) {
      const nuevos = intentos + 1;
      setIntentos(nuevos);
      localStorage.setItem(LS_FAIL_COUNT, String(nuevos));

      if (nuevos >= MAX_INTENTOS) {
        const until = Date.now() + LOCK_MIN * 60 * 1000;
        localStorage.setItem(LS_LOCK_UNTIL, String(until));
        setLockMsLeft(until - Date.now());
        toast.error(`Demasiados intentos. Bloqueado por ${LOCK_MIN} minutos.`);
        setError(null);
      } else {
        const restantes = MAX_INTENTOS - nuevos;
        setError(`Contraseña incorrecta. Te ${restantes === 1 ? 'queda 1 intento' : `quedan ${restantes} intentos`}.`);
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  if (authenticated) return children;

  // ── Bloqueado ──
  if (lockMsLeft > 0) {
    const totalSec = Math.ceil(lockMsLeft / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return (
      <AppLayout>
        <div className="px-4 py-12 max-w-md mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 text-red-600
                            flex items-center justify-center mb-4">
              <ShieldAlert size={28} />
            </div>
            <h1 className="text-lg font-bold text-slate-800 mb-2">
              Acceso bloqueado temporalmente
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              Se superaron los {MAX_INTENTOS} intentos permitidos. Por seguridad, el acceso
              al módulo de Reportes queda bloqueado durante {LOCK_MIN} minutos.
            </p>
            <p className="text-3xl font-bold text-red-600 tabular-nums mb-6">
              {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-slate-700 px-4 py-2 rounded-lg
                         border border-slate-200 hover:bg-slate-50 transition"
            >
              <ArrowLeft size={14} className="inline mr-1" />
              Volver al inicio
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Pidiendo contraseña ──
  return (
    <AppLayout>
      <div className="px-4 py-12 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-slate-700 transition mb-4"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600
                          flex items-center justify-center mb-4">
            <Lock size={24} />
          </div>

          <h1 className="text-lg font-bold text-slate-800 mb-1">
            Verificación de seguridad
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            El módulo de Reportes contiene información financiera sensible. Ingresa tu contraseña para continuar.
          </p>

          <form onSubmit={handleSubmit}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoFocus
              disabled={submitting}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#0059B3]/20
                         disabled:opacity-60"
              placeholder="Tu contraseña actual"
            />

            {error && (
              <p className="text-xs text-red-600 mt-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full mt-4 bg-[#0059B3] text-white text-sm font-medium
                         py-2.5 rounded-lg hover:bg-[#004a96] transition
                         disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Verificando…' : 'Acceder a Reportes'}
            </button>
          </form>

          {intentos > 0 && (
            <p className="text-[11px] text-slate-400 mt-4 text-center">
              Intentos fallidos: {intentos} / {MAX_INTENTOS}. Al alcanzar {MAX_INTENTOS}, el acceso
              se bloquea {LOCK_MIN} minutos.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
