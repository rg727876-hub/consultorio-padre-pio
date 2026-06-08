import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Utilidades de fecha ──────────────────────────────────────────
const hoy = () => new Date().toLocaleDateString('en-CA');

const agregarDias = (fechaStr, n) => {
  const d = new Date(fechaStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
};

const semanaDesde = (fechaStr) => {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  const dow = base.getDay();
  const lunes = new Date(base);
  lunes.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 6 }, (_, i) => {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + i);
    return dia.toLocaleDateString('en-CA');
  });
};

const fmtCorto = (fechaStr) => {
  if (!fechaStr) return '';
  const [y, m, d] = fechaStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
};

// ── Colores por tipo de slot ─────────────────────────────────────
const SLOT_STYLE = {
  DISPONIBLE: {
    bg: 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200',
    text: 'text-emerald-700',
  },
  OCUPADO: {
    bg: 'bg-blue-100 hover:bg-blue-200 border border-blue-300',
    text: 'text-blue-800',
  },
  BUFFER: {
    bg: 'bg-amber-50 hover:bg-amber-100 border border-amber-200',
    text: 'text-amber-600',
  },
  NO_LABORAL: {
    bg: 'bg-slate-50 border border-transparent',
    text: 'text-slate-300',
  },
  PASADO: {
    bg: 'bg-slate-50 border border-transparent opacity-40',
    text: 'text-slate-300',
  },
};

