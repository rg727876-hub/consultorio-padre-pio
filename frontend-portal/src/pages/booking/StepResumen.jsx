import { User, Stethoscope, UserRound, MapPin, CalendarDays, Wallet } from 'lucide-react';

const SEDE = 'Consultorio Padre Pio — Av. Ricardo Palma 679, Urb. Santo Dominguito 13007';

const fechaLarga = (fecha) =>
  new Date(`${fecha}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

function Row({ icon: Icon, image, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
        {image ? (
          <img src={`${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${image}`} alt={label} className="w-full h-full object-cover" />
        ) : (
          <Icon size={14} className="text-primary" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function StepResumen({ paciente, servicio, doctor, slot }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-slate-800 text-lg mb-1">Resumen de tu reserva</h2>
        <p className="text-sm text-slate-400">Verifica los datos antes de continuar con el pago.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-2">
        <Row icon={User}        image={paciente?.foto}   label="Paciente"    value={paciente.parentesco ? `${paciente.nombre} (${paciente.parentesco})` : paciente.nombre} />
        <Row icon={Stethoscope} image={servicio?.imagen} label="Especialidad" value={servicio.nombre} />
        <Row icon={UserRound}   image={doctor?.avatar}   label="Médico"       value={`Dr. ${doctor.apellido}, ${doctor.nombre}`} />
        <Row icon={MapPin}      label="Sede"         value={SEDE} />
        <Row icon={CalendarDays} label="Día y hora"  value={`${fechaLarga(slot.fecha)} · ${slot.hora_inicio}`} />
      </div>

      <div className="bg-primary/5 border border-primary/10 rounded-2xl px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <span className="text-sm font-semibold text-slate-700">Precio total</span>
        </div>
        <span className="text-lg font-black text-primary">S/ {Number(servicio.costo).toFixed(2)}</span>
      </div>
    </div>
  );
}
