import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  ArrowLeft, BarChart2, Wallet, Stethoscope,
  Repeat, AlertTriangle, FileText, Sheet, ArrowUpDown,
  Users, PieChart as PieIcon, LineChart as LineIcon,
  LayoutDashboard, CreditCard, CalendarCheck, X, Lock, Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import AppLayout from '../../../components/AppLayout';
import api from '../../../api/axios';
import { exportarPDF, exportarExcel } from './exportReportes';

// ── Atajos de periodo ────────────────────────────────────────────
function getPeriodos() {
  const hoy = dayjs();
  return {
    mes_actual: {
      label: 'Mes actual',
      fecha_inicio: hoy.startOf('month').format('YYYY-MM-DD'),
      fecha_fin:    hoy.format('YYYY-MM-DD'),
    },
    ultimo_trimestre: {
      label: 'Último trimestre',
      fecha_inicio: hoy.subtract(3, 'month').format('YYYY-MM-DD'),
      fecha_fin:    hoy.format('YYYY-MM-DD'),
    },
    anio_actual: {
      label: 'Año actual',
      fecha_inicio: hoy.startOf('year').format('YYYY-MM-DD'),
      fecha_fin:    hoy.format('YYYY-MM-DD'),
    },
  };
}

const PEN = new Intl.NumberFormat('es-PE', {
  style: 'currency', currency: 'PEN', minimumFractionDigits: 2,
});

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50];

const PIE_COLORS = [
  '#0059B3', '#16a34a', '#9333ea', '#dc2626', '#f59e0b',
  '#0891b2', '#db2777', '#65a30d', '#7c3aed', '#ea580c',
];

const TABS = [
  { id: 'resumen',   label: 'Resumen',         icon: LayoutDashboard },
  { id: 'pacientes', label: 'Pacientes',       icon: Users },
  { id: 'ingresos',  label: 'Ingresos',        icon: CreditCard },
  { id: 'perdidas',  label: 'No concretadas',  icon: AlertTriangle },
  { id: 'citas',     label: 'Citas',           icon: CalendarCheck },
];

const fmtFecha = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '');

const fmtPeriodoEtiqueta = (p) => {
  if (!p) return '';
  return p.length === 10
    ? dayjs(p).format('DD/MM')
    : dayjs(`${p}-01`).format('MMM YY');
};

