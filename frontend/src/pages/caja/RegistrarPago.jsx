import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Loader2, CreditCard, Banknote, Smartphone,
  CheckCircle2, Check, RefreshCw, X, FileText,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

const METODOS = [
  { value: 'EFECTIVO',          label: 'Efectivo',  icon: Banknote    },
  { value: 'YAPE',              label: 'Yape',      icon: Smartphone  },
  { value: 'PLIN',              label: 'Plin',      icon: Smartphone  },
  { value: 'TARJETA_PRESENCIAL',label: 'Tarjeta',   icon: CreditCard  },
];

const MARCAS = ['VISA', 'MASTERCARD', 'AMEX', 'DINERS'];

const fmt = (n) => `S/ ${Number(n).toFixed(2)}`;

export default function RegistrarPago() {
  const navigate = useNavigate();

  // ── Búsqueda ─────────────────────────────────────────────────
  const [busqueda, setBusqueda]         = useState('');
  const [buscando, setBuscando]         = useState(false);
  const [resultados, setResultados]     = useState([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [cita, setCita]                 = useState(null);

  // ── Pago ─────────────────────────────────────────────────────
  const [metodo, setMetodo]             = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [numeroOperacion, setNumeroOperacion] = useState('');
  const [ultimos4, setUltimos4]         = useState('');
  const [marcaTarjeta, setMarcaTarjeta] = useState('');
  const [formErrors, setFormErrors]     = useState({});

  // ── Submit ───────────────────────────────────────────────────
  const [loading, setLoading]           = useState(false);
  const [serverError, setServerError]   = useState('');
  const [confirmado, setConfirmado]     = useState(null);

  // ── Helpers ───────────────────────────────────────────────────
  const cambio = metodo === 'EFECTIVO' && montoRecibido
    ? Math.max(0, Number(montoRecibido) - Number(cita?.precio_aplicado ?? 0))
    : 0;

  const resetPago = () => {
    setMetodo(''); setMontoRecibido(''); setNumeroOperacion('');
    setUltimos4(''); setMarcaTarjeta('');
    setFormErrors({}); setServerError('');
  };

  const resetCita = () => {
    setCita(null); setResultados([]); setBusqueda('');
    setSinResultados(false); resetPago(); setConfirmado(null);
  };

  const volverABusqueda = () => {
    setCita(null);
    resetPago();
    setConfirmado(null);
  };

  const resetAll = () => {
    resetCita(); setConfirmado(null);
  };

  // ── Buscar cita ───────────────────────────────────────────────
  const handleSearch = async () => {
    if (busqueda.trim().length < 2) return;
    setBuscando(true); setSinResultados(false); setResultados([]);
    try {
      const { data } = await api.get('/payments/search-appointment', {
        params: { q: busqueda.trim() },
      });
      if (data.length === 0) setSinResultados(true);
      setResultados(data);
    } catch {
      toast.error('Error al buscar la cita');
    } finally {
      setBuscando(false);
    }
  };

  const selectCita = (c) => {
    setCita(c);
    setSinResultados(false);
    resetPago();
  };

  // ── Validar pago ─────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!metodo) { e.metodo = 'Selecciona un método de pago'; }

    if (metodo === 'EFECTIVO') {
      const rec = Number(montoRecibido);
      if (!montoRecibido || rec <= 0)
        e.montoRecibido = 'Ingresa el monto recibido';
      else if (rec < Number(cita.precio_aplicado))
        e.montoRecibido = `Monto insuficiente. Total a cobrar: ${fmt(cita.precio_aplicado)}`;
    }

    if (['YAPE', 'PLIN'].includes(metodo)) {
      const num = numeroOperacion.trim();
      if (!num) e.numeroOperacion = 'Ingresa el número de operación';
      else if (!/^\d{6,8}$/.test(num)) e.numeroOperacion = 'Debe tener entre 6 y 8 dígitos';
    }

    if (metodo === 'TARJETA_PRESENCIAL') {
      if (!/^\d{4}$/.test(ultimos4)) e.ultimos4 = 'Ingresa los últimos 4 dígitos';
      if (!marcaTarjeta)              e.marcaTarjeta = 'Selecciona la marca';
    }

    return e;
  };

  // ── Registrar pago ────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setLoading(true); setServerError('');
    try {
      const payload = {
        cita_id:     cita.cita_id,
        metodo_pago: metodo,
        monto_total: Number(cita.precio_aplicado),
      };
      if (metodo === 'EFECTIVO')
        payload.cambio = cambio;
      if (['YAPE', 'PLIN'].includes(metodo) && numeroOperacion.trim())
        payload.numero_operacion = numeroOperacion.trim();
      if (metodo === 'TARJETA_PRESENCIAL') {
        payload.ultimos_4_tarjeta = ultimos4;
        payload.marca_tarjeta     = marcaTarjeta;
      }

      const { data } = await api.post('/payments', payload);
      setConfirmado({ pago_id: data.pago_id, codigo_cita: data.codigo_cita });
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar el pago';
      setServerError(msg);
      if (err.response?.status === 409) {
        toast.error(msg);
        resetCita();
      }
    } finally {
      setLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="mb-2">
            <h1 className="text-xl font-bold text-[#0059B3]">Registrar pago</h1>
            <p className="text-sm text-slate-500">
              Busca la cita reservada y procesa el cobro para confirmarla
            </p>
          </div>

          {/* ── Panel de confirmación exitosa ── */}
          {confirmado ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center
                              mx-auto">
                <CheckCircle2 size={36} className="text-[#8BC63F]" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">¡Pago registrado!</p>
                <p className="text-sm text-slate-500 mt-1">La cita ha sido confirmada exitosamente</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-6 py-4 text-sm space-y-2 text-left
                              max-w-xs mx-auto">
                <InfoRow label="Código de cita" value={confirmado.codigo_cita} mono />
                <InfoRow label="N° de pago"     value={`#${confirmado.pago_id}`} />
                <InfoRow label="Monto cobrado"  value={fmt(cita.precio_aplicado)} />
                <InfoRow label="Método"         value={METODOS.find(m => m.value === metodo)?.label} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => navigate(`/caja/comprobantes/nuevo?pago_id=${confirmado.pago_id}`)}
                  className="inline-flex items-center gap-2 bg-[#8BC63F] hover:bg-[#78ae35]
                             text-white text-sm font-semibold px-5 py-2.5 rounded-lg
                             transition-colors"
                >
                  <FileText size={15} /> Generar comprobante
                </button>
                <button
                  onClick={resetAll}
                  className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                             text-white text-sm font-semibold px-5 py-2.5 rounded-lg
                             transition-colors"
                >
                  <RefreshCw size={15} /> Registrar otro pago
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Paso 1: Buscar cita ── */}
              <section className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-6 h-6 rounded-full text-white text-xs font-bold
                                   flex items-center justify-center flex-shrink-0
                                   ${cita ? 'bg-[#8BC63F]' : 'bg-[#0059B3]'}`}>
                    {cita ? <Check size={12} /> : '1'}
                  </span>
                  <p className="text-sm font-semibold text-slate-700">Buscar cita</p>
                  {cita && (
                    <span className="ml-auto text-[10px] text-[#8BC63F] font-semibold">
                      Seleccionada
                    </span>
                  )}
                </div>

                {cita ? (
                  <CitaCard cita={cita} onCambiar={volverABusqueda} />
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={busqueda}
                        onChange={e => { setBusqueda(e.target.value); setSinResultados(false); }}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Código de cita, nombre o documento del paciente"
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={buscando || busqueda.trim().length < 2}
                        className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99]
                                   disabled:opacity-50 text-white text-sm font-medium
                                   px-3 py-2 rounded-lg transition-colors"
                      >
                        {buscando
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Search size={14} />}
                        Buscar
                      </button>
                    </div>

                    {resultados.length > 0 && (
                      <ul className="mt-1 border border-slate-200 rounded-xl divide-y overflow-hidden">
                        {resultados.map(c => (
                          <li key={c.cita_id}>
                            <button
                              onClick={() => selectCita(c)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {c.paciente_nombre}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {c.servicio_nombre} · {c.doctor_nombre}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {new Date(c.fecha.split('T')[0] + 'T00:00:00').toLocaleDateString('es-PE', {
                                      weekday: 'short', day: 'numeric', month: 'short',
                                    })} · {c.hora_inicio}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-bold text-[#0059B3]">
                                    {fmt(c.precio_aplicado)}
                                  </p>
                                  <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                    {c.codigo_cita}
                                  </p>
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {sinResultados && (
                      <p className="text-sm text-slate-500 mt-1">
                        No se encontró ninguna cita pendiente de pago con esa búsqueda.
                      </p>
                    )}
                  </>
                )}
              </section>

              {/* ── Paso 2: Forma de pago ── */}
              {cita && (
                <section className={`bg-white rounded-2xl shadow-sm p-6 space-y-5
                                     ring-2 ring-[#0059B3]/20`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-[#0059B3] text-white text-xs font-bold
                                     flex items-center justify-center flex-shrink-0">
                      2
                    </span>
                    <p className="text-sm font-semibold text-slate-700">Forma de pago</p>
                  </div>

                  {/* Total */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3
                                  flex items-center justify-between">
                    <p className="text-sm text-slate-600">Total a cobrar</p>
                    <p className="text-xl font-bold text-[#0059B3]">
                      {fmt(cita.precio_aplicado)}
                    </p>
                  </div>

                  {/* Método */}
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Método de pago *</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {METODOS.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => { setMetodo(value); setFormErrors(p => ({ ...p, metodo: '' })); }}
                          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl
                                      border-2 text-xs font-semibold transition-all
                                      ${metodo === value
                                        ? 'border-[#0059B3] bg-blue-50 text-[#0059B3]'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                      }`}
                        >
                          <Icon size={20} />
                          {label}
                        </button>
                      ))}
                    </div>
                    {formErrors.metodo && (
                      <p className="text-xs text-red-500 mt-1">⚠ {formErrors.metodo}</p>
                    )}
                  </div>

                  {/* Campos según método */}
                  {metodo === 'EFECTIVO' && (
                    <div className="space-y-3">
                      <Field label="Monto recibido *" error={formErrors.montoRecibido}>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2
                                           text-slate-400 text-sm font-medium">S/</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={montoRecibido}
                            onChange={e => {
                              setMontoRecibido(e.target.value);
                              setFormErrors(p => ({ ...p, montoRecibido: '' }));
                            }}
                            placeholder={Number(cita.precio_aplicado).toFixed(2)}
                            className={fieldCls(formErrors.montoRecibido) + ' pl-8'}
                          />
                        </div>
                      </Field>

                      {montoRecibido && Number(montoRecibido) >= Number(cita.precio_aplicado) && (
                        <div className="flex items-center justify-between bg-green-50
                                        border border-green-200 rounded-xl px-4 py-3">
                          <p className="text-sm text-slate-600">Vuelto / Cambio</p>
                          <p className="text-lg font-bold text-green-700">{fmt(cambio)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(metodo === 'YAPE' || metodo === 'PLIN') && (
                    <Field label="Número de operación *" error={formErrors.numeroOperacion}>
                      <input
                        value={numeroOperacion}
                        onChange={e => {
                          setNumeroOperacion(e.target.value.replace(/\D/g, '').slice(0, 8));
                          setFormErrors(p => ({ ...p, numeroOperacion: '' }));
                        }}
                        maxLength={8}
                        inputMode="numeric"
                        placeholder="Ej. 12345678"
                        className={fieldCls(formErrors.numeroOperacion)}
                      />
                    </Field>
                  )}

                  {metodo === 'TARJETA_PRESENCIAL' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Últimos 4 dígitos *" error={formErrors.ultimos4}>
                        <input
                          value={ultimos4}
                          onChange={e => {
                            setUltimos4(e.target.value.replace(/\D/g, '').slice(0, 4));
                            setFormErrors(p => ({ ...p, ultimos4: '' }));
                          }}
                          maxLength={4}
                          inputMode="numeric"
                          placeholder="1234"
                          className={fieldCls(formErrors.ultimos4)}
                        />
                      </Field>
                      <Field label="Marca *" error={formErrors.marcaTarjeta}>
                        <select
                          value={marcaTarjeta}
                          onChange={e => {
                            setMarcaTarjeta(e.target.value);
                            setFormErrors(p => ({ ...p, marcaTarjeta: '' }));
                          }}
                          className={fieldCls(formErrors.marcaTarjeta)}
                        >
                          <option value="">Selecciona</option>
                          {MARCAS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}

                  {serverError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                    text-red-700 text-sm rounded-lg px-3 py-2.5">
                      <X size={14} className="shrink-0 mt-0.5" />
                      <span>{serverError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={loading || !metodo}
                    className="w-full flex items-center justify-center gap-2
                               bg-[#8BC63F] hover:bg-[#78ae35] active:bg-[#669230]
                               disabled:opacity-60 disabled:cursor-not-allowed
                               text-white font-semibold py-2.5 rounded-lg text-sm
                               transition-colors shadow-sm"
                  >
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                      : <><CreditCard size={16} /> Confirmar pago</>}
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────
function CitaCard({ cita, onCambiar }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="font-semibold text-slate-800">{cita.paciente_nombre}</p>
          <p className="text-xs text-slate-500">
            {cita.tipo_documento}: {cita.numero_documento}
            {cita.paciente_telefono && ` · Tel: ${cita.paciente_telefono}`}
          </p>
          <p className="text-xs text-slate-600 font-medium mt-1">{cita.servicio_nombre}</p>
          <p className="text-xs text-slate-500">{cita.doctor_nombre} · {cita.especialidad}</p>
          <p className="text-xs text-slate-500">
            {new Date(cita.fecha.split('T')[0] + 'T00:00:00').toLocaleDateString('es-PE', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}{' '}
            · {cita.hora_inicio} – {cita.hora_fin}
          </p>
        </div>
        <div className="text-right flex-shrink-0 space-y-1">
          <p className="text-lg font-bold text-[#0059B3]">
            {`S/ ${Number(cita.precio_aplicado).toFixed(2)}`}
          </p>
          <p className="text-[10px] font-mono text-slate-400">{cita.codigo_cita}</p>
          <span className="inline-block text-[10px] font-semibold bg-amber-100 text-amber-700
                           px-2 py-0.5 rounded-full">
            RESERVADA
          </span>
        </div>
      </div>
      <button
        onClick={onCambiar}
        className="text-xs text-red-500 hover:text-red-700 font-medium"
      >
        Cambiar cita
      </button>
    </div>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`font-semibold text-slate-800 text-sm ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error
        ? <p className="text-xs text-red-500 mt-1">⚠ {error}</p>
        : hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function fieldCls(error = '') {
  return `w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none
          focus:ring-2 transition-shadow
          ${error
            ? 'border-red-400 focus:ring-red-300'
            : 'border-slate-300 focus:ring-[#0059B3]/40'}`;
}
