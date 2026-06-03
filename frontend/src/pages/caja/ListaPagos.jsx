import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Receipt, Search, Loader2, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

const fmt    = (n) => `S/ ${Number(n).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-PE', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '—';

const METODO_LABEL = {
  EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin',
  TARJETA_PRESENCIAL: 'Tarjeta', TARJETA_ONLINE: 'Tarjeta online',
};

export default function ListaPagos() {
  const navigate = useNavigate();

  const [pagos,   setPagos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [total,   setTotal]   = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin,    setFechaFin]    = useState('');

  const fetchPagos = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p };
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin)    params.fecha_fin    = fechaFin;
      const { data } = await api.get('/payments', { params });
      setPagos(data.data);
      setPages(data.pages);
      setTotal(data.total);
      setPage(p);
    } catch {
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => { fetchPagos(1); }, [fetchPagos]);

  const handleSearch = () => fetchPagos(1);

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="mb-2">
            <h1 className="text-xl font-bold text-[#0059B3]">Pagos confirmados</h1>
            <p className="text-sm text-slate-500">
              Gestiona y genera comprobantes para los pagos registrados
            </p>
          </div>

          {/* Filtros */}
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Desde</label>
                <input
                  type="date"
                  value={fechaInicio}
                  max={today}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Hasta</label>
                <input
                  type="date"
                  value={fechaFin}
                  max={today}
                  onChange={e => setFechaFin(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                />
              </div>
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99]
                           text-white text-sm font-semibold px-4 py-2 rounded-lg
                           transition-colors"
              >
                <Search size={14} /> Buscar
              </button>
              {(fechaInicio || fechaFin) && (
                <button
                  onClick={() => { setFechaInicio(''); setFechaFin(''); }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </section>

          {/* Tabla */}
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-[#0059B3]" />
              </div>
            ) : pagos.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <FileText size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No se encontraron pagos con esos criterios.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Fecha pago', 'Paciente', 'Servicio', 'Método', 'Monto', 'Comprobante', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                                  text-slate-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagos.map(p => (
                        <tr key={p.pago_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {fmtDate(p.fecha_pago)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800 leading-tight">
                              {p.paciente_nombre}
                            </p>
                            <p className="text-xs text-slate-400">{p.tipo_documento}: {p.numero_documento}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">
                            {p.servicio_nombre}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5
                                             rounded-full font-medium">
                              {METODO_LABEL[p.metodo_pago] ?? p.metodo_pago}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-[#0059B3] whitespace-nowrap">
                            {fmt(p.monto_total)}
                          </td>
                          <td className="px-4 py-3">
                            <EstadoComprobante pago={p} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => navigate(`/caja/comprobantes/nuevo?pago_id=${p.pago_id}`)}
                              className={`flex items-center gap-1.5 text-xs font-semibold
                                          px-3 py-1.5 rounded-lg transition-colors
                                          ${p.comprobante_id
                                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            : 'bg-[#0059B3] text-white hover:bg-[#004a99]'}`}
                            >
                              {p.comprobante_id
                                ? <><Receipt size={12} /> Ver</>
                                : <><FileText size={12} /> Generar</>}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {pages > 1 && (
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center
                                  justify-between text-sm text-slate-500">
                    <span>{total} pagos en total</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchPagos(page - 1)}
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
                        onClick={() => fetchPagos(page + 1)}
                        disabled={page >= pages}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40
                                   disabled:cursor-not-allowed transition-colors"
                      >
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
    </AppLayout>
  );
}

function EstadoComprobante({ pago }) {
  if (pago.comprobante_id) {
    const label = pago.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Boleta';
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 size={14} className="text-[#8BC63F] flex-shrink-0" />
        <div className="leading-tight">
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          <p className="text-[10px] font-mono text-slate-400">
            {pago.serie}-{pago.numero}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
      <span className="text-xs text-amber-600 font-medium">Pendiente</span>
    </div>
  );
}