export default function DashboardReportes() {
  const navigate = useNavigate();
  const periodos = getPeriodos();

  const [activeTab,          setActiveTab]          = useState('resumen');
  const [fechaInicio,        setFechaInicio]        = useState(periodos.mes_actual.fecha_inicio);
  const [fechaFin,           setFechaFin]           = useState(periodos.mes_actual.fecha_fin);
  const [periodoActivo,      setPeriodoActivo]      = useState('mes_actual');
  const [resumen,            setResumen]            = useState(null);
  const [pagos,              setPagos]              = useState([]);
  const [perdidas,           setPerdidas]           = useState([]);
  const [nuevosPacientes,    setNuevosPacientes]    = useState([]);
  const [pacientesDetalle,   setPacientesDetalle]   = useState([]);
  const [citasPorServicio,   setCitasPorServicio]   = useState([]);
  const [ingresosMensuales,  setIngresosMensuales]  = useState([]);
  const [topDoctores,        setTopDoctores]        = useState([]);
  const [topPacientes,       setTopPacientes]       = useState([]);
  const [loading,            setLoading]            = useState(false);
  const [exporting,          setExporting]          = useState(null);

  // Estado del modal de drill-down (pie de Citas)
  const [drillServicio,      setDrillServicio]      = useState(null);
  const [drillCitas,         setDrillCitas]         = useState([]);
  const [drillLoading,       setDrillLoading]       = useState(false);

  const fetchTodo = async (inicio, fin) => {
    if (!inicio || !fin) {
      toast.error('Complete el rango de fechas para continuar.');
      return;
    }
    if (inicio > fin) {
      toast.error('Rango de fechas inválido. Verifique la información.');
      return;
    }

    setLoading(true);
    try {
      const params = { fecha_inicio: inicio, fecha_fin: fin };
      const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
        api.get('/reportes/resumen',            { params }),
        api.get('/reportes/pagos',              { params }),
        api.get('/reportes/perdidas',           { params }),
        api.get('/reportes/nuevos-pacientes',   { params }),
        api.get('/reportes/citas-por-servicio', { params }),
        api.get('/reportes/ingresos-mensuales', { params }),
        api.get('/reportes/pacientes-detalle',  { params }),
        api.get('/reportes/top-rankings',       { params }),
      ]);
      setResumen(r1.data);
      setPagos(r2.data.data);
      setPerdidas(r3.data.data);
      setNuevosPacientes(r4.data.data);
      setCitasPorServicio(r5.data.data);
      setIngresosMensuales(r6.data.data);
      setPacientesDetalle(r7.data.data);
      setTopDoctores(r8.data.top_doctores);
      setTopPacientes(r8.data.top_pacientes);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al consultar el reporte.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodo(fechaInicio, fechaFin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarPeriodo = (clave) => {
    const p = periodos[clave];
    setFechaInicio(p.fecha_inicio);
    setFechaFin(p.fecha_fin);
    setPeriodoActivo(clave);
    fetchTodo(p.fecha_inicio, p.fecha_fin);
  };

  const cambiarFechaInicio = (e) => {
    setFechaInicio(e.target.value);
    setPeriodoActivo(null);
  };

  const cambiarFechaFin = (e) => {
    setFechaFin(e.target.value);
    setPeriodoActivo(null);
  };

  // Drill-down: al hacer clic en un sector del pie de Citas
  const handlePieClick = async (payload) => {
    const servicio = payload?.servicio ?? payload?.name;
    if (!servicio) return;
    setDrillServicio(servicio);
    setDrillLoading(true);
    try {
      const { data } = await api.get('/reportes/citas-detalle', {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, servicio },
      });
      setDrillCitas(data.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al cargar el detalle del servicio.';
      toast.error(msg);
      setDrillCitas([]);
    } finally {
      setDrillLoading(false);
    }
  };

  const cerrarDrill = () => {
    setDrillServicio(null);
    setDrillCitas([]);
  };

  const handleExport = async (tipo) => {
    if (!resumen) return;
    setExporting(tipo);
    const t0 = performance.now();
    try {
      const payload = {
        filtros:  resumen.filtros,
        kpis:     resumen.kpis,
        pagos,
        perdidas,
        pacientes:            pacientesDetalle,
        topDoctores,
        topPacientes,
        metodosDistribucion,
      };
      if (tipo === 'pdf')   await exportarPDF(payload);
      if (tipo === 'excel') await exportarExcel(payload);
      const dur = Math.round(performance.now() - t0);
      toast.success(`Archivo generado en ${dur} ms`);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el archivo.');
    } finally {
      setExporting(null);
    }
  };

  const kpis = resumen?.kpis;

  const totalNuevosPacientes = useMemo(
    () => nuevosPacientes.reduce((acc, r) => acc + r.total, 0),
    [nuevosPacientes],
  );

  const promedioPorPago = useMemo(
    () => (pagos.length ? pagos.reduce((acc, p) => acc + Number(p.monto_total), 0) / pagos.length : 0),
    [pagos],
  );

  const metodosDistribucion = useMemo(() => {
    if (!pagos.length) return [];
    const conteo = {};
    pagos.forEach((p) => { conteo[p.metodo_pago] = (conteo[p.metodo_pago] || 0) + 1; });
    return Object.entries(conteo)
      .map(([metodo, total]) => ({ metodo, total }))
      .sort((a, b) => b.total - a.total);
  }, [pagos]);

  const metodoTop = metodosDistribucion[0] ?? null;

  const totalNoAsistio = useMemo(
    () => perdidas.filter((p) => p.motivo === 'NO_ASISTIO').length,
    [perdidas],
  );
  const totalCanceladas = useMemo(
    () => perdidas.filter((p) => p.motivo === 'CANCELADA').length,
    [perdidas],
  );

  const servicioTop = useMemo(
    () => (citasPorServicio.length ? citasPorServicio[0] : null),
    [citasPorServicio],
  );

  return (
    <AppLayout>
      <div className="px-4 py-8 max-w-7xl mx-auto w-full">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-[#0059B3] transition"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600
                          flex items-center justify-center">
            <BarChart2 size={20} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">Dashboard Financiero</h1>
            <p className="text-xs text-slate-500">
              Resumen de ingresos, atenciones y fidelización del periodo
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={!resumen || exporting !== null}
              className="flex items-center gap-2 bg-red-50 text-red-700 text-sm font-medium
                         px-3 py-2 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
            >
              <FileText size={16} />
              {exporting === 'pdf' ? 'Generando…' : 'Exportar PDF'}
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={!resumen || exporting !== null}
              className="flex items-center gap-2 bg-green-50 text-green-700 text-sm font-medium
                         px-3 py-2 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
            >
              <Sheet size={16} />
              {exporting === 'excel' ? 'Generando…' : 'Exportar Excel'}
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={cambiarFechaInicio}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#0059B3]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fecha de fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={cambiarFechaFin}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#0059B3]/20"
              />
            </div>
            <button
              onClick={() => fetchTodo(fechaInicio, fechaFin)}
              disabled={loading}
              className="bg-[#0059B3] text-white text-sm font-medium px-4 py-2 rounded-lg
                         hover:bg-[#004a96] transition disabled:opacity-60"
            >
              {loading ? 'Consultando…' : 'Consultar'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {Object.entries(periodos).map(([clave, p]) => {
              const active = periodoActivo === clave;
              return (
                <button
                  key={clave}
                  onClick={() => aplicarPeriodo(clave)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition
                              ${active
                                ? 'bg-[#0059B3] text-white shadow-sm'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-x-auto">
          <div className="flex border-b border-slate-100 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium
                              border-b-2 transition-colors
                              ${active
                                ? 'border-[#0059B3] text-[#0059B3] bg-blue-50/30'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenido por pestaña */}
        {activeTab === 'resumen' && (
          <TabResumen
            kpis={kpis}
            citasPorServicio={citasPorServicio}
            citasNoConcretadas={perdidas.length}
            topDoctores={topDoctores}
            topPacientes={topPacientes}
            metodosDistribucion={metodosDistribucion}
          />
        )}

        {activeTab === 'pacientes' && (
          <TabPacientes
            kpis={kpis}
            nuevosPacientes={nuevosPacientes}
            totalNuevos={totalNuevosPacientes}
            pacientesDetalle={pacientesDetalle}
          />
        )}

        {activeTab === 'ingresos' && (
          <TabIngresos
            kpis={kpis}
            ingresosMensuales={ingresosMensuales}
            pagos={pagos}
            promedioPorPago={promedioPorPago}
            metodoTop={metodoTop}
          />
        )}

        {activeTab === 'perdidas' && (
          <TabPerdidas
            kpis={kpis}
            perdidas={perdidas}
            totalNoAsistio={totalNoAsistio}
            totalCanceladas={totalCanceladas}
          />
        )}

        {activeTab === 'citas' && (
          <TabCitas
            kpis={kpis}
            citasPorServicio={citasPorServicio}
            servicioTop={servicioTop}
            onPieClick={handlePieClick}
          />
        )}

      </div>

      {/* Modal de drill-down (clic en sector del pie) */}
      {drillServicio && (
        <DrillDownModal
          servicio={drillServicio}
          citas={drillCitas}
          loading={drillLoading}
          onClose={cerrarDrill}
        />
      )}
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB: Resumen
// ─────────────────────────────────────────────────────────────────
function TabResumen({
  kpis, citasPorServicio, citasNoConcretadas,
  topDoctores, topPacientes, metodosDistribucion,
}) {
  const topServicios = citasPorServicio.slice(0, 3);
  const maxServicio  = topServicios[0]?.total ?? 1;
  const maxDoctor    = topDoctores[0]?.total ?? 1;
  const maxPaciente  = topPacientes[0]?.total ?? 1;
  const totalMetodos = metodosDistribucion.reduce((a, m) => a + m.total, 0);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Ingresos brutos"
          value={kpis ? PEN.format(kpis.total_ingresos_brutos) : null}
          icon={Wallet}
          colorClass="bg-green-50 text-green-700"
        />
        <KpiCard
          label="Citas atendidas"
          value={kpis ? kpis.citas_atendidas : null}
          icon={Stethoscope}
          colorClass="bg-blue-50 text-[#0059B3]"
        />
        <KpiCard
          label="Citas no concretadas"
          value={kpis ? citasNoConcretadas : null}
          icon={AlertTriangle}
          colorClass="bg-red-50 text-red-600"
          hint="No asistidas o canceladas"
        />
        <KpiCard
          label="Tasa de retorno"
          value={kpis ? `${kpis.tasa_retorno.porcentaje}%` : null}
          icon={Repeat}
          colorClass="bg-purple-50 text-purple-600"
          alert={kpis?.tasa_retorno.alerta}
          alertText={`Bajo el umbral del ${kpis?.tasa_retorno.umbral}%`}
          hint={kpis
            ? `${kpis.tasa_retorno.pacientes_recurrentes} de ${kpis.tasa_retorno.pacientes_atendidos} pacientes regresaron`
            : null}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard
          titulo="Top servicios solicitados"
          icon={Stethoscope}
          iconColor="bg-purple-50 text-purple-600"
          items={topServicios}
          getLabel={(r) => r.servicio}
          getTotal={(r) => r.total}
          maxValue={maxServicio}
          unidad="citas"
          emptyText="Sin citas registradas en el periodo."
        />

        <RankingCard
          titulo="Top doctores por atenciones"
          icon={Users}
          iconColor="bg-blue-50 text-[#0059B3]"
          items={topDoctores.slice(0, 3)}
          getLabel={(r) => r.doctor}
          getTotal={(r) => r.total}
          maxValue={maxDoctor}
          unidad="atenciones"
          emptyText="Sin atenciones registradas en el periodo."
        />

        <RankingCard
          titulo="Top pacientes recurrentes"
          icon={Repeat}
          iconColor="bg-cyan-50 text-cyan-700"
          items={topPacientes.slice(0, 3)}
          getLabel={(r) => r.paciente}
          getTotal={(r) => r.total}
          maxValue={maxPaciente}
          unidad="atenciones"
          emptyText="Sin pacientes recurrentes en el periodo."
        />

        <RankingCard
          titulo="Distribución de métodos de pago"
          icon={CreditCard}
          iconColor="bg-green-50 text-green-700"
          items={metodosDistribucion}
          getLabel={(r) => r.metodo}
          getTotal={(r) => r.total}
          maxValue={totalMetodos}
          unidad="pagos"
          percentBase={totalMetodos}
          emptyText="Sin pagos registrados en el periodo."
        />
      </div>
    </>
  );
}

// Card reutilizable para el "Top N" con barras de proporción
function RankingCard({
  titulo, icon: Icon, iconColor, items, getLabel, getTotal,
  maxValue, unidad, emptyText, percentBase,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={16} />
        </div>
        <h3 className="text-sm font-bold text-slate-800">{titulo}</h3>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-400">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => {
            const total   = getTotal(item);
            const ratio   = maxValue > 0 ? total / maxValue : 0;
            const percent = percentBase ? (total / percentBase) * 100 : null;
            return (
              <li key={i}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold
                                     rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-slate-700 truncate">{getLabel(item)}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 flex-shrink-0 ml-2">
                    {percent !== null ? `${percent.toFixed(0)}%` : `${total} ${unidad}`}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={iconColor.split(' ')[1].replace('text-', 'bg-')}
                    style={{ width: `${Math.max(ratio * 100, 4)}%`, height: '100%' }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB: Pacientes
// ─────────────────────────────────────────────────────────────────
function TabPacientes({ kpis, nuevosPacientes, totalNuevos, pacientesDetalle }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Pacientes nuevos del periodo"
          value={kpis ? totalNuevos : null}
          icon={Users}
          colorClass="bg-blue-50 text-[#0059B3]"
        />
        <KpiCard
          label="Pacientes atendidos"
          value={kpis ? kpis.tasa_retorno.pacientes_atendidos : null}
          icon={Stethoscope}
          colorClass="bg-cyan-50 text-cyan-700"
        />
        <KpiCard
          label="Tasa de retorno"
          value={kpis ? `${kpis.tasa_retorno.porcentaje}%` : null}
          icon={Repeat}
          colorClass="bg-purple-50 text-purple-600"
          alert={kpis?.tasa_retorno.alerta}
          alertText={`Bajo el umbral del ${kpis?.tasa_retorno.umbral}%`}
          hint={kpis
            ? `${kpis.tasa_retorno.pacientes_recurrentes} de ${kpis.tasa_retorno.pacientes_atendidos} regresaron`
            : null}
        />
      </div>

      <ChartCard
        titulo="Evolución de nuevos pacientes registrados"
        icon={LineIcon}
        iconColor="bg-blue-50 text-[#0059B3]"
        empty={nuevosPacientes.length === 0}
        className="mb-6"
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={nuevosPacientes} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="periodo" stroke="#94a3b8" fontSize={11} tickFormatter={fmtPeriodoEtiqueta} />
            <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelFormatter={fmtPeriodoEtiqueta}
              formatter={(v) => [`${v} pacientes`, 'Registrados']}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#0059B3"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#0059B3' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <SortableTable
        titulo={`Detalle de pacientes registrados (${pacientesDetalle.length})`}
        emptyText="No se encontraron pacientes registrados en el período seleccionado."
        columnas={[
          { key: 'fecha_registro',   label: 'Fecha',    render: (r) => fmtFecha(r.fecha_registro) },
          { key: 'paciente',         label: 'Paciente' },
          { key: 'numero_documento', label: 'Documento',
            render: (r) => `${r.tipo_documento} ${r.numero_documento}` },
          { key: 'telefono',         label: 'Teléfono' },
          { key: 'sexo',             label: 'Sexo' },
          { key: 'estado_cuenta',    label: 'Cuenta web',
            render: (r) => <EstadoCuentaBadge estado={r.estado_cuenta} /> },
        ]}
        data={pacientesDetalle}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB: Ingresos
// ─────────────────────────────────────────────────────────────────
function TabIngresos({ kpis, ingresosMensuales, pagos, promedioPorPago, metodoTop }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total ingresos brutos"
          value={kpis ? PEN.format(kpis.total_ingresos_brutos) : null}
          icon={Wallet}
          colorClass="bg-green-50 text-green-700"
        />
        <KpiCard
          label="Cantidad de pagos"
          value={kpis ? pagos.length : null}
          icon={CreditCard}
          colorClass="bg-blue-50 text-[#0059B3]"
        />
        <KpiCard
          label="Promedio por pago"
          value={kpis ? PEN.format(promedioPorPago) : null}
          icon={LineIcon}
          colorClass="bg-cyan-50 text-cyan-700"
        />
        <KpiCard
          label="Método más usado"
          value={kpis ? (metodoTop?.metodo ?? '—') : null}
          icon={Repeat}
          colorClass="bg-purple-50 text-purple-600"
          hint={metodoTop ? `${metodoTop.total} pagos` : null}
        />
      </div>

      <ChartCard
        titulo="Evolución de ingresos"
        icon={LineIcon}
        iconColor="bg-green-50 text-green-700"
        empty={ingresosMensuales.length === 0}
        className="mb-6"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={ingresosMensuales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="periodo" stroke="#94a3b8" fontSize={11} tickFormatter={fmtPeriodoEtiqueta} />
            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `S/ ${v}`} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelFormatter={fmtPeriodoEtiqueta}
              formatter={(v) => [PEN.format(v), 'Ingresos']}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#16a34a"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#16a34a' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <SortableTable
        titulo={`Detalle de pagos (${pagos.length})`}
        emptyText="No se encontraron registros financieros en el período seleccionado."
        columnas={[
          { key: 'fecha_pago',  label: 'Fecha',    render: (r) => fmtFecha(r.fecha_pago) },
          { key: 'paciente',    label: 'Paciente' },
          { key: 'servicio',    label: 'Servicio' },
          { key: 'monto_total', label: 'Monto',    render: (r) => PEN.format(Number(r.monto_total)), align: 'right', numeric: true },
          { key: 'metodo_pago', label: 'Método' },
        ]}
        data={pagos}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB: Pérdidas / No concretadas
// ─────────────────────────────────────────────────────────────────
function TabPerdidas({ kpis, perdidas, totalNoAsistio, totalCanceladas }) {
  const totalNoConcretadas = perdidas.length;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Citas no concretadas"
          value={kpis ? totalNoConcretadas : null}
          icon={AlertTriangle}
          colorClass="bg-red-50 text-red-600"
          hint="Total del periodo"
        />
        <KpiCard
          label="Citas no asistidas"
          value={kpis ? totalNoAsistio : null}
          icon={AlertTriangle}
          colorClass="bg-amber-50 text-amber-700"
        />
        <KpiCard
          label="Citas canceladas"
          value={kpis ? totalCanceladas : null}
          icon={AlertTriangle}
          colorClass="bg-red-50 text-red-700"
        />
      </div>

      <SortableTable
        titulo={`Detalle de citas no concretadas (${perdidas.length})`}
        emptyText="No se encontraron citas no concretadas en el período seleccionado."
        headerColor="bg-red-50 text-red-700"
        columnas={[
          { key: 'fecha',    label: 'Fecha',    render: (r) => fmtFecha(r.fecha) },
          { key: 'paciente', label: 'Paciente' },
          { key: 'servicio', label: 'Servicio' },
          { key: 'doctor',   label: 'Doctor' },
          { key: 'monto',    label: 'Precio del servicio',
            render: (r) => PEN.format(Number(r.monto)), align: 'right', numeric: true },
          { key: 'motivo',   label: 'Motivo',  render: (r) => <MotivoBadge motivo={r.motivo} /> },
        ]}
        data={perdidas}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// TAB: Citas
// ─────────────────────────────────────────────────────────────────
function TabCitas({ kpis, citasPorServicio, servicioTop, onPieClick }) {
  const totalCitas = citasPorServicio.reduce((acc, c) => acc + c.total, 0);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Citas atendidas"
          value={kpis ? kpis.citas_atendidas : null}
          icon={Stethoscope}
          colorClass="bg-blue-50 text-[#0059B3]"
        />
        <KpiCard
          label="Total de citas en el periodo"
          value={kpis ? totalCitas : null}
          icon={CalendarCheck}
          colorClass="bg-cyan-50 text-cyan-700"
          hint="Excluye expiradas"
        />
        <KpiCard
          label="Servicio más solicitado"
          value={kpis ? (servicioTop?.servicio ?? '—') : null}
          icon={Stethoscope}
          colorClass="bg-purple-50 text-purple-600"
          hint={servicioTop ? `${servicioTop.total} citas` : null}
        />
      </div>

      <ChartCard
        titulo="Distribución de citas por servicio"
        icon={PieIcon}
        iconColor="bg-purple-50 text-purple-600"
        empty={citasPorServicio.length === 0}
      >
        <p className="text-[11px] text-slate-400 mb-3 text-center italic">
          Tip: haz clic en cualquier sector del gráfico para ver el detalle de las citas
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Pie
              data={citasPorServicio}
              dataKey="total"
              nameKey="servicio"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}
              cursor="pointer"
              onClick={(_, idx) => onPieClick && onPieClick(citasPorServicio[idx])}
            >
              {citasPorServicio.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v, n) => [`${v} citas`, n]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Componentes reutilizables
// ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, colorClass, alert, alertText, hint }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-5 border
                     ${alert ? 'border-amber-300' : 'border-transparent'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon size={20} />
        </div>
        {alert && (
          <span className="flex items-center gap-1 text-[10px] font-semibold
                           bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            <AlertTriangle size={11} />
            Alerta
          </span>
        )}
      </div>
      {value === null || value === undefined
        ? <div className="skeleton h-7 w-24" />
        : <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>}
      <p className="text-xs text-slate-500 mt-2">{label}</p>
      {alert && <p className="text-[11px] text-amber-700 mt-1">{alertText}</p>}
      {!alert && hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ChartCard({ titulo, icon: Icon, iconColor, empty, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={16} />
        </div>
        <h3 className="text-sm font-bold text-slate-800">{titulo}</h3>
      </div>
      {empty ? (
        <p className="py-12 text-center text-xs text-slate-400">
          No hay datos suficientes para mostrar este gráfico en el periodo seleccionado.
        </p>
      ) : children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modal de drill-down: muestra las citas de un servicio en el periodo.
// Se abre al hacer clic en un sector del pie chart.
// ─────────────────────────────────────────────────────────────────
function DrillDownModal({ servicio, citas, loading, onClose }) {
  const totalMonto = citas.reduce((acc, c) => acc + Number(c.monto || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Detalle del servicio
            </p>
            <h2 className="text-lg font-bold text-slate-800">{servicio}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Cargando…' : `${citas.length} citas registradas`}
              {!loading && citas.length > 0 && ` · Total facturable ${PEN.format(totalMonto)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : citas.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">
              No hay citas registradas para este servicio en el periodo.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Código</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Paciente</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Doctor</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {citas.map((c) => (
                  <tr key={c.cita_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-700">{fmtFecha(c.fecha)}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{c.codigo_cita}</td>
                    <td className="px-4 py-2.5 text-slate-700">{c.paciente}</td>
                    <td className="px-4 py-2.5 text-slate-700">{c.doctor}</td>
                    <td className="px-4 py-2.5"><EstadoCitaBadge estado={c.estado} /></td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{PEN.format(Number(c.monto))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm font-medium text-slate-700 px-4 py-2 rounded-lg
                       hover:bg-slate-100 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function EstadoCitaBadge({ estado }) {
  const map = {
    RESERVADA:  'bg-yellow-50 text-yellow-700',
    CONFIRMADA: 'bg-green-50 text-green-700',
    ATENDIDA:   'bg-blue-50 text-blue-700',
    CANCELADA:  'bg-red-50 text-red-700',
    NO_ASISTIO: 'bg-slate-100 text-slate-600',
    EXPIRADA:   'bg-slate-50 text-slate-400',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[estado] || 'bg-slate-100 text-slate-600'}`}>
      {estado}
    </span>
  );
}

function MotivoBadge({ motivo }) {
  const styles = motivo === 'NO_ASISTIO'
    ? 'bg-slate-100 text-slate-600'
    : 'bg-red-50 text-red-700';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles}`}>
      {motivo}
    </span>
  );
}

function EstadoCuentaBadge({ estado }) {
  const map = {
    ACTIVO:      'bg-green-50 text-green-700',
    SIN_CUENTA:  'bg-slate-100 text-slate-600',
    FAMILIAR:    'bg-blue-50 text-[#0059B3]',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                      ${map[estado] || 'bg-slate-100 text-slate-600'}`}>
      {estado}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tabla ordenable con paginación cliente + selector de tamaño
// ─────────────────────────────────────────────────────────────────
function SortableTable({ titulo, tituloExtra, columnas, data, emptyText, headerColor }) {
  const [sortKey,  setSortKey]  = useState(null);
  const [sortDir,  setSortDir]  = useState('asc');
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columnas.find((c) => c.key === sortKey);
    return [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = col?.numeric
        ? Number(va) - Number(vb)
        : String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columnas]);

  const totalPaginas = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated    = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [data, sortKey, sortDir, pageSize]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>
        {tituloExtra && (
          <span className="text-xs font-medium text-slate-500">{tituloExtra}</span>
        )}
      </div>

      {data.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">{emptyText}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={`${headerColor || 'bg-slate-50 text-slate-600'}`}>
                <tr>
                  {columnas.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => toggleSort(c.key)}
                      className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider
                                  cursor-pointer select-none
                                  ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        <ArrowUpDown size={11} className="opacity-40" />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    {columnas.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2.5 text-slate-700
                                    ${c.align === 'right' ? 'text-right' : ''}`}
                      >
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3
                          border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span>
                Mostrando {(page - 1) * pageSize + 1} – {Math.min(page * pageSize, sorted.length)} de {sorted.length}
              </span>
              <label className="flex items-center gap-1.5">
                Filas:
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="border border-slate-200 rounded-md px-2 py-0.5 text-xs
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/20"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-md bg-slate-50 hover:bg-slate-100
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-2 py-1 font-medium text-slate-700">
                {page} / {totalPaginas}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
                disabled={page === totalPaginas}
                className="px-3 py-1 rounded-md bg-slate-50 hover:bg-slate-100
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
