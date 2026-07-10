import { useState, useEffect, useCallback } from 'react';
import { Stethoscope, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { getServiciosPublicos } from '../../services/public.service';

export default function StepServicio({ onSelect }) {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const fetchServicios = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getServiciosPublicos();
      setServicios(Array.isArray(data) ? data : []);
    } catch {
      setError('No se pudo cargar la lista de servicios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServicios(); }, [fetchServicios]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-slate-800 text-lg mb-1">¿Qué servicio necesitas?</h2>
        <p className="text-sm text-slate-400">Elige la especialidad o servicio que deseas reservar.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      ) : servicios.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">No hay servicios disponibles por el momento.</p>
      ) : (
        <div className="space-y-2">
          {servicios.map((s) => (
            <button
              key={s.servicio_id}
              onClick={() => onSelect(s)}
              className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-slate-200
                         shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5
                         transition-all duration-200 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{s.nombre}</p>
                {s.descripcion && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-accent">S/ {Number(s.costo).toFixed(2)}</span>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
