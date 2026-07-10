import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Loader2, AlertCircle, Clock } from 'lucide-react';
import { getDisponibilidad, crearHold } from '../../services/portalAppointments.service';

const hoyISO = () => new Date().toLocaleDateString('en-CA');

export default function StepHorario({ pacienteId, doctorId, servicioId, onHoldCreated }) {
  const [fecha, setFecha]       = useState(hoyISO());
  const [slots, setSlots]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [reservando, setReservando] = useState(null); // hora_inicio en curso
  const [holdError, setHoldError]   = useState(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getDisponibilidad(doctorId, servicioId, fecha);
      setSlots(Array.isArray(data?.slots) ? data.slots : []);
    } catch {
      setError('No se pudo cargar la disponibilidad.');
    } finally {
      setLoading(false);
    }
  }, [doctorId, servicioId, fecha]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const handleSelectSlot = async (slot) => {
    setReservando(slot.hora_inicio); setHoldError(null);
    try {
      const { data } = await crearHold({
        paciente_id: pacienteId, doctor_id: doctorId, servicio_id: servicioId,
        fecha, hora_inicio: slot.hora_inicio,
      });
      onHoldCreated(
        { hold_id: data.hold_id, expires_at: data.expires_at },
        { fecha, hora_inicio: slot.hora_inicio, hora_fin: slot.hora_fin }
      );
    } catch (err) {
      setHoldError(err?.response?.data?.error ?? 'No se pudo reservar ese horario. Intenta con otro.');
      fetchSlots();
    } finally {
      setReservando(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-slate-800 text-lg mb-1">Elige día y hora</h2>
        <p className="text-sm text-slate-400">Al seleccionar un horario lo reservamos para ti por 10 minutos.</p>
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

      {holdError && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {holdError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 py-10 flex flex-col items-center gap-2 text-center px-4">
          <Clock size={22} className="text-slate-300" />
          <p className="text-sm text-slate-400">No hay horarios disponibles para este día. Prueba otra fecha.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s.hora_inicio}
              onClick={() => handleSelectSlot(s)}
              disabled={reservando !== null}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-semibold
                         border-slate-200 bg-white text-slate-700 hover:border-primary hover:bg-primary/5
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {reservando === s.hora_inicio
                ? <Loader2 size={14} className="animate-spin" />
                : s.hora_inicio}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
