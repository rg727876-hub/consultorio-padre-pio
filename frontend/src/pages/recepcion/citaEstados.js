// Estados de cita con su color/etiqueta distintivos (compartido entre vistas)
export const ESTADOS = {
  RESERVADA:  { label: 'Reservada',  cls: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400'  },
  CONFIRMADA: { label: 'Confirmada', cls: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-500'  },
  ATENDIDA:   { label: 'Atendida',   cls: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-500'   },
  CANCELADA:  { label: 'Cancelada',  cls: 'bg-red-100 text-red-700 border-red-200',         dot: 'bg-red-500'    },
  NO_ASISTIO: { label: 'No asistió', cls: 'bg-slate-200 text-slate-600 border-slate-300',   dot: 'bg-slate-500'  },
  EXPIRADA:   { label: 'Expirada',   cls: 'bg-slate-100 text-slate-400 border-slate-200',   dot: 'bg-slate-300'  },
};

export const estadoInfo = (estado) =>
  ESTADOS[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' };

// Estado del pago
export const PAGO_ESTADOS = {
  PENDIENTE:  { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  COMPLETADO: { label: 'Completado', cls: 'bg-green-100 text-green-700 border-green-200' },
  FALLIDO:    { label: 'Fallido',    cls: 'bg-red-100 text-red-700 border-red-200' },
};

// Estado de pago a MOSTRAR en la vista de una cita, combinando el pago real con
// el estado de la cita (el pago se crea recién al cobrar; no existe al reservar):
//  - Hay pago registrado          → su estado real (Completado / Pendiente / Fallido)
//  - Sin pago + RESERVADA         → "Sin pago" (todavía puede pagarse)
//  - Sin pago + CANCELADA/EXPIRADA/NO_ASISTIO → "No aplica"
// Si pagó y luego canceló, el pago sigue existiendo → se muestra "Completado"
// (regla de negocio: no hay reembolso).
export const pagoVista = (cita) => {
  const estadoPago = cita?.pago?.estado;
  if (estadoPago) return PAGO_ESTADOS[estadoPago] ?? PAGO_ESTADOS.PENDIENTE;
  if (['CANCELADA', 'EXPIRADA', 'NO_ASISTIO'].includes(cita?.estado))
    return { label: 'No aplica', cls: 'bg-slate-50 text-slate-400 border-slate-200' };
  return { label: 'Sin pago', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
};

export const fmtFecha = (d) => {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const fmtFechaHora = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
