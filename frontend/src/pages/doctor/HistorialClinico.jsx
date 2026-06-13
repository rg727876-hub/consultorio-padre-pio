import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileClock, Search, Loader2, UserRound, ChevronRight, AlertTriangle, SearchX,
} from 'lucide-react';
import api from '../../api/axios';
import AppLayout from '../../components/AppLayout';

export default function HistorialClinico() {
  const navigate = useNavigate();

  const [q,          setQ]          = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [buscado,    setBuscado]    = useState(false);

  const buscar = useCallback(async (e) => {
    e?.preventDefault();
    const texto = q.trim();
    if (texto.length < 2) {
      setError('Ingrese al menos 2 caracteres para buscar.');
      return;
    }
    setLoading(true); setError(''); setBuscado(true);
    try {
      const { data } = await api.get('/historial/buscar', { params: { q: texto } });
      setResultados(data.data);
    } catch (err) {
      if (err.response?.status === 400) {
        setError(err.response.data?.error || 'Búsqueda inválida.');
      } else {
        setError('Error de conexión. Intente más tarde.');
      }
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Encabezado */}
          <div>
            <h1 className="text-xl font-bold text-[#0059B3] flex items-center gap-2">
              <FileClock size={20} /> Historial clínico
            </h1>
            <p className="text-sm text-slate-500">
              Busca un paciente por documento (DNI, CE o Pasaporte), nombres o apellidos.
            </p>
          </div>

          {/* Buscador */}
          <form onSubmit={buscar} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" value={q} autoFocus
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Documento, nombres o apellidos…"
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                />
              </div>
              <button type="submit" disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                           disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Buscar
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle size={14} /> {error}
              </p>
            )}
          </form>

          {/* Resultados */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="skeleton h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-4 w-48" /><div className="skeleton h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : resultados.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100">
              {resultados.map((p) => (
                <button key={p.paciente_id}
                  onClick={() => navigate(`/doctor/historial/${p.paciente_id}`)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#0059B3]/10 flex items-center justify-center
                                  text-[#0059B3] flex-shrink-0">
                    <UserRound size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{p.nombre} {p.apellido}</p>
                    <p className="text-xs text-slate-400">
                      {p.tipo_documento}: {p.numero_documento}
                      {p.edad != null && <> · {p.edad} años</>}
                      {p.telefono && <> · Tel. {p.telefono}</>}
                      {p.estado === 'INACTIVO' && <> · <span className="text-amber-600">Inactivo</span></>}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : buscado && !error ? (
            <div className="bg-white rounded-2xl shadow-sm text-center py-14 text-slate-400">
              <SearchX size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No se encontraron pacientes con ese criterio.</p>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
