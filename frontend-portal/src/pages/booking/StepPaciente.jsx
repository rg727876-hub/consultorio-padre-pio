import { useState, useEffect, useCallback } from 'react';
import { User, Users, UserPlus, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { getFamiliares } from '../../services/patientFamily.service';

const toTitle = (s) => (s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const labelParentesco = (value) => {
  const map = {
    'HIJO/A': 'Hijo/a', CONYUGE: 'Cónyuge', PADRE: 'Padre', MADRE: 'Madre',
    'HERMANO/A': 'Hermano/a', 'ABUELO/A': 'Abuelo/a', OTRO: 'Otro',
  };
  return map[value] ?? toTitle(value ?? '');
};

export default function StepPaciente({ titular, onSelect, onRegistrarFamiliar }) {
  const [familiares, setFamiliares] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const fetchFamiliares = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await getFamiliares();
      setFamiliares(Array.isArray(data?.familiares) ? data.familiares : []);
    } catch {
      setError('No se pudo cargar la lista de familiares.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFamiliares(); }, [fetchFamiliares]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-slate-800 text-lg mb-1">¿Para quién es la cita?</h2>
        <p className="text-sm text-slate-400">Elige si la reserva es para ti o para un familiar vinculado.</p>
      </div>

      {/* Titular */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Titular</p>
        <button
          onClick={() => onSelect({ paciente_id: titular.paciente_id, nombre: `${toTitle(titular.nombre)} ${toTitle(titular.apellido)}`, parentesco: null, foto: titular.foto })}
          className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-slate-200
                     shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5
                     transition-all duration-200 text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {titular.foto ? (
              <img src={titular.foto?.startsWith('http') ? titular.foto : (titular.foto?.startsWith('http') ? titular.foto : `${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${titular.foto}`)} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {toTitle(titular.nombre)} {toTitle(titular.apellido)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Tú (titular de la cuenta)</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>

      {/* Familiares */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Familiar</p>
          <button
            onClick={onRegistrarFamiliar}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <UserPlus size={13} /> Registrar familiar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={15} /> {error}
          </div>
        ) : familiares.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-slate-200 py-8 flex flex-col items-center gap-2 text-center px-4">
            <Users size={22} className="text-slate-300" />
            <p className="text-xs text-slate-400">
              Aún no tienes familiares vinculados. Usa "Registrar familiar" para agendarles una cita.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {familiares.map((f) => (
              <button
                key={f.relacion_id}
                onClick={() => onSelect({
                  paciente_id: f.paciente_id,
                  nombre: `${toTitle(f.nombre)} ${toTitle(f.apellido)}`,
                  parentesco: f.parentesco,
                  foto: f.foto
                })}
                className="w-full flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-slate-200
                           shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5
                           transition-all duration-200 text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {f.foto ? (
                    <img src={f.foto?.startsWith('http') ? f.foto : (f.foto?.startsWith('http') ? f.foto : `${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${f.foto}`)} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={18} className="text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {toTitle(f.nombre)} {toTitle(f.apellido)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{labelParentesco(f.parentesco)}</p>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
