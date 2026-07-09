import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, X, Timer, AlertCircle, Check, CreditCard, Smartphone, ChevronRight } from 'lucide-react';
import StepPaciente from './StepPaciente';
import StepServicio from './StepServicio';
import StepDoctor   from './StepDoctor';
import StepHorario  from './StepHorario';
import StepResumen  from './StepResumen';
import StepPago     from './StepPago';
import StepExito    from './StepExito';
import PaymentModal from './PaymentModal';
import { liberarHold } from '../../services/portalAppointments.service';

const STEPS = ['PACIENTE', 'SERVICIO', 'DOCTOR', 'HORARIO', 'RESUMEN'];
const STEP_LABELS = {
  PACIENTE: 'Paciente', SERVICIO: 'Servicio', DOCTOR: 'Médico',
  HORARIO: 'Horario', RESUMEN: 'Resumen y pago',
};

const EMPTY = { paciente: null, servicio: null, doctor: null, slot: null, hold: null };

// ── Indicador de pasos: círculos horizontales numerados, verdes ─────────────
function StepIndicator({ stepIndex }) {
  const total = STEPS.length;
  return (
    <div className="flex items-center mb-6">
      {STEPS.map((s, i) => {
        const done    = i < stepIndex;
        const current = i === stepIndex;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold
                border-2 transition-colors
                ${done
                  ? 'bg-accent border-accent text-white'
                  : current
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-white border-slate-200 text-slate-300'}`}
            >
              {done ? <Check size={14} /> : i + 1}
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-0.5 mx-1.5 rounded ${done ? 'bg-accent' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Botones de medio de pago (columna derecha del paso 5) — al elegir uno se
// abre la ventana flotante con el formulario correspondiente.
function MetodoPagoPicker({ onSelect }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Elige cómo pagar</p>

      <button
        onClick={() => onSelect('tarjeta')}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-white
                   hover:border-primary hover:bg-primary/5 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <CreditCard size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Tarjeta</p>
          <p className="text-xs text-slate-400">Débito o crédito</p>
        </div>
        <ChevronRight size={16} className="text-slate-300" />
      </button>

      <button
        onClick={() => onSelect('yape')}
        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-white
                   hover:border-[#6d2eb3] hover:bg-[#6d2eb3]/5 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-[#6d2eb3]/10 flex items-center justify-center shrink-0">
          <Smartphone size={18} className="text-[#6d2eb3]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Yape</p>
          <p className="text-xs text-slate-400">El pago se acredita al instante</p>
        </div>
        <ChevronRight size={16} className="text-slate-300" />
      </button>
    </div>
  );
}

// El paso 5 (Resumen) muestra el resumen y, al confirmar, se divide en dos
// columnas: resumen a la izquierda y medios de pago a la derecha. Elegir un
// medio abre una ventana flotante con el formulario propio de la clínica.
export default function BookingWizard({ titular, onRegistrarFamiliar }) {
  const [step, setStep]         = useState('PACIENTE');
  const [data, setData]         = useState(EMPTY);
  const [mostrarMetodos, setMostrarMetodos] = useState(false);
  const [metodoModal, setMetodoModal] = useState(null); // null | 'tarjeta' | 'yape'
  const [resultado, setResultado] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [expiredMsg, setExpiredMsg] = useState(null);
  const holdRef = useRef(null);

  useEffect(() => { holdRef.current = data.hold; }, [data.hold]);

  // ── Cuenta regresiva del bloqueo (5 min), arrancada desde el paso 4 al
  //    elegir un horario (ver StepHorario.onHoldCreated) ──────────────────
  useEffect(() => {
    if (!data.hold) { setRemaining(null); return; }
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(data.hold.expires_at).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) handleHoldExpired();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.hold]);

  const handleHoldExpired = useCallback(() => {
    setExpiredMsg('El tiempo de reserva expiró. Selecciona un nuevo horario.');
    setData((d) => ({ ...d, slot: null, hold: null }));
    setMostrarMetodos(false);
    setMetodoModal(null);
    setStep('HORARIO');
  }, []);

  const releaseCurrentHold = async () => {
    const hold = holdRef.current;
    if (hold) { try { await liberarHold(hold.hold_id); } catch { /* best-effort */ } }
  };

  const handleCancel = async () => {
    await releaseCurrentHold();
    setData(EMPTY);
    setMostrarMetodos(false);
    setMetodoModal(null);
    setResultado(null);
    setExpiredMsg(null);
    setStep('PACIENTE');
  };

  const handleBack = async () => {
    setExpiredMsg(null);
    if (step === 'RESUMEN' && mostrarMetodos) { setMostrarMetodos(false); return; }
    if (step === 'SERVICIO') setStep('PACIENTE');
    else if (step === 'DOCTOR') setStep('SERVICIO');
    else if (step === 'HORARIO') setStep('DOCTOR');
    else if (step === 'RESUMEN') { await releaseCurrentHold(); setData((d) => ({ ...d, slot: null, hold: null })); setStep('HORARIO'); }
  };

  const mmss = remaining != null
    ? `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
    : null;

  const stepIndex = STEPS.indexOf(step);

  if (resultado) {
    return (
      <div className="max-w-xl mx-auto">
        <StepExito
          resultado={resultado}
          onNuevaReserva={() => {
            setData(EMPTY); setMostrarMetodos(false); setMetodoModal(null);
            setResultado(null); setStep('PACIENTE');
          }}
        />
      </div>
    );
  }

  return (
    <div className={mostrarMetodos ? 'max-w-3xl mx-auto' : 'max-w-xl mx-auto'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {(stepIndex > 0 || mostrarMetodos) && (
            <button onClick={handleBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <ChevronLeft size={18} />
            </button>
          )}
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {STEP_LABELS[step]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {mmss && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg
                              bg-amber-50 text-amber-600 border border-amber-200">
              <Timer size={13} /> {mmss}
            </span>
          )}
          <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title="Cancelar reserva">
            <X size={18} />
          </button>
        </div>
      </div>
      <StepIndicator stepIndex={stepIndex} />

      {expiredMsg && (
        <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200
                        rounded-lg px-4 py-3 mb-4">
          <AlertCircle size={15} /> {expiredMsg}
        </div>
      )}

      {step === 'PACIENTE' && (
        <StepPaciente
          titular={titular}
          onRegistrarFamiliar={onRegistrarFamiliar}
          onSelect={(paciente) => { setData((d) => ({ ...d, paciente })); setStep('SERVICIO'); }}
        />
      )}

      {step === 'SERVICIO' && (
        <StepServicio
          onSelect={(servicio) => { setData((d) => ({ ...d, servicio })); setStep('DOCTOR'); }}
        />
      )}

      {step === 'DOCTOR' && (
        <StepDoctor
          servicioId={data.servicio.servicio_id}
          onSelect={(doctor) => { setExpiredMsg(null); setData((d) => ({ ...d, doctor })); setStep('HORARIO'); }}
        />
      )}

      {step === 'HORARIO' && (
        <StepHorario
          pacienteId={data.paciente.paciente_id}
          doctorId={data.doctor.doctor_id}
          servicioId={data.servicio.servicio_id}
          onHoldCreated={(hold, slot) => {
            setExpiredMsg(null);
            setData((d) => ({ ...d, hold, slot }));
            setStep('RESUMEN');
          }}
        />
      )}

      {step === 'RESUMEN' && !mostrarMetodos && (
        <div className="space-y-5">
          <StepResumen paciente={data.paciente} servicio={data.servicio} doctor={data.doctor} slot={data.slot} />
          <button
            onClick={() => setMostrarMetodos(true)}
            className="w-full bg-accent text-white font-bold text-sm py-3 rounded-xl hover:bg-[#78b52c] transition-colors"
          >
            Confirmar y continuar al pago
          </button>
        </div>
      )}

      {step === 'RESUMEN' && mostrarMetodos && (
        <div className="grid sm:grid-cols-2 gap-6 items-start">
          <StepResumen paciente={data.paciente} servicio={data.servicio} doctor={data.doctor} slot={data.slot} />
          <MetodoPagoPicker onSelect={setMetodoModal} />
        </div>
      )}

      {metodoModal && (
        <PaymentModal metodo={metodoModal} onClose={() => setMetodoModal(null)}>
          <StepPago
            metodo={metodoModal}
            holdId={data.hold.hold_id}
            amount={data.servicio.costo}
            defaultEmail={titular.email_cuenta}
            onSuccess={(res) => { setMetodoModal(null); setResultado(res); }}
            onExpired={() => { setMetodoModal(null); handleHoldExpired(); }}
          />
        </PaymentModal>
      )}
    </div>
  );
}
