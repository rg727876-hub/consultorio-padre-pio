import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Utilidades ───────────────────────────────────────────────────
const hoy = () => new Date().toLocaleDateString('en-CA');

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const CABECERA_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ── Celda de un día del mes ──────────────────────────────────────
function CeldaDia({ dia, onSelect }) {
  if (!dia) return <div className="bg-slate-50/40" />;   // relleno previo al día 1

  const esHoy = dia.fecha === hoy();

  // Código de colores (CA4) coherente con la grilla diaria/semanal:
  //   no laboral → gris      | con citas → azul      | libre laboral → verde
  let estilo;
  if (!dia.es_laboral) {
    estilo = 'bg-slate-50 text-slate-300 cursor-default';
  } else if (dia.ocupados > 0) {
    estilo = 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800 cursor-pointer';
  } else {
    estilo = 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 cursor-pointer';
  }

  return (
    <button
      type="button"
      disabled={!dia.es_laboral}
      onClick={() => dia.es_laboral && onSelect(dia.fecha)}
      className={`relative flex flex-col items-start p-1.5 min-h-[68px] border rounded-lg
                  text-left transition-colors ${estilo}
                  ${esHoy ? 'ring-2 ring-[#0059B3] ring-offset-1' : 'border-transparent'}`}
    >
      <span className={`text-xs font-semibold ${esHoy ? 'text-[#0059B3]' : ''}`}>
        {dia.dia}
      </span>

      {dia.es_laboral && dia.ocupados > 0 && (
        <span className="mt-auto text-[10px] font-medium leading-tight">
          {dia.ocupados} {dia.ocupados === 1 ? 'cita' : 'citas'}
        </span>
      )}
      {dia.es_laboral && dia.ocupados === 0 && (
        <span className="mt-auto text-[10px] text-emerald-500 leading-tight">Libre</span>
      )}
    </button>
  );
}

// ── Leyenda ───────────────────────────────────────────────────────
const LEYENDA = [
  { label: 'Con citas', color: 'bg-blue-200' },
  { label: 'Libre',     color: 'bg-emerald-200' },
  { label: 'No laboral', color: 'bg-slate-200' },
];

// ══════════════════════════════════════════════════════════════════
// GrillaMensual — calendario mensual de la Agenda Médica
// Props:
//   doctorId    {string}  — si vacío, muestra placeholder
//   anio, mes   {number}  — mes mostrado (mes 1-12)
//   dias        {array}   — [{ fecha, dia, dia_semana, es_laboral, ocupados }]
//   loading     {boolean}
//   onNavegar   {fn}      — (delta:-1|1) cambiar de mes
//   onSelectDia {fn}      — (fecha) → abrir vista diaria de ese día
// ══════════════════════════════════════════════════════════════════
export default function GrillaMensual({
  doctorId, anio, mes, dias, loading, onNavegar, onSelectDia,
}) {
  if (!doctorId) {
    return (
      <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center
                      justify-center py-24 gap-3">
        <Calendar size={44} className="text-slate-200" />
        <p className="text-slate-400 text-sm text-center">
          Selecciona un doctor y haz clic en<br />
          <span className="font-semibold">Ver disponibilidad</span>
        </p>
      </div>
    );
  }

  // Offset del primer día (lunes = 0 … domingo = 6)
  const primerDow = dias.length
    ? (new Date(anio, mes - 1, 1).getDay() + 6) % 7
    : 0;
  const celdas = [...Array(primerDow).fill(null), ...dias];

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Navegación de mes */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <button
          onClick={() => onNavegar(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-slate-700">
          {NOMBRES_MES[mes - 1]} {anio}
        </p>
        <button
          onClick={() => onNavegar(1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Cabecera de días de la semana */}
      <div className="grid grid-cols-7 px-3 pt-3 gap-1">
        {CABECERA_DIAS.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-slate-400 pb-1">
            {d}
          </div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 gap-1 px-3 pb-3">
        {loading
          ? Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="skeleton min-h-[68px] rounded-lg" />
            ))
          : celdas.map((dia, i) => (
              <CeldaDia key={dia?.fecha ?? `pad-${i}`} dia={dia} onSelect={onSelectDia} />
            ))
        }
      </div>

      {/* Leyenda */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          {LEYENDA.map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded border border-slate-200 ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
