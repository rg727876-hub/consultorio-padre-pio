import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertCircle, ChevronRight, X, Calendar, Clock,
  FileText, CalendarDays, Ban, CalendarClock, ExternalLink,
} from 'lucide-react';
import {
  getMisCitas, getCitaDetalle, anularCita, reprogramarCita, getDisponibilidad,
} from '../services/portalAppointments.service';

// ── Utilidades ────────────────────────────────────────────────────────────────
const hoyISO = () => new Date().toLocaleDateString('en-CA');

const fmtFechaLarga = (f) => {
  if (!f) return 'Sin fecha';
  return new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
};
const fmtFechaCorta = (f) => {
  if (!f) return 'Sin fecha';
  return new Date(f + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ESTADO_BADGE = {
  CONFIRMADA: 'bg-blue-50 text-blue-600 border-blue-200',
  ATENDIDA:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  CANCELADA:  'bg-red-50 text-red-500 border-red-200',
  NO_ASISTIO: 'bg-amber-50 text-amber-600 border-amber-200',
};
const ESTADO_LABEL = {
  CONFIRMADA: 'Confirmada',
  ATENDIDA:   'Atendida',
  CANCELADA:  'Cancelada',
  NO_ASISTIO: 'No asistió',
};

function EstadoBadge({ estado }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ESTADO_BADGE[estado] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

// ── Modal: detalle de una cita (próxima o histórica) ─────────────────────────
function CitaDetalleModal({ citaId, modo, onClose, onSuccess }) {
  const [detalle, setDetalle]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [vista, setVista]       = useState('info'); // info | confirmarAnular | reprogramar

  const [anulando, setAnulando]       = useState(false);
  const [anularError, setAnularError] = useState(null);

  const [fecha, setFecha]                 = useState(hoyISO());
  const [slots, setSlots]                 = useState([]);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [slotsError, setSlotsError]       = useState(null);
  const [reprogramando, setReprogramando] = useState(null); // hora_inicio en curso
  const [reprogError, setReprogError]     = useState(null);

  const fetchDetalle = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getCitaDetalle(citaId);
      setDetalle(data);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'No se pudo cargar el detalle de la cita.');
    } finally {
      setLoading(false);
    }
  }, [citaId]);

  useEffect(() => { fetchDetalle(); }, [fetchDetalle]);

  const fetchSlots = useCallback(async () => {
    if (!detalle) return;
    setLoadingSlots(true); setSlotsError(null);
    try {
      const { data } = await getDisponibilidad(detalle.doctor_id, detalle.servicio_id, fecha);
      setSlots(Array.isArray(data?.slots) ? data.slots : []);
    } catch {
      setSlotsError('No se pudo cargar la disponibilidad.');
    } finally {
      setLoadingSlots(false);
    }
  }, [detalle, fecha]);

  useEffect(() => { if (vista === 'reprogramar') fetchSlots(); }, [vista, fetchSlots]);

  const handleAnular = async () => {
    setAnulando(true); setAnularError(null);
    try {
      await anularCita(citaId);
      onSuccess('Cita anulada correctamente');
    } catch (err) {
      setAnularError(err?.response?.data?.error ?? 'No se pudo anular la cita. Intenta nuevamente.');
    } finally {
      setAnulando(false);
    }
  };

  const handleElegirSlot = async (slot) => {
    setReprogramando(slot.hora_inicio); setReprogError(null);
    try {
      await reprogramarCita(citaId, { nueva_fecha: fecha, nueva_hora_inicio: slot.hora_inicio });
      onSuccess('Cita reprogramada correctamente');
    } catch (err) {
      setReprogError(err?.response?.data?.error ?? 'No se pudo reprogramar la cita. Intenta con otro horario.');
      setReprogramando(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/50 backdrop-blur-sm sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl
                      flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {vista === 'reprogramar' ? 'Reprogramar cita' : 'Detalle de la cita'}
            </h2>
            {detalle && vista === 'info' && (
              <p className="text-xs text-slate-400 mt-0.5">Código {detalle.codigo_cita}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <X size={19} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle size={15} /> {error}
            </div>
          ) : vista === 'confirmarAnular' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                ¿Estás seguro de anular esta cita? Esta acción no se puede deshacer y no genera reembolso.
              </p>
              {anularError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> <span>{anularError}</span>
                </div>
              )}
            </div>
          ) : vista === 'reprogramar' ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{detalle.servicio_nombre}</span> con{' '}
                <span className="font-semibold text-slate-700">{detalle.doctor_nombre}</span> — el servicio y doctor no cambian.
              </div>

              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
                <CalendarDays size={16} className="text-primary shrink-0" />
                <input
                  type="date"
                  value={fecha}
                  min={hoyISO()}
                  onChange={(e) => setFecha(e.target.value)}
                  className="flex-1 outline-none text-sm text-slate-700 bg-transparent"
                />
              </div>

              {reprogError && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle size={15} /> {reprogError}
                </div>
              )}

              {loadingSlots ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
              ) : slotsError ? (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle size={15} /> {slotsError}
                </div>
              ) : slots.length === 0 ? (
                <div className="bg-slate-50 rounded-xl border border-slate-200 py-8 flex flex-col items-center gap-2 text-center px-4">
                  <Clock size={20} className="text-slate-300" />
                  <p className="text-sm text-slate-400">No hay horarios disponibles para este día. Prueba otra fecha.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.hora_inicio}
                      onClick={() => handleElegirSlot(s)}
                      disabled={reprogramando !== null}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-semibold
                                 border-slate-200 bg-white text-slate-700 hover:border-primary hover:bg-primary/5
                                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {reprogramando === s.hora_inicio ? <Loader2 size={14} className="animate-spin" /> : s.hora_inicio}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <EstadoBadge estado={detalle.estado} />
                <span className="text-sm font-bold text-primary">S/ {Number(detalle.precio_aplicado).toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Fecha</p>
                  <p className="text-sm text-slate-800 font-medium">{fmtFechaLarga(detalle.fecha)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hora</p>
                  <p className="text-sm text-slate-800 font-medium">{detalle.hora_inicio}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Doctor</p>
                  <p className="text-sm text-slate-800 font-medium">{detalle.doctor_nombre}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Servicio</p>
                  <p className="text-sm text-slate-800 font-medium">{detalle.servicio_nombre}</p>
                </div>
              </div>

              {detalle.estado === 'CANCELADA' && detalle.fecha_cancelacion && (
                <p className="text-xs text-slate-400">
                  Anulada el {new Date(detalle.fecha_cancelacion).toLocaleDateString('es-PE')}
                </p>
              )}

              {detalle.pago && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pago</p>
                  <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-700 font-medium">{detalle.pago.metodo_pago.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-400">{detalle.pago.estado}</p>
                    </div>
                    {detalle.comprobante?.nubefact_pdf_url && (
                      <a
                        href={detalle.comprobante.nubefact_pdf_url}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                      >
                        <FileText size={13} /> Comprobante <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {modo === 'proxima' && detalle.estado === 'CONFIRMADA' && !detalle.anulable && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>Esta cita ya no puede anularse en línea: falta menos de 24 horas. Comunícate con el consultorio.</span>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && !error && (
          <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            {vista === 'confirmarAnular' ? (
              <>
                <button onClick={() => setVista('info')} disabled={anulando}
                  className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm font-semibold
                             text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40">
                  No, cancelar
                </button>
                <button onClick={handleAnular} disabled={anulando}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white
                             font-bold text-sm py-2.5 rounded-xl hover:bg-red-600
                             disabled:opacity-40 transition-colors">
                  {anulando ? <><Loader2 size={15} className="animate-spin" /> Anulando…</> : <>Sí, anular</>}
                </button>
              </>
            ) : vista === 'reprogramar' ? (
              <button onClick={() => { setVista('info'); setReprogError(null); }} disabled={reprogramando !== null}
                className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm font-semibold
                           text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40">
                Volver al detalle
              </button>
            ) : modo === 'proxima' && detalle?.estado === 'CONFIRMADA' ? (
              <>
                <button onClick={() => { setAnularError(null); setVista('confirmarAnular'); }}
                  disabled={!detalle.anulable}
                  className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-500
                             text-sm font-bold py-2.5 rounded-xl hover:bg-red-50 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed">
                  <Ban size={14} /> Anular
                </button>
                <button onClick={() => { setReprogError(null); setVista('reprogramar'); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent text-white
                             text-sm font-bold py-2.5 rounded-xl hover:bg-[#78b52c] transition-colors">
                  <CalendarClock size={14} /> Reprogramar
                </button>
              </>
            ) : (
              <button onClick={onClose}
                className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm font-semibold
                           text-slate-600 hover:bg-slate-50 transition-colors">
                Cerrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Próximas citas (tarjetas) ─────────────────────────────────────────────────
export function ProximasCitas({ pacienteId, onSuccess }) {
  const [citas, setCitas]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [seleccionada, setSeleccionada] = useState(null);

  const fetchCitas = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getMisCitas(pacienteId, 'proximas');
      setCitas(Array.isArray(data?.citas) ? data.citas : []);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'No se pudieron cargar las próximas citas.');
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { fetchCitas(); }, [fetchCitas]);

  const handleModalSuccess = (msg) => {
    setSeleccionada(null);
    fetchCitas();
    if (onSuccess) onSuccess(msg);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>;
  if (error) return (
    <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <AlertCircle size={15} /> {error}
    </div>
  );

  return (
    <>
      {citas.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-3">
          No tienes citas próximas confirmadas.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {citas.map((c) => (
            <button
              key={c.cita_id}
              onClick={() => setSeleccionada(c.cita_id)}
              className="text-left px-4 py-3.5 bg-white rounded-xl border border-slate-200
                         hover:border-accent/40 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-primary">
                  <Calendar size={14} />
                  <span className="text-sm font-bold text-slate-800">{fmtFechaCorta(c.fecha)}</span>
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-accent transition-colors shrink-0" />
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                <Clock size={12} /> {c.hora_inicio}
              </p>
              <p className="text-sm font-semibold text-slate-800 truncate">{c.servicio_nombre}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{c.doctor_nombre}</p>
              <p className="text-[10px] text-slate-400 mt-1.5 font-mono">Código {c.codigo_cita}</p>
            </button>
          ))}
        </div>
      )}

      {seleccionada && (
        <CitaDetalleModal
          citaId={seleccionada}
          modo="proxima"
          onClose={() => setSeleccionada(null)}
          onSuccess={handleModalSuccess}
        />
      )}
    </>
  );
}

// ── Mis pagos (lista plana, sin modal — solo consulta rápida) ────────────────
export function MisPagos({ pacienteId }) {
  const [pagos, setPagos]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchPagos = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getMisCitas(pacienteId, 'pagos');
      setPagos(Array.isArray(data?.citas) ? data.citas : []);
    } catch (err) {
      setError(err?.response?.data?.error ?? 'No se pudo cargar el historial de pagos.');
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { fetchPagos(); }, [fetchPagos]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>;
  if (error) return (
    <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <AlertCircle size={15} /> {error}
    </div>
  );

  return pagos.length === 0 ? (
    <p className="text-sm text-slate-400 italic text-center py-3">
      No tienes pagos registrados todavía.
    </p>
  ) : (
    <div className="space-y-1.5">
      {pagos.map((p) => (
        <div
          key={p.cita_id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 bg-white rounded-lg border border-slate-100"
        >
          <span className="text-xs text-slate-500 w-20 shrink-0">{fmtFechaCorta(p.fecha)}</span>
          <span className="text-sm text-slate-700 font-medium truncate flex-1 min-w-[7rem]">{p.servicio_nombre}</span>
          <span className="text-sm font-bold text-slate-800 shrink-0">S/ {Number(p.monto_pagado).toFixed(2)}</span>
          <EstadoBadge estado={p.estado} />
          {p.comprobante_url ? (
            <a
              href={p.comprobante_url}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0"
            >
              <FileText size={12} /> Ver comprobante
            </a>
          ) : (
            <span className="text-[11px] text-slate-300 shrink-0">Sin comprobante</span>
          )}
        </div>
      ))}
    </div>
  );
}
