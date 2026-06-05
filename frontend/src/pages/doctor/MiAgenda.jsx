import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarX2, AlertTriangle, Stethoscope, UserX, FileText, X,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';
import { ESTADOS, estadoInfo, fmtFecha } from '../recepcion/citaEstados';

const VISTAS = [
  { key: 'hoy',       label: 'Hoy' },
  { key: 'semana',    label: 'Esta semana' },
  { key: 'mes',       label: 'Este mes' },
  { key: 'historico', label: 'Histórico' },
];

// Estados que el doctor puede filtrar (sin RESERVADA)
const ESTADOS_FILTRO = ['CONFIRMADA', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA', 'EXPIRADA'];

export default function MiAgenda() {
  const navigate = useNavigate();

  const [citas,   setCitas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [vista,       setVista]       = useState('hoy');
  const [estado,      setEstado]      = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin,    setFechaFin]    = useState('');

  const [confirmar, setConfirmar] = useState(null); // cita a marcar no asistió
  const [saving,    setSaving]    = useState(false);

  const fetchAgenda = useCallback(async (overrides = {}) => {
    const f = { vista, estado, fechaInicio, fechaFin, ...overrides };
    setLoading(true);
    setError('');
    try {
      const params = { vista: f.vista };
      if (f.estado)      params.estado       = f.estado;
      if (f.fechaInicio) params.fecha_inicio = f.fechaInicio;
      if (f.fechaFin)    params.fecha_fin    = f.fechaFin;
      const { data } = await api.get('/appointments/agenda', { params });
      setCitas(data.data);
    } catch {
      setError('Error de conexión. Intente más tarde.');
      setCitas([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, estado, fechaInicio, fechaFin]);

  useEffect(() => { fetchAgenda(); /* eslint-disable-next-line */ }, []);

  const cambiarVista = (v) => {
    setVista(v);
    setFechaInicio(''); setFechaFin('');
    fetchAgenda({ vista: v, fechaInicio: '', fechaFin: '' });
  };

  const limpiarFiltros = () => {
    setEstado(''); setFechaInicio(''); setFechaFin('');
    fetchAgenda({ estado: '', fechaInicio: '', fechaFin: '' });
  };

  const atender    = (id)   => toast('El formulario de atención llega en INT-HU019.', { icon: '🩺' });
  const verAtencion = (id)  => toast('La vista de la consulta clínica llega en INT-HU019.', { icon: '📄' });

  const confirmarNoAsistio = async () => {
    if (!confirmar) return;
    setSaving(true);
    try {
      await api.put(`/appointments/${confirmar.cita_id}/no-asistio`);
      toast.success('Cita marcada como no asistió');
      setConfirmar(null);
      fetchAgenda();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo marcar la cita');
    } finally {
      setSaving(false);
    }
  };

  const hayFiltros = estado || fechaInicio || fechaFin;

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="mb-1">
            <h1 className="text-xl font-bold text-[#0059B3]">Mi agenda</h1>
            <p className="text-sm text-slate-500">Organiza tu jornada y revisa el flujo de pacientes</p>
          </div>

          {/* Tabs de vista */}
          <div className="flex flex-wrap gap-2">
            {VISTAS.map(v => (
              <button key={v.key} onClick={() => cambiarVista(v.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors
                            ${vista === v.key && !fechaInicio && !fechaFin
                              ? 'bg-[#0059B3] text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Filtros adicionales */}
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-xs font-medium text-slate-600">Estado</label>
                <select value={estado}
                  onChange={e => { setEstado(e.target.value); fetchAgenda({ estado: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40">
                  <option value="">Todos</option>
                  {ESTADOS_FILTRO.map(val => (
                    <option key={val} value={val}>{ESTADOS[val]?.label ?? val}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Desde</label>
                <input type="date" value={fechaInicio}
                  onChange={e => { setFechaInicio(e.target.value); fetchAgenda({ fechaInicio: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Hasta</label>
                <input type="date" value={fechaFin}
                  onChange={e => { setFechaFin(e.target.value); fetchAgenda({ fechaFin: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40" />
              </div>
              {hayFiltros && (
                <button onClick={limpiarFiltros}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium pb-2.5">
                  Limpiar filtros
                </button>
              )}
              {(fechaInicio || fechaFin) && (
                <span className="text-xs text-slate-400 pb-2.5">Rango personalizado activo</span>
              )}
            </div>
          </section>

          {/* Tabla / contenido */}
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {error ? (
              <div className="text-center py-16">
                <AlertTriangle size={36} className="mx-auto mb-2 text-amber-400" />
                <p className="text-sm text-slate-600">{error}</p>
                <button onClick={() => fetchAgenda()}
                  className="mt-3 text-[#0059B3] text-sm font-medium hover:underline">Reintentar</button>
              </div>
            ) : loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4">
                    <div className="skeleton h-4 w-24" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-40" /><div className="skeleton h-3 w-24" />
                    </div>
                    <div className="skeleton h-5 w-20 rounded-full" />
                    <div className="skeleton h-8 w-28 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : citas.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <CalendarX2 size={38} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No hay citas para mostrar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Código', 'Fecha', 'Hora', 'Paciente', 'Servicio', 'Estado', 'Acciones'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                                text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {citas.map(c => {
                      const est = estadoInfo(c.estado);
                      return (
                        <tr key={c.cita_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{c.codigo_cita}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{fmtFecha(c.fecha)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{c.hora_inicio}–{c.hora_fin}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 leading-tight">{c.paciente_nombre}</p>
                            <p className="text-xs text-slate-400">{c.tipo_documento}: {c.numero_documento}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">{c.servicio_nombre}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold
                                              px-2.5 py-1 rounded-full border ${est.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} /> {est.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Acciones cita={c}
                              onAtender={() => atender(c.cita_id)}
                              onVerAtencion={() => verAtencion(c.cita_id)}
                              onNoAsistio={() => setConfirmar(c)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Modal confirmar "No asistió" */}
      {confirmar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
             onClick={() => !saving && setConfirmar(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-fade-up"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800">Marcar inasistencia</p>
              <button onClick={() => setConfirmar(null)} disabled={saving}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600">¿Confirmar que el paciente no asistió?</p>
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
              <p className="font-medium text-slate-800">{confirmar.paciente_nombre}</p>
              <p className="text-xs text-slate-400">
                {confirmar.codigo_cita} · {fmtFecha(confirmar.fecha)} · {confirmar.hora_inicio}
              </p>
            </div>
            <p className="text-xs text-slate-400">El pago se mantiene como completado (no hay reembolso).</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmar(null)} disabled={saving}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-sm font-medium
                           text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={confirmarNoAsistio} disabled={saving}
                className="flex-1 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 disabled:opacity-60
                           text-white text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// Botones de acción según el estado de la cita
function Acciones({ cita, onAtender, onVerAtencion, onNoAsistio }) {
  if (cita.estado === 'CONFIRMADA') {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onAtender}
          className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99] text-white
                     text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <Stethoscope size={13} /> Atender
        </button>
        <button onClick={onNoAsistio} title="Marcar que el paciente no asistió"
          className="flex items-center gap-1.5 border border-slate-300 text-slate-600
                     hover:bg-slate-100 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <UserX size={13} /> No asistió
        </button>
      </div>
    );
  }
  if (cita.estado === 'ATENDIDA') {
    return (
      <button onClick={onVerAtencion}
        className="flex items-center gap-1.5 border border-[#0059B3] text-[#0059B3]
                   hover:bg-blue-50 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
        <FileText size={13} /> Ver atención
      </button>
    );
  }
  return <span className="text-xs text-slate-300">—</span>;
}
