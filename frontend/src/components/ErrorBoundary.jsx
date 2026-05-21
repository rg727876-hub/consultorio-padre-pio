import { Component } from 'react';
import { RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-xs">
            <p className="text-slate-700 font-semibold text-sm">Ocurrió un error inesperado</p>
            <p className="text-xs text-slate-400">
              Por favor recarga la página. Si el problema persiste, contacta soporte.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                         text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw size={14} /> Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
