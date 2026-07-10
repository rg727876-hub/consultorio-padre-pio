import { CheckCircle2, Calendar } from 'lucide-react';

export default function StepExito({ resultado, onNuevaReserva }) {
  const r = resultado.resumen;
  return (
    <div className="flex flex-col items-center text-center py-6 space-y-5">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
        <CheckCircle2 size={32} className="text-accent" />
      </div>

      <div>
        <h2 className="font-display font-black text-slate-800 text-xl mb-1">{resultado.message}</h2>
        <p className="text-sm text-slate-400">Código de cita</p>
        <p className="text-2xl font-black text-primary tracking-widest">{resultado.codigo_cita}</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-left space-y-2">
        <p className="text-sm"><span className="text-slate-400">Servicio:</span> <span className="font-semibold text-slate-800">{r.servicio}</span></p>
        <p className="text-sm"><span className="text-slate-400">Médico:</span> <span className="font-semibold text-slate-800">{r.doctor}</span></p>
        <p className="text-sm"><span className="text-slate-400">Sede:</span> <span className="font-semibold text-slate-800">{r.sede}</span></p>
        <p className="text-sm"><span className="text-slate-400">Fecha y hora:</span> <span className="font-semibold text-slate-800">{r.fecha} · {r.hora}</span></p>
        <p className="text-sm"><span className="text-slate-400">Precio:</span> <span className="font-semibold text-slate-800">S/ {Number(r.precio).toFixed(2)}</span></p>
      </div>

      <p className="text-xs text-slate-400 max-w-sm">
        Te enviamos un correo con el detalle de tu cita y el comprobante de pago.
      </p>

      <button
        onClick={onNuevaReserva}
        className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold
                   px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
      >
        <Calendar size={15} /> Reservar otra cita
      </button>
    </div>
  );
}
