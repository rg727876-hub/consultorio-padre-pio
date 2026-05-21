import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// ── Contador regresivo ────────────────────────────────────────────
function Countdown({ bloqueadoHasta, onExpire }) {
  const calc = () => Math.max(0, Math.floor((new Date(bloqueadoHasta) - Date.now()) / 1000));
  const [secs, setSecs] = useState(calc);

  useEffect(() => {
    if (secs <= 0) { onExpire(); return; }
    const id = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { onExpire(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return <span className="font-mono text-2xl font-bold text-red-500">{m}:{s}</span>;
}

export default function ActivateAccountPage() {
  const { token } = useParams();
  const navigate  = useNavigate();

  // Estado del token
  const [tokenInfo, setTokenInfo]     = useState(null);
  const [tokenError, setTokenError]   = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);

  // Bloqueo temporal
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null);

  // Pasos: 1 = DNI | 2 = contraseña
  const [step, setStep] = useState(1);

  // Campos
  const [DNI, setDNI]               = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [intentosRest, setIntentosRest] = useState(5);

  // ── Verificar token ─────────────────────────────────────────────
  const fetchToken = useCallback(() => {
    setTokenLoading(true);
    setTokenError('');
    setBloqueadoHasta(null);
    api.get(`/auth/activate/${token}`)
      .then(({ data }) => {
        setTokenInfo(data);
        setIntentosRest(data.intentosRestantes ?? 5);
      })
      .catch((err) => {
        const data   = err.response?.data;
        const status = err.response?.status;
        if (status === 429 && data?.bloqueado_hasta) {
          setBloqueadoHasta(data.bloqueado_hasta);
        } else {
          setTokenError(data?.error || 'El enlace no es válido');
        }
      })
      .finally(() => setTokenLoading(false));
  }, [token]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  // ── Paso 1: verificar DNI ───────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (step === 1) {
      if (!/^\d{8}$/.test(DNI)) {
        setErrorMsg('El DNI debe tener exactamente 8 dígitos');
        return;
      }
      setLoading(true);
      try {
        await api.post('/auth/activate/verify-dni', { token, DNI });
        setStep(2);
      } catch (err) {
        const data   = err.response?.data;
        const status = err.response?.status;
        if (status === 429 && data?.bloqueado_hasta) {
          setBloqueadoHasta(data.bloqueado_hasta);
          setDNI('');
        } else if (status === 401) {
          setIntentosRest(data?.intentosRestantes ?? 0);
          setDNI('');
          setErrorMsg(data?.error || 'El DNI ingresado no coincide');
        } else {
          setErrorMsg(data?.error || 'Error al verificar el DNI');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── Paso 2: activar cuenta ──────────────────────────────────
    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener mínimo 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/activate', { token, DNI, password });
      toast.success('¡Cuenta activada! Ya puedes iniciar sesión.');
      navigate('/login');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Error al activar la cuenta');
    } finally {
      setLoading(false);
    }
  };

  // ── Cargando ────────────────────────────────────────────────────
  if (tokenLoading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 py-4 text-slate-500">
          <Loader2 size={32} className="animate-spin text-[#0059B3]" />
          <p className="text-sm">Verificando enlace...</p>
        </div>
      </PageShell>
    );
  }

  // ── Bloqueado temporalmente ─────────────────────────────────────
  if (bloqueadoHasta) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 text-center py-2">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Clock size={28} className="text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-base mb-1">
              Acceso bloqueado temporalmente
            </p>
            <p className="text-sm text-slate-500">
              Demasiados intentos fallidos. Podrás intentar de nuevo en:
            </p>
          </div>
          <Countdown
            bloqueadoHasta={bloqueadoHasta}
            onExpire={() => {
              setStep(1);
              setDNI('');
              setErrorMsg('');
              fetchToken();
            }}
          />
          <p className="text-xs text-slate-400">
            El contador se actualizará automáticamente cuando expire el bloqueo.
          </p>
        </div>
      </PageShell>
    );
  }

  // ── Token inválido / expirado ───────────────────────────────────
  if (tokenError) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 text-center py-2">
          <ShieldAlert size={40} className="text-red-400" />
          <p className="font-semibold text-slate-700">Enlace no válido</p>
          <p className="text-sm text-slate-500">{tokenError}</p>
        </div>
      </PageShell>
    );
  }

  // ── Formulario ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-md px-8 pt-10 pb-8">

          <div className="flex flex-col items-center mb-7">
            <ShieldCheck size={40} className="text-[#0059B3] mb-3" />
            <h1 className="text-lg font-bold text-[#0059B3] text-center">Activar cuenta</h1>
            <p className="text-sm text-slate-500 text-center mt-1">
              Hola, <strong>{tokenInfo.nombre} {tokenInfo.apellido}</strong>
            </p>
          </div>

          {/* Indicador de pasos */}
          <div className="flex items-center mb-7">
            <StepDot active={step >= 1} done={step > 1} label="Verificar DNI" />
            <div className={`flex-1 h-0.5 mx-2 transition-colors ${step > 1 ? 'bg-[#8BC63F]' : 'bg-slate-200'}`} />
            <StepDot active={step >= 2} done={false} label="Contraseña" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Paso 1: DNI */}
            {step === 1 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Número de DNI
                </label>
                <input
                  type="text"
                  value={DNI}
                  onChange={(e) => { setDNI(e.target.value.replace(/\D/g, '')); setErrorMsg(''); }}
                  maxLength={8}
                  placeholder="12345678"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Ingresa el DNI con el que te registraron
                  {intentosRest < 5 && (
                    <span className="text-orange-500 font-medium">
                      {' '}· {intentosRest} intento{intentosRest !== 1 ? 's' : ''} restante{intentosRest !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Paso 2: Contraseña */}
            {step === 2 && (
              <>
                <PasswordField
                  label="Nueva contraseña"
                  value={password}
                  onChange={(v) => { setPassword(v); setErrorMsg(''); }}
                  show={showPwd}
                  onToggle={() => setShowPwd((x) => !x)}
                  placeholder="Mínimo 8 caracteres"
                />
                <PasswordField
                  label="Confirmar contraseña"
                  value={confirm}
                  onChange={(v) => { setConfirm(v); setErrorMsg(''); }}
                  show={showConfirm}
                  onToggle={() => setShowConfirm((x) => !x)}
                  placeholder="Repite la contraseña"
                />
              </>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200
                              text-red-700 text-sm rounded-lg px-3 py-2.5">
                <span className="shrink-0">✕</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => { setStep(1); setErrorMsg(''); }}
                  className="flex-1 border border-slate-300 text-slate-600 text-sm
                             font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Atrás
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2
                           bg-[#8BC63F] hover:bg-[#78ae35]
                           disabled:opacity-60 disabled:cursor-not-allowed
                           text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Verificando...</>
                  : step === 1 ? 'Siguiente' : 'Activar cuenta'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          © {new Date().getFullYear()} Consultorio Padre Pio
        </p>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────
function PageShell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white rounded-2xl shadow-md px-8 py-10 w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}

function StepDot({ active, done, label }) {
  const bg = done ? 'bg-[#8BC63F]' : active ? 'bg-[#0059B3]' : 'bg-slate-200';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-6 h-6 rounded-full ${bg} transition-colors`} />
      <span className={`text-[10px] whitespace-nowrap ${active ? 'text-[#0059B3] font-medium' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
        />
        <button type="button" onClick={onToggle} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
