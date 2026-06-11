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
  servicios,
  servicioId,
  vista,
  onDoctorChange,
  onServicioChange,
  onVistaChange,
  onBuscar,
  loading,
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-3">

        {/* Selector de servicio */}
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-600">Servicio</label>
          <select
            value={servicioId}
            onChange={e => {
              onServicioChange(e.target.value);
              onDoctorChange(''); // resetear doctor al cambiar servicio
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
          >
            <option value="">Todos los servicios</option>
            {(servicios ?? []).map(s => (
              <option key={s.servicio_id} value={s.servicio_id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        {/* Selector de doctor (filtrado por el servicio elegido) */}
        <div className="flex flex-col gap-1 min-w-[220px]">
          <label className="text-xs font-medium text-slate-600">Doctor</label>
          <select
            value={doctorId}
            onChange={e => onDoctorChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
          >
            <option value="">
              {servicioId && doctores.length === 0
                ? '— Ningún doctor atiende este servicio —'
                : '— Selecciona un doctor —'}
            </option>
            {doctores.map(d => (
              <option key={d.doctor_id} value={d.doctor_id}>
                {d.nombre} {d.apellido}
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
            onClick={() => { onDoctorChange(''); onServicioChange(''); }}
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
