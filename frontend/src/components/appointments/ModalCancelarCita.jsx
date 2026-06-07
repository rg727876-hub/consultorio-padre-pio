import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban, X, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

/**
 * ModalCancelarCita
 *
 * Props:
 *   open      {boolean}  – controla visibilidad
 *   onClose   {fn}       – cierra sin hacer nada
 *   citaId    {number}   – id de la cita a cancelar
 *   codigoCita {string}  – código legible para mostrar en el modal
 */
/**
 * onSuccess (opcional): callback invocado tras cancelar con éxito.
 * Si se omite, el modal redirige a /recepcion/citas (comportamiento de DetalleCita).
 * Si se provee (ej. GestionCitas), ejecuta ese fn en su lugar (ej. refrescar tabla).
 */
export default function ModalCancelarCita({ open, onClose, citaId, codigoCita, onSuccess }) {
  const navigate   = useNavigate();
  const [loading, setLoading] = useState(false);

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirmar = async () => {
    setLoading(true);
    try {
      await api.patch(`/appointments/${citaId}/cancel`);
      toast.success('Cita cancelada correctamente');
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/recepcion/citas');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ??
        'No se pudo cancelar la cita. Intente nuevamente.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    /*
     * Backdrop con blur — clic fuera cierra (si no está cargando)
     */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cancelar-titulo"
    >
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Panel del modal */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl
                      animate-[fadeSlideUp_0.2s_ease-out]">

        {/* Botón cerrar (esquina superior derecha) */}
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar modal"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400
                     hover:text-slate-600 hover:bg-slate-100 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X size={18} />
        </button>

        {/* Contenido */}
        <div className="p-6 pt-8 text-center">
          {/* Ícono de advertencia */}
          <div className="mx-auto mb-4 flex items-center justify-center
                          w-16 h-16 rounded-full bg-red-100">
            <AlertTriangle size={32} className="text-red-500" />
          </div>

          <h2
            id="modal-cancelar-titulo"
            className="text-lg font-bold text-slate-800 mb-1"
          >
            ¿Estás seguro de cancelar esta cita?
          </h2>

          {codigoCita && (
            <p className="text-sm text-slate-500 mb-1">
              Código:{' '}
              <span className="font-mono font-semibold text-slate-700">
                {codigoCita}
              </span>
            </p>
          )}

          <p className="text-sm text-slate-500 mt-2">
            Esta acción cambiará el estado a{' '}
            <span className="font-semibold text-red-600">CANCELADA</span>{' '}
            y no podrá deshacerse.
          </p>
        </div>

        {/* Separador */}
        <div className="border-t border-slate-100" />

        {/* Botones de acción */}
        <div className="flex gap-3 p-4">
          {/* Volver — solo cierra el modal */}
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-300
                       text-slate-700 text-sm font-semibold
                       hover:bg-slate-50 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Volver
          </button>

          {/* Confirmar cancelación — dispara el PATCH */}
          <button
            onClick={handleConfirmar}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-red-500 hover:bg-red-600 active:bg-red-700
                       text-white text-sm font-semibold transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Cancelando…
              </>
            ) : (
              <>
                <Ban size={16} />
                Confirmar cancelación
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