// ── Slot individual ──────────────────────────────────────────────
function Slot({ slot }) {
  const [hover, setHover] = useState(false);
  const s = SLOT_STYLE[slot.tipo] ?? SLOT_STYLE.NO_LABORAL;
  const tieneTooltip = slot.tipo === 'OCUPADO' && slot.cita;

  return (
    <div
      className={`relative rounded text-[10px] leading-none select-none
                  transition-colors duration-100 cursor-default
                  ${s.bg}`}
      style={{ minHeight: '26px', padding: '4px 5px' }}
      onMouseEnter={() => tieneTooltip && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className={`font-mono ${s.text}`}>{slot.hora_inicio}</span>

      {slot.tipo === 'OCUPADO' && slot.cita && (
        <p className="truncate text-blue-700 font-medium mt-0.5 leading-tight text-[10px]">
          {slot.cita.paciente_nombre?.split(' ')[0]}
        </p>
      )}

      {slot.tipo === 'BUFFER' && (
        <p className="text-amber-400 text-[9px] mt-0.5 italic">limpieza</p>
      )}

      {/* Tooltip al hacer hover sobre OCUPADO */}
      {tieneTooltip && hover && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
                     bg-slate-800 text-white text-[11px] rounded-xl shadow-2xl
                     px-3 py-2.5 w-52 pointer-events-none
                     animate-[fadeSlideUp_0.15s_ease-out]"
        >
          <p className="font-semibold truncate leading-tight">
            {slot.cita.paciente_nombre}
          </p>
          <p className="text-slate-300 text-[10px] truncate mt-0.5">
            {slot.cita.servicio_nombre}
          </p>
          <p className="text-slate-400 text-[10px] mt-1.5 font-mono">
            {slot.cita.hora_inicio_cita} – {slot.cita.hora_fin_con_buffer}
          </p>
          {/* Flechita inferior */}
          <div className="absolute top-full left-1/2 -translate-x-1/2
                          border-[5px] border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// ── Columna de una fecha ─────────────────────────────────────────
function ColumnaFecha({ fecha, slots, loading, horaInicioVis, horaFinVis }) {
  const visibles = (slots ?? []).filter(s => {
    const [h, m] = s.hora_inicio.split(':').map(Number);
    const mins = h * 60 + m;
    return mins >= horaInicioVis && mins < horaFinVis;
  });

  const esHoy = fecha === hoy();

  return (
    <div className="flex flex-col bg-white min-w-0">
      {/* Cabecera de fecha */}
      <div className={`text-center text-xs py-2 px-1 sticky top-0 z-10
                       border-b ${esHoy ? 'border-[#0059B3]/30 bg-[#0059B3]/5' : 'border-slate-100 bg-white'}`}>
        <span className={`font-semibold ${esHoy ? 'text-[#0059B3]' : 'text-slate-500'}`}>
          {fmtCorto(fecha)}
        </span>
        {esHoy && (
          <span className="block w-1.5 h-1.5 rounded-full bg-[#0059B3] mx-auto mt-1" />
        )}
      </div>

      {/* Slots */}
      <div className="flex flex-col gap-px p-1 overflow-y-auto" style={{ maxHeight: '65vh' }}>
        {loading
          ? Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="skeleton h-6 rounded" />
          ))
          : visibles.length === 0
            ? (
              <div className="py-6 text-center">
                <p className="text-[10px] text-slate-300">Sin horario</p>
              </div>
            )
            : visibles.map(s => <Slot key={s.hora_inicio} slot={s} />)
        }
      </div>
    </div>
  );
}

// ── Leyenda ───────────────────────────────────────────────────────
const LEYENDA = [
  { tipo: 'DISPONIBLE', label: 'Disponible', color: 'bg-emerald-200' },
  { tipo: 'OCUPADO', label: 'Ocupado', color: 'bg-blue-300' },
  { tipo: 'BUFFER', label: 'Buffer', color: 'bg-amber-200' },
  { tipo: 'NO_LABORAL', label: 'No laboral', color: 'bg-slate-200' },
  { tipo: 'PASADO', label: 'Pasado', color: 'bg-slate-100' },
];

function Leyenda() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      {LEYENDA.map(({ tipo, label, color }) => (
        <span key={tipo} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded border border-slate-200 ${color}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// GrillaDisponibilidad — componente presentacional puro
// Props:
//   doctorId     {string}  — ID del doctor (si vacío, muestra placeholder)
//   vista        {string}  — 'diaria' | 'semanal'
//   fecha        {string}  — YYYY-MM-DD ancla de la vista
//   grilla       {object}  — { [fecha]: slots[] } calculado por el padre
//   loading      {boolean} — muestra skeletons
//   onFechaChange {fn}     — callback al navegar con las flechas
// ══════════════════════════════════════════════════════════════════
export default function GrillaDisponibilidad({
  doctorId,
  vista,
  fecha,
  grilla,
  loading,
  onFechaChange,
}) {
  const fechas = vista === 'diaria' ? [fecha] : semanaDesde(fecha);

  // ── Rango de horas dinámico ──────────────────────────────────────
  // Recorre todos los slots de todas las fechas para encontrar la hora
  // más temprana y la más tardía, y así ajustar el eje Y automáticamente.
  const { horaInicioVis, horaFinVis } = (() => {
    const todosLosSlots = Object.values(grilla ?? {}).flat();
    if (todosLosSlots.length === 0) {
      return { horaInicioVis: 8 * 60, horaFinVis: 18 * 60 }; // default 08:00–18:00
    }

    let minMins = Infinity;
    let maxMins = -Infinity;

    for (const s of todosLosSlots) {
      const [hI, mI] = s.hora_inicio.split(':').map(Number);
      const inicioMins = hI * 60 + mI;
      minMins = Math.min(minMins, inicioMins);

      // Usar hora_fin si está disponible, si no sumar la duración al inicio
      if (s.hora_fin) {
        const [hF, mF] = s.hora_fin.split(':').map(Number);
        maxMins = Math.max(maxMins, hF * 60 + mF);
      } else {
        maxMins = Math.max(maxMins, inicioMins + (s.duracion_minutos ?? 30));
      }
    }

    return { horaInicioVis: minMins, horaFinVis: maxMins };
  })();

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

  const paso = vista === 'diaria' ? 1 : 7;
  const tituloNav = vista === 'diaria'
    ? fmtCorto(fecha)
    : `${fmtCorto(fechas[0])} – ${fmtCorto(fechas[fechas.length - 1])}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Barra de navegación de fechas */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <button
          onClick={() => onFechaChange(agregarDias(fecha, -paso))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Período anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <p className="text-sm font-semibold text-slate-700">{tituloNav}</p>

        <button
          onClick={() => onFechaChange(agregarDias(fecha, paso))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Período siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grid de columnas */}
      <div
        className="grid divide-x divide-slate-100 overflow-x-auto"
        style={{ gridTemplateColumns: `repeat(${fechas.length}, minmax(130px, 1fr))` }}
      >
        {fechas.map(f => (
          <ColumnaFecha
            key={f}
            fecha={f}
            slots={grilla[f] ?? []}
            loading={loading || !(f in grilla)}
            horaInicioVis={horaInicioVis}
            horaFinVis={horaFinVis}
          />
        ))}
      </div>

      {/* Leyenda */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
        <Leyenda />
      </div>
    </div>
  );
}
