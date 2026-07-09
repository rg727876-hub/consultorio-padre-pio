import { X } from 'lucide-react';

// Ventana flotante para completar el pago — header azul con logo de la
// clínica para tarjeta, morado (color de marca de Yape) para Yape.
export default function PaymentModal({ metodo, onClose, children }) {
  const isYape = metodo === 'yape';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl
                      flex flex-col max-h-[92vh] overflow-hidden">
        <div className={`flex items-center justify-between px-5 py-4 shrink-0
                          ${isYape ? 'bg-[#6d2eb3]' : 'bg-primary'}`}>
          <div className="flex items-center gap-2.5">
            <img
              src="/ICONOCLINICA.svg" alt="Padre Pio"
              className="h-8 w-8 rounded-full bg-white p-1 object-contain"
            />
            <div>
              <p className="text-white font-bold text-sm leading-tight">Consultorio Padre Pio</p>
              {isYape && <p className="text-white/80 text-[11px] leading-tight">Pago con Yape</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1">
            <X size={19} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
