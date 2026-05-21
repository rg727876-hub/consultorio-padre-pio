import { useState, useEffect } from 'react';
import { Loader2, ServerCrash, RefreshCw } from 'lucide-react';

export default function PageLoader({ loading, error, onRetry, children }) {
  const [slow, setSlow] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (!loading) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [loading]);

  // Auto-retry once after error (covers Render Free Tier cold-start timeout)
  useEffect(() => {
    if (!error || !onRetry || retried) return;
    const t = setTimeout(() => {
      setRetried(true);
      onRetry();
    }, 1500);
    return () => clearTimeout(t);
  }, [error, onRetry, retried]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-xs">
          <Loader2 size={36} className="animate-spin text-[#0059B3] mx-auto" />
          <p className="text-slate-600 font-medium text-sm">
            {slow ? 'El servidor está iniciando…' : 'Cargando…'}
          </p>
          {slow && (
            <p className="text-xs text-slate-400">
              El servidor tarda hasta 30 segundos en arrancar después de un período inactivo.
              Por favor espera.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-xs">
          <ServerCrash size={36} className="text-red-400 mx-auto" />
          <p className="text-slate-700 font-medium text-sm">
            No se pudo conectar con el servidor
          </p>
          {!retried && onRetry ? (
            <p className="text-xs text-slate-400">Reintentando automáticamente…</p>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                El servidor pudo no haber terminado de iniciar. Intenta de nuevo.
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                             text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw size={14} /> Reintentar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return children;
}
