import { useState, useEffect, useCallback } from 'react';
import { useNavigate }                       from 'react-router-dom';
import {
  Search, Users, ChevronLeft, ChevronRight,
  Eye, AlertTriangle, UserX,
} from 'lucide-react';
import api      from '../../api/axios';
import AppLayout from '../../components/AppLayout';
import DetallePaciente from './DetallePaciente';

// ── Helpers ───────────────────────────────────────────────────────
const DOC_LABEL = { DNI: 'DNI', CE: 'C.E.', PASAPORTE: 'Pasaporte' };

const fmtDoc = (tipo, numero) => `${DOC_LABEL[tipo] ?? tipo} ${numero}`;

// ── Componente principal ──────────────────────────────────────────
export default function ListaPacientes() {
  const navigate = useNavigate();

  // ── Estado ──────────────────────────────────────────────────────
  const [pacientes, setPacientes] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [page,      setPage]      = useState(1);
  const [pages,     setPages]     = useState(1);
  const [total,     setTotal]     = useState(0);

  // Filtros
  const [q,      setQ]      = useState(() => sessionStorage.getItem('listaPacientes_q') || '');
  const [estado, setEstado] = useState(() => sessionStorage.getItem('listaPacientes_estado') || 'ACTIVO'); // default: solo activos
  const [detalleId, setDetalleId] = useState(null); // paciente en ventana flotante

  useEffect(() => {
    sessionStorage.setItem('listaPacientes_q', q);
    sessionStorage.setItem('listaPacientes_estado', estado);
  }, [q, estado]);

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchPacientes = useCallback(async (p = 1, overrides = {}) => {
    const f = { q, estado, ...overrides };
    setLoading(true);
    setError('');
    try {
      const params = { page: p };
      if (f.q?.trim())  params.q      = f.q.trim();
      if (f.estado)     params.estado = f.estado;

      const { data } = await api.get('/patients', { params });
      setPacientes(data.data ?? []);
      setPages(data.pages ?? 1);
      setTotal(data.total ?? 0);
      setPage(p);
    } catch {
      setError('Error de conexión. Intente más tarde.');
      setPacientes([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado]);

  // Carga inicial y debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPacientes(1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, estado]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleEstadoChange = (val) => {
    setEstado(val);
    fetchPacientes(1, { estado: val });
  };

  const limpiarFiltros = () => {
    setQ('');
    setEstado('ACTIVO');
    fetchPacientes(1, { q: '', estado: 'ACTIVO' });
  };

  const verPerfil = (id) => setDetalleId(id);

  const hayFiltros = q.trim() || estado !== 'ACTIVO';

  // ── Render ───────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* ── Encabezado ── */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-[#0059B3]">Gestión de pacientes</h1>
              <p className="text-sm text-slate-500">
                Busca, filtra y accede al perfil de cada paciente
              </p>
            </div>
            <button
              onClick={() => navigate('/recepcion/pacientes/nuevo')}
              className="flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                         text-white text-sm font-semibold px-4 py-2 rounded-lg
                         transition-colors shadow-sm"
            >
              <Users size={15} />
              Nuevo paciente
            </button>
          </div>

          {/* ── Barra de búsqueda y filtros ── */}
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">

              {/* Búsqueda */}
              <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                <label className="text-xs font-medium text-slate-600">
                  Buscar (DNI, nombre o apellido)
                </label>
                <div className="relative">
                  <Search size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="pac-busqueda"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchPacientes(1)}
                    placeholder="Ej. 71126808 o García"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                  />
                </div>
              </div>

              {/* Filtro estado */}
              <div className="flex flex-col gap-1 w-44">
                <label className="text-xs font-medium text-slate-600">Estado</label>
                <select
                  id="pac-estado"
                  value={estado}
                  onChange={e => handleEstadoChange(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                >
                  <option value="ACTIVO">Activos</option>
                  <option value="INACTIVO">Inactivos</option>
                  <option value="TODOS">Todos</option>
                </select>
              </div>

              {/* Botón buscar */}
              <button
                id="pac-btn-buscar"
                onClick={() => fetchPacientes(1)}
                className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99]
                           text-white text-sm font-semibold px-4 py-2 rounded-lg
                           transition-colors"
              >
                <Search size={14} /> Buscar
              </button>

              {/* Limpiar filtros */}
              {hayFiltros && (
                <button
                  onClick={limpiarFiltros}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium pb-2"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Indicador de modo "Todos" */}
            {estado === 'TODOS' && (
              <p className="mt-2 text-xs text-slate-400">
                Mostrando todos los pacientes — activos primero, luego inactivos (en gris).
              </p>
            )}
          </section>

          {/* ── Tabla / Estados de carga / Error / Vacío ── */}
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Error */}
            {error ? (
              <div className="text-center py-16">
                <AlertTriangle size={36} className="mx-auto mb-2 text-amber-400" />
                <p className="text-sm text-slate-600">{error}</p>
                <button
                  onClick={() => fetchPacientes(page)}
                  className="mt-3 text-[#0059B3] text-sm font-medium hover:underline"
                >
                  Reintentar
                </button>
              </div>

            ) : loading ? (
              /* Skeleton */
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4">
                    <div className="skeleton h-4 w-28" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-44" />
                      <div className="skeleton h-3 w-28" />
                    </div>
                    <div className="skeleton h-5 w-20 rounded-full" />
                    <div className="skeleton h-7 w-8 rounded-lg" />
                  </div>
                ))}
              </div>

            ) : pacientes.length === 0 ? (
              /* Estado vacío */
              <div className="text-center py-20 text-slate-400">
                <UserX size={42} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-slate-500 mb-4">
                  No se encontraron pacientes.
                </p>
                <button
                  onClick={() => navigate('/recepcion/pacientes/nuevo')}
                  className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                             text-white text-sm font-semibold px-5 py-2.5 rounded-lg
                             transition-colors shadow-sm"
                >
                  <Users size={15} />
                  Registrar paciente nuevo
                </button>
              </div>

            ) : (
              <>
                {/* Tabla */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {[
                          'Documento',
                          'Nombres',
                          'Apellidos',
                          'Teléfono',
                          'Estado',
                          'Acciones',
                        ].map(h => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold
                                       text-slate-500 uppercase tracking-wide whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pacientes.map(p => {
                        const inactivo = p.estado === 'INACTIVO';
                        return (
                          <tr
                            key={p.paciente_id}
                            className={`transition-colors
                              ${inactivo
                                ? 'opacity-50 hover:bg-slate-50'
                                : 'hover:bg-slate-50'
                              }`}
                          >
                            {/* Documento */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-slate-500">
                                {fmtDoc(p.tipo_documento, p.numero_documento)}
                              </span>
                            </td>

                            {/* Nombres */}
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                              <div className="flex items-center gap-3">
                                {p.foto ? (
                                  <img 
                                    src={p.foto?.startsWith('http') ? p.foto : `${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${p.foto}`} 
                                    alt="Foto" 
                                    className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold flex-shrink-0">
                                    {(p.nombre?.[0] ?? '') + (p.apellido?.[0] ?? '')}
                                  </div>
                                )}
                                <span>{p.nombre}</span>
                              </div>
                            </td>

                            {/* Apellidos */}
                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                              {p.apellido}
                            </td>

                            {/* Teléfono */}
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {p.telefono}
                            </td>

                            {/* Estado */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {inactivo ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                                                 px-2.5 py-1 rounded-full border
                                                 bg-slate-50 text-slate-500 border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  Inactivo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                                                 px-2.5 py-1 rounded-full border
                                                 bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Activo
                                </span>
                              )}
                            </td>

                            {/* Acciones */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <IconBtn
                                id={`pac-ver-${p.paciente_id}`}
                                title="Ver perfil del paciente"
                                onClick={() => verPerfil(p.paciente_id)}
                                className="text-slate-500 hover:bg-slate-100"
                              >
                                <Eye size={15} />
                              </IconBtn>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center
                                justify-between text-sm text-slate-500">
                  <span>
                    {total} paciente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                  </span>
                  {pages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchPacientes(page - 1)}
                        disabled={page <= 1}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40
                                   disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="font-medium text-slate-700">
                        {page} / {pages}
                      </span>
                      <button
                        onClick={() => fetchPacientes(page + 1)}
                        disabled={page >= pages}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40
                                   disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

        </div>
      </div>

      {detalleId && (
        <DetallePaciente
          id={detalleId}
          onClose={() => { setDetalleId(null); fetchPacientes(page); }}
        />
      )}
    </AppLayout>
  );
}

// ── Botón de icono reutilizable ───────────────────────────────────
function IconBtn({ id, title, onClick, className = '', children }) {
  return (
    <button
      id={id}
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
