/**
 * ModalReprogramar.jsx  — PIO-30
 *
 * Props:
 *   open       {boolean}   — controla visibilidad
 *   onClose    {fn}        — cierra sin hacer nada
 *   cita       {object}    — objeto completo de la cita (cita_id, doctor_id, doctor_nombre,
 *                            servicio_nombre, fecha, hora_inicio, hora_fin, codigo_cita)
 *   onSuccess  {fn}        — callback tras reprogramar con éxito
 *
 * Flujo de pantallas (step):
 *   1 'selector'   → navega entre fechas y muestra la grilla de disponibilidad
 *   2 'confirmar'  → resumen Fecha/Hora original vs nueva, botón Confirmar
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, AlertTriangle, Loader2,
  Calendar, Clock, CalendarClock,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// ── Utilidades de fecha ───────────────────────────────────────────
const hoyISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Límite de reserva: solo se permite reprogramar hasta un mes en el futuro.
const maxFechaISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const agregarDias = (fechaStr, n) => {
  const [y, m, d] = String(fechaStr).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fmtFechaCorta = (fechaStr) => {
  if (!fechaStr) return '';
  const [y, m, d] = String(fechaStr).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
};

// ── Colores de slot (alineados con GrillaDisponibilidad) ──────────
const SLOT_STYLE = {
  DISPONIBLE: 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 cursor-pointer',
  OCUPADO: 'bg-blue-100 border border-blue-300 text-blue-800 cursor-not-allowed opacity-70',
  BUFFER: 'bg-amber-50 border border-amber-200 text-amber-600 cursor-not-allowed opacity-70',
  NO_LABORAL: 'bg-slate-50 border border-transparent text-slate-300 cursor-default',
  PASADO: 'bg-slate-50 border border-transparent text-slate-300 opacity-40 cursor-not-allowed',
};

// ─────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────
export default function ModalReprogramar({ open, onClose, cita, onSuccess }) {
  // ── Estado del flujo ─────────────────────────────────────────
  const [step, setStep] = useState('selector'); // 'selector' | 'confirmar'
  const [fecha, setFecha] = useState('');
  const [slotElegido, setSlotElegido] = useState(null); // { hora_inicio, hora_fin }

  // ── Estado de la grilla ──────────────────────────────────────
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [errorSlots, setErrorSlots] = useState('');

  // ── Estado de las acciones de lock / reschedule ──────────────
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [lockExpiresAt, setLockExpiresAt] = useState(null);

  const abortRef = useRef(null);

  // ── Inicializar estado al abrir ──────────────────────────────
  useEffect(() => {
    if (open) {
      setStep('selector');
      const cleanCitaFecha = cita?.fecha ? String(cita.fecha).slice(0, 10) : '';
      const hoy = hoyISO();
      setFecha(cleanCitaFecha && cleanCitaFecha >= hoy ? cleanCitaFecha : hoy);
      setSlotElegido(null);
      setSlots([]);
      setLockError('');
      setConfirmError('');
      setLockExpiresAt(null);
    }
  }, [open, cita]);

  // ── Bloquear scroll + cerrar con Escape ──────────────────────
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const handler = (e) => {
      if (e.key === 'Escape' && !locking && !confirming) handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locking, confirming]);

  // ── Cargar disponibilidad cuando cambia la fecha ──────────────
  const fetchDisponibilidad = async (fechaConsultar) => {
    const targetFecha = typeof fechaConsultar === 'string' ? fechaConsultar : fecha;
    console.log('Disparando fetch para fecha:', targetFecha);
    console.log('URL completa:', `/api/agenda/disponibilidad/${cita?.doctor_id}?fecha=${targetFecha}`);

    setLoadingSlots(true);
    setErrorSlots('');
    setSlots([]);

    try {
      const { data } = await api.get(
        `/agenda/disponibilidad/${cita.doctor_id}`,
        { params: { fecha: targetFecha } }
      );
      setSlots(data.slots ?? []);
    } catch (err) {
      setErrorSlots('No se pudo cargar la disponibilidad. Intente nuevamente.');
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    console.log("Cambio de fecha detectado en el estado:", fecha);
    if (cita && cita.doctor_id && fecha) {
      console.log("Forzando petición al backend para la fecha:", fecha);
      fetchDisponibilidad(fecha);
    } else {
      console.warn("Faltan datos para hacer el fetch. Cita:", cita, "Fecha:", fecha);
    }
  }, [fecha, cita]);

  // ── Cambiar de fecha ──────────────────────────────────────────
  const irFecha = (delta) => {
    console.log('irFecha ejecutado. Delta:', delta, 'Fecha anterior:', fecha);
    const nueva = agregarDias(fecha, delta);
    console.log('Nueva fecha seteada en irFecha:', nueva);
    setFecha(nueva);
  };

  // ── Clic en un slot DISPONIBLE → solicitar lock ───────────────
  const handleSlotClick = async (slot) => {
    if (slot.tipo !== 'DISPONIBLE') return;
    setLocking(true);
    setLockError('');

    try {
      const { data } = await api.post(`/appointments/${cita.cita_id}/lock`, {
        nueva_fecha: fecha,
        nueva_hora_inicio: slot.hora_inicio,
      });
      setSlotElegido({ hora_inicio: slot.hora_inicio, hora_fin: slot.hora_fin });
      setLockExpiresAt(data.expires_at);
      setStep('confirmar');
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Horario no disponible, selecciona otra opción.';
      setLockError(msg);
    } finally {
      setLocking(false);
    }
  };

  // ── Cancelar desde pantalla de confirmación → liberar lock ────
  const handleCancelarConfirmacion = async () => {
    if (slotElegido) {
      // fire-and-forget: si falla el unlock el lock expira solo en 10 min
      api.post(`/appointments/${cita.cita_id}/unlock`, {
        nueva_fecha: fecha,
        nueva_hora_inicio: slotElegido.hora_inicio,
      }).catch(() => { });
    }
    setStep('selector');
    setSlotElegido(null);
    setLockExpiresAt(null);
    setConfirmError('');
  };

  // ── Confirmar reprogramación ──────────────────────────────────
  const handleConfirmar = async () => {
    setConfirming(true);
    setConfirmError('');

    try {
      await api.patch(`/appointments/${cita.cita_id}/reschedule`, {
        nueva_fecha: fecha,
        nueva_hora_inicio: slotElegido.hora_inicio,
        nueva_hora_fin: slotElegido.hora_fin,
      });
      toast.success('Cita reprogramada correctamente');
      onSuccess?.();
    } catch (err) {
      const isNetwork = !err.response;
      const msg = isNetwork
        ? 'No se pudo reprogramar la cita. Intente más tarde.'
        : (err.response?.data?.error ?? 'No se pudo reprogramar la cita. Intente más tarde.');
      setConfirmError(msg);
    } finally {
      setConfirming(false);
    }
  };

  // ── Cerrar limpiando el lock si había uno activo ───────────────
  const handleClose = () => {
    if (slotElegido && step === 'confirmar') {
      api.post(`/appointments/${cita.cita_id}/unlock`, {
        nueva_fecha: fecha,
        nueva_hora_inicio: slotElegido.hora_inicio,
      }).catch(() => { });
    }
    if (abortRef.current) abortRef.current.abort();
    onClose();
  };

  if (!open || !cita) return null;

  // ── Rango de horas de la grilla ───────────────────────────────
  const { horaInicioVis, horaFinVis } = (() => {
    const GRAN = 15;
    if (!slots.length) return { horaInicioVis: 8 * 60, horaFinVis: 18 * 60 };
    let min = Infinity, max = -Infinity;
    for (const s of slots) {
      const [h, m] = s.hora_inicio.split(':').map(Number);
      const ini = h * 60 + m;
      min = Math.min(min, Math.floor(ini / GRAN) * GRAN);
      if (s.hora_fin) {
        const [hf, mf] = s.hora_fin.split(':').map(Number);
        max = Math.max(max, Math.ceil((hf * 60 + mf) / GRAN) * GRAN);
      } else {
        max = Math.max(max, ini + 30);
      }
    }
    return { horaInicioVis: min, horaFinVis: max };
  })();

  const slotsVisibles = slots.filter(s => {
    const [h, m] = s.hora_inicio.split(':').map(Number);
    const mins = h * 60 + m;
    return mins >= horaInicioVis && mins < horaFinVis;
  });

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reprogramar-titulo"
    >
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!locking && !confirming ? handleClose : undefined}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl
                      animate-[fadeSlideUp_0.2s_ease-out] flex flex-col max-h-[90vh]">

        {/* ── Cabecera ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-[#0059B3]" />
            <h2 id="modal-reprogramar-titulo" className="text-base font-bold text-slate-800">
              {step === 'confirmar' ? 'Confirmar reprogramación' : 'Reprogramar cita'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={locking || confirming}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600
                       hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Info de la cita (siempre visible) ── */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-mono font-semibold text-slate-700">{cita.codigo_cita}</span>
            {' · '}{cita.servicio_nombre}
            {' · '}Dr. {cita.doctor_nombre}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Turno actual:{' '}
            <strong className="text-slate-600">
              {fmtFechaCorta(cita.fecha)} · {cita.hora_inicio}–{cita.hora_fin}
            </strong>
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════ */}
        {/* PASO 1: Selector de fecha + grilla de disponibilidad    */}
        {/* ════════════════════════════════════════════════════════ */}
        {step === 'selector' && (
          <div className="flex flex-col flex-1 overflow-hidden">

            {/* Navegación de fecha */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  console.log('Click en botón anterior. Fecha actual:', fecha);
                  irFecha(-1);
                }}
                disabled={fecha <= hoyISO()}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500
                           transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700 capitalize">
                  {fmtFechaCorta(fecha)}
                </p>
                {fecha === hoyISO() && (
                  <span className="text-xs text-[#0059B3] font-medium">Hoy</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  console.log('Click en botón siguiente. Fecha actual:', fecha);
                  irFecha(1);
                }}
                disabled={fecha >= maxFechaISO()}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors
                           disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Error de lock */}
            {lockError && (
              <div className="mx-5 mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200
                              rounded-xl px-3 py-2.5 flex-shrink-0">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">{lockError}</p>
              </div>
            )}

            {/* Grilla de slots */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {errorSlots ? (
                <div className="text-center py-10">
                  <AlertTriangle size={28} className="mx-auto mb-2 text-amber-400" />
                  <p className="text-sm text-slate-500 mb-2">{errorSlots}</p>
                  <button
                    onClick={() => fetchDisponibilidad(fecha)}
                    className="text-xs text-[#0059B3] font-medium hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : loadingSlots || locking ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <Loader2 size={28} className="animate-spin text-[#0059B3]" />
                  <p className="text-sm">{locking ? 'Reservando slot…' : 'Cargando horarios…'}</p>
                </div>
              ) : slotsVisibles.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin horario laboral para este día.</p>
                  <p className="text-xs mt-1">Prueba con otra fecha.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {slotsVisibles.map(s => (
                    <button
                      key={s.hora_inicio}
                      onClick={() => handleSlotClick(s)}
                      disabled={s.tipo !== 'DISPONIBLE' || locking}
                      title={
                        s.tipo === 'OCUPADO' ? 'Turno ocupado' :
                          s.tipo === 'BUFFER' ? 'Tiempo de limpieza' :
                            s.tipo === 'PASADO' ? 'Hora ya pasada' :
                              s.tipo === 'NO_LABORAL' ? 'Fuera de horario' : undefined
                      }
                      className={`rounded-lg px-2 py-2.5 text-xs font-mono font-medium
                                  transition-colors duration-100 text-left leading-tight
                                  ${SLOT_STYLE[s.tipo] ?? SLOT_STYLE.NO_LABORAL}
                                  disabled:cursor-not-allowed`}
                    >
                      {s.hora_inicio}
                      {s.tipo === 'OCUPADO' && (
                        <span className="block text-[10px] text-blue-700 font-sans truncate mt-0.5">
                          {s.cita?.paciente_nombre?.split(' ')[0]}
                        </span>
                      )}
                      {s.tipo === 'BUFFER' && (
                        <span className="block text-[10px] text-amber-400 font-sans italic mt-0.5">
                          limpieza
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Leyenda */}
            <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {[
                  { color: 'bg-emerald-200', label: 'Disponible' },
                  { color: 'bg-blue-300', label: 'Ocupado' },
                  { color: 'bg-amber-200', label: 'Buffer' },
                  { color: 'bg-slate-200', label: 'No laboral' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded border border-slate-200 ${color}`} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* PASO 2: Resumen de confirmación                         */}
        {/* ════════════════════════════════════════════════════════ */}
        {step === 'confirmar' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Tarjeta: Turno original */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Turno original
                </p>
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3
                                flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center
                                  justify-center flex-shrink-0">
                    <Clock size={14} className="text-red-500" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-slate-700 capitalize">
                      {fmtFechaCorta(cita.fecha)}
                    </p>
                    <p className="text-slate-500 font-mono">
                      {cita.hora_inicio} – {cita.hora_fin}
                    </p>
                  </div>
                </div>
              </div>

              {/* Flecha de cambio */}
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full bg-[#0059B3]/10 flex items-center
                                justify-center text-[#0059B3]">
                  <ChevronLeft size={16} className="rotate-[-90deg]" />
                </div>
              </div>

              {/* Tarjeta: Nuevo turno */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Nuevo turno
                </p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3
                                flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center
                                  justify-center flex-shrink-0">
                    <Calendar size={14} className="text-emerald-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-slate-700 capitalize">
                      {fmtFechaCorta(fecha)}
                    </p>
                    <p className="text-slate-500 font-mono">
                      {slotElegido?.hora_inicio} – {slotElegido?.hora_fin}
                    </p>
                  </div>
                </div>
              </div>

              {/* Aviso de expiración del lock */}
              {lockExpiresAt && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100
                                rounded-xl px-3 py-2.5">
                  <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    El horario está reservado temporalmente para ti. Confirma antes de las{' '}
                    <strong>
                      {new Date(lockExpiresAt).toLocaleTimeString('es-PE', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </strong>.
                  </p>
                </div>
              )}

              {/* Error de confirmación */}
              {confirmError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">{confirmError}</p>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <button
                onClick={handleCancelarConfirmacion}
                disabled={confirming}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-300
                           text-slate-700 text-sm font-semibold hover:bg-slate-50
                           transition-colors disabled:opacity-40"
              >
                ← Cambiar horario
              </button>
              <button
                id="modal-btn-confirmar-reprogramar"
                onClick={handleConfirmar}
                disabled={confirming}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                           bg-[#0059B3] hover:bg-[#004a99] text-white text-sm font-semibold
                           transition-colors disabled:opacity-60"
              >
                {confirming
                  ? <><Loader2 size={15} className="animate-spin" /> Reprogramando…</>
                  : <><CalendarClock size={15} /> Confirmar reprogramación</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
