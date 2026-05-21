import { Component } from 'react';
import { RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, errorMsg: '' };

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message ?? '' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  // Reset when the parent passes a new resetKey (e.g., route changed)
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMsg: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-xs">
            <p className="text-slate-700 font-semibold text-sm">Ocurrió un error inesperado</p>
            {this.state.errorMsg && (
              <p className="text-xs text-red-500 bg-white rounded px-3 py-2 text-left break-words">
                {this.state.errorMsg}
              </p>
            )}
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
