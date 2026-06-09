import { Search, X } from 'lucide-react';

// ── Vistas disponibles ────────────────────────────────────────────
const VISTAS = [
  { id: 'diaria',  label: 'Diaria'  },
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
];

export default function FiltrosAgenda({
  doctores,
  doctorId,
  especialidad,
  vista,
  onDoctorChange,
  onEspecialidadChange,
  onVistaChange,
  onBuscar,
  loading,
}) {
  // Especialidades únicas extraídas de la lista de doctores
  const especialidades = [...new Set(
    doctores.map(d => d.especialidad).filter(Boolean)
  )].sort();

  // Doctores filtrados por especialidad seleccionada
  const doctoresFiltrados = especialidad
    ? doctores.filter(d => d.especialidad === especialidad)
    : doctores;

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-3">

        {/* Selector de especialidad */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <label className="text-xs font-medium text-slate-600">Especialidad</label>
          <select
            value={especialidad}
            onChange={e => {
              onEspecialidadChange(e.target.value);
              onDoctorChange(''); // resetear doctor al cambiar especialidad
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
          >
            <option value="">Todas las especialidades</option>
            {especialidades.map(esp => (
              <option key={esp} value={esp}>{esp}</option>
            ))}
          </select>
        </div>

        {/* Selector de doctor */}
        <div className="flex flex-col gap-1 min-w-[220px]">
          <label className="text-xs font-medium text-slate-600">Doctor</label>
          <select
            value={doctorId}
            onChange={e => onDoctorChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
          >
            <option value="">— Selecciona un doctor —</option>
            {doctoresFiltrados.map(d => (
              <option key={d.doctor_id} value={d.doctor_id}>
                {d.nombre} {d.apellido}
                {d.especialidad ? ` · ${d.especialidad}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Botón buscar */}
        <button
          onClick={onBuscar}
          disabled={!doctorId || loading}
          className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99]
                     text-white text-sm font-semibold px-4 py-2 rounded-lg
                     transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Search size={14} />
          Ver disponibilidad
        </button>

        {/* Limpiar selección */}
        {doctorId && (
          <button
            onClick={() => { onDoctorChange(''); onEspecialidadChange(''); }}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium pb-2.5
                       flex items-center gap-1"
          >
            <X size={12} /> Limpiar
          </button>
        )}

        {/* Separador visual */}
        <div className="flex-1" />

        {/* Selector de vista */}
        <div className="flex items-center bg-slate-100 rounded-xl p-0.5 gap-0.5">
          {VISTAS.map(v => (
            <button
              key={v.id}
              onClick={() => onVistaChange(v.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors
                          ${vista === v.id
                            ? 'bg-white text-[#0059B3] shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}
