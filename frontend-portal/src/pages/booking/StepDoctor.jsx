import { useState, useEffect, useCallback } from 'react';
import { UserRound, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { getDoctoresPorServicio } from '../../services/portalAppointments.service';

const toTitle = (s) => (s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function StepDoctor({ servicioId, onSelect }) {
  const [doctores, setDoctores] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [notFound, setNotFound] = useState(null);

  const fetchDoctores = useCallback(async () => {
    setLoading(true); setError(null); setNotFound(null);
    try {
      const { data } = await getDoctoresPorServicio(servicioId);
      setDoctores(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(err.response.data?.error ?? 'No hay doctores disponibles para este servicio.');
      } else {
        setError('No se pudo cargar la lista de doctores.');
      }
    } finally {
      setLoading(false);
    }
  }, [servicioId]);

  useEffect(() => { fetchDoctores(); }, [fetchDoctores]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-slate-800 text-lg mb-1">Elige tu médico</h2>
        <p className="text-sm text-slate-400">Doctores activos disponibles para este servicio.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : notFound ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-6 text-center">
          <p className="text-sm font-semibold text-amber-700">{notFound}</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      ) : (
        <div className="space-y-2">
          {doctores.map((d) => (
            <button
              key={d.doctor_id}
              onClick={() => onSelect(d)}
              className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-slate-200
                         shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5
                         transition-all duration-200 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {d.avatar ? (
                  <img src={`${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${d.avatar}`} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserRound size={18} className="text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  Dr. {toTitle(d.apellido)}, {toTitle(d.nombre)}
                </p>
                {d.especialidad && (
                  <p className="text-xs text-slate-500 mt-0.5">{d.especialidad}</p>
                )}
              </div>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
