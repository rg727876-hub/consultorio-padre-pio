import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Ventana flotante reutilizable (overlay + tarjeta centrada, cierra con backdrop/Escape)
export default function Modal({ onClose, children, maxW = 'max-w-3xl' }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${maxW} my-6 relative animate-fade-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          title="Cerrar"
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-slate-100
                     text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
