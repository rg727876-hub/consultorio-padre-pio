import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronLeft, ChevronRight, CalendarX2, AlertTriangle,
  Eye, Ban, CalendarClock, ChevronDown
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';
import { ESTADOS, estadoInfo, fmtFecha } from './citaEstados';
import ModalCancelarCita from '../../components/appointments/ModalCancelarCita';

export default function GestionCitas() {
  const navigate = useNavigate();

  const [citas,       setCitas]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [page,        setPage]        = useState(1);
  const [pages,       setPages]       = useState(1);
  const [total,       setTotal]       = useState(0);
  const [totalGlobal, setTotalGlobal] = useState(0);
  // Cita seleccionada para cancelar: { cita_id, codigo_cita } | null
  const [citaCancelar, setCitaCancelar] = useState(null);

  // Filtros
  const [q,           setQ]           = useState('');
  const [codigo,      setCodigo]      = useState('');
  const [doctorId,    setDoctorId]    = useState('');
  const [estado,      setEstado]      = useState([]);
  const [isOpenEstado, setIsOpenEstado] = useState(false);
  const estadoRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (estadoRef.current && !estadoRef.current.contains(event.target)) {
        setIsOpenEstado(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin,    setFechaFin]    = useState('');

  const [doctores, setDoctores] = useState([]);

  useEffect(() => {
    api.get('/doctors')
      .then(({ data }) => setDoctores(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchCitas = useCallback(async (p = 1, overrides = {}) => {
    const f = { q, codigo, doctorId, estado, fechaInicio, fechaFin, ...overrides };
    setLoading(true);
    setError('');
    try {
      const params = { page: p };
      if (f.q?.trim())      params.q            = f.q.trim();
      if (f.codigo?.trim()) params.codigo       = f.codigo.trim();
      if (f.doctorId)       params.doctor_id    = f.doctorId;
      if (f.estado?.length > 0) params.estado = f.estado.join(',');
      if (f.fechaInicio)    params.fecha_inicio = f.fechaInicio;
      if (f.fechaFin)       params.fecha_fin    = f.fechaFin;

      const { data } = await api.get('/appointments', { params });
      setCitas(data.data);
      setPages(data.pages);
      setTotal(data.total);
      setTotalGlobal(data.total_global);
      setPage(p);
    } catch {
      setError('Error de conexión. Intente más tarde.');
      setCitas([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, codigo, doctorId, estado, fechaInicio, fechaFin]);

  // Carga inicial (citas de hoy)
  useEffect(() => { fetchCitas(1); /* eslint-disable-next-line */ }, []);

  const limpiarFiltros = () => {
    setQ(''); setCodigo(''); setDoctorId(''); setEstado([]);
    setFechaInicio(''); setFechaFin('');
    fetchCitas(1, { q: '', codigo: '', doctorId: '', estado: [], fechaInicio: '', fechaFin: '' });
  };

  const proximamente = (accion) =>
    toast(`"${accion}" estará disponible en la siguiente actualización.`, { icon: '🔧' });

  const verDetalle = (id) => navigate(`/recepcion/citas/${id}`);

  const hayFiltros = q || codigo || doctorId || estado.length > 0 || fechaInicio || fechaFin;

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="mb-2">
            <h1 className="text-xl font-bold text-[#0059B3]">Gestión de citas</h1>
            <p className="text-sm text-slate-500">
              Lista, busca y filtra las citas para cancelarlas o reprogramarlas
            </p>
          </div>

          {/* Filtros */}
          <section className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-slate-600">Paciente (DNI, nombre o apellido)</label>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchCitas(1)}
                  placeholder="Ej. 71126808 o Juan Pérez"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                />
              </div>
              <div className="flex flex-col gap-1 w-40">
                <label className="text-xs font-medium text-slate-600">Código de cita</label>
                <input
                  value={codigo}
                  onChange={e => setCodigo(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && fetchCitas(1)}
                  placeholder="Ej. A1B2C3D4E5"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                />
              </div>
              <button
                onClick={() => fetchCitas(1)}
                className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99]
                           text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Search size={14} /> Buscar
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs font-medium text-slate-600">Doctor</label>
                <select
                  value={doctorId}
                  onChange={e => { setDoctorId(e.target.value); fetchCitas(1, { doctorId: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                >
                  <option value="">Todos</option>
                  {doctores.map(d => (
                    <option key={d.doctor_id} value={d.doctor_id}>{d.nombre} {d.apellido}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[200px]" ref={estadoRef}>
                <label className="text-xs font-medium text-slate-600">Estado(s)</label>
                <div className="relative">
                  <div
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                               cursor-pointer flex items-center justify-between hover:bg-slate-50 transition-colors"
                    onClick={() => setIsOpenEstado(!isOpenEstado)}
                  >
                    <span className="truncate text-slate-700">
                      {estado.length === 0
                        ? 'Todos'
                        : `${estado.length} seleccionado${estado.length > 1 ? 's' : ''}`}
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpenEstado ? 'rotate-180' : ''}`} />
                  </div>

                  {isOpenEstado && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 
                                    rounded-lg shadow-lg z-10 py-1 max-h-60 overflow-y-auto">
                      <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={estado.length === 0}
                          onChange={() => { setEstado([]); fetchCitas(1, { estado: [] }); setIsOpenEstado(false); }}
                          className="rounded text-[#0059B3] focus:ring-[#0059B3]"
                        />
                        Todos
                      </label>
                      {Object.entries(ESTADOS).map(([val, { label }]) => (
                        <label key={val} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={estado.includes(val)}
                            onChange={(e) => {
                              let nuevosEstados;
                              if (e.target.checked) {
                                nuevosEstados = [...estado, val];
                              } else {
                                nuevosEstados = estado.filter(s => s !== val);
                              }
                              setEstado(nuevosEstados);
                              fetchCitas(1, { estado: nuevosEstados });
                            }}
                            className="rounded text-[#0059B3] focus:ring-[#0059B3]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Desde</label>
                <input type="date" value={fechaInicio}
                  onChange={e => { setFechaInicio(e.target.value); fetchCitas(1, { fechaInicio: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Hasta</label>
                <input type="date" value={fechaFin}
                  onChange={e => { setFechaFin(e.target.value); fetchCitas(1, { fechaFin: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40" />
              </div>
              {hayFiltros && (
                <button onClick={limpiarFiltros}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium pb-2.5">
                  Limpiar filtros
                </button>
              )}
            </div>
          </section>

          {/* Tabla */}
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {error ? (
              <div className="text-center py-16">
                <AlertTriangle size={36} className="mx-auto mb-2 text-amber-400" />
                <p className="text-sm text-slate-600">{error}</p>
                <button onClick={() => fetchCitas(page)}
                  className="mt-3 text-[#0059B3] text-sm font-medium hover:underline">
                  Reintentar
                </button>
              </div>
            ) : loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4">
                    <div className="skeleton h-4 w-24" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-40" />
                      <div className="skeleton h-3 w-24" />
                    </div>
                    <div className="skeleton h-5 w-20 rounded-full" />
                    <div className="skeleton h-7 w-24 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : citas.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <CalendarX2 size={38} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {totalGlobal === 0
                    ? 'No existen citas registradas en el sistema.'
                    : 'No se encontraron citas con esos criterios.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Código', 'Fecha', 'Hora', 'Paciente', 'Doctor', 'Servicio', 'Estado', 'Acciones'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                                  text-slate-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {citas.map(c => {
                        const est = estadoInfo(c.estado);
                        return (
                          <tr key={c.cita_id}
                            onClick={() => verDetalle(c.cita_id)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer">
                            <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                              {c.codigo_cita}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmtFecha(c.fecha)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {c.hora_inicio}–{c.hora_fin}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800 leading-tight">{c.paciente_nombre}</p>
                              <p className="text-xs text-slate-400">{c.tipo_documento}: {c.numero_documento}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.doctor_nombre}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{c.servicio_nombre}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold
                                                px-2.5 py-1 rounded-full border ${est.cls}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />
                                {est.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <IconBtn title="Ver detalles" onClick={() => verDetalle(c.cita_id)}
                                  className="text-slate-500 hover:bg-slate-100"><Eye size={15} /></IconBtn>
                                {['RESERVADA', 'CONFIRMADA'].includes(c.estado) && (
                                  <IconBtn title="Reprogramar" onClick={() => navigate(`/recepcion/citas/${c.cita_id}`, { state: { openReschedule: true } })}
                                    className="text-[#0059B3] hover:bg-blue-50"><CalendarClock size={15} /></IconBtn>
                                )}
                                {['RESERVADA', 'CONFIRMADA'].includes(c.estado) && (
                                  <IconBtn
                                    title="Cancelar cita"
                                    onClick={() => setCitaCancelar({ cita_id: c.cita_id, codigo_cita: c.codigo_cita })}
                                    className="text-red-500 hover:bg-red-50"
                                  >
                                    <Ban size={15} />
                                  </IconBtn>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {pages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center
                                  justify-between text-sm text-slate-500">
                    <span>{total} citas en total</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => fetchCitas(page - 1)} disabled={page <= 1}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40
                                   disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="font-medium text-slate-700">{page} / {pages}</span>
                      <button onClick={() => fetchCitas(page + 1)} disabled={page >= pages}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40
                                   disabled:cursor-not-allowed transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Modal de confirmación de cancelación */}
      <ModalCancelarCita
        open={!!citaCancelar}
        onClose={() => setCitaCancelar(null)}
        citaId={citaCancelar?.cita_id}
        codigoCita={citaCancelar?.codigo_cita}
        onSuccess={() => {
          setCitaCancelar(null);
          fetchCitas(page);  // refresca la página actual
        }}
      />
    </AppLayout>
  );
}

function IconBtn({ title, onClick, className = '', children }) {
  return (
    <button title={title} onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${className}`}>
      {children}
    </button>
  );
}
