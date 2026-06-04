import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText, Receipt, Loader2, CheckCircle2, AlertTriangle,
  Download, Mail, Printer, X, RotateCcw, ArrowLeft,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

const fmt = (n) => `S/ ${Number(n).toFixed(2)}`;

function openPrintWindow(result, pago) {
  const label  = result.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Boleta';
  const numero = `${result.serie}-${result.numero}`;
  const fecha  = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const monto  = Number(pago?.monto_total || 0).toFixed(2);
  const logoUrl = `${window.location.origin}/ICONOCLINICA.svg`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${label} ${numero}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; text-align: center; padding: 24px 16px; }
    .ticket { display: inline-block; text-align: left; width: 100%; max-width: 380px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 16px; }
    .logo { width: 90px; height: auto; margin: 0 auto 10px; display: block; }
    .clinic-name { font-size: 17px; font-weight: bold; }
    .comp-type { font-size: 15px; font-weight: bold; color: #0059B3; margin-top: 4px; }
    .comp-num { font-size: 13px; color: #475569; margin-top: 2px; }
    .demo-badge { display: inline-block; margin-top: 8px; background: #fef3c7; border: 1px solid #f59e0b; padding: 3px 10px; border-radius: 4px; font-size: 11px; color: #92400e; }
    .divider { border: none; border-top: 1px dashed #94a3b8; margin: 12px 0; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
    .row .label { color: #64748b; flex-shrink: 0; }
    .row .val { text-align: right; font-weight: 500; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0 0; font-size: 16px; font-weight: bold; }
    .total-row .amount { color: #0059B3; }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="ticket">
  <div class="header">
    <img class="logo" src="${logoUrl}" alt="Consultorio Padre Pío" onerror="this.style.display='none'">
    <div class="clinic-name">Consultorio Padre Pío</div>
    <div class="comp-type">${label} Electrónica</div>
    <div class="comp-num">${numero}</div>
    ${result._demo ? '<span class="demo-badge">MODO DEMO — Sin validez ante SUNAT</span>' : ''}
  </div>
  <hr class="divider">
  <div class="row"><span class="label">Fecha:</span><span class="val">${fecha}</span></div>
  <div class="row"><span class="label">Paciente:</span><span class="val">${pago?.paciente_nombre || '—'}</span></div>
  <div class="row"><span class="label">Documento:</span><span class="val">${pago?.tipo_documento}: ${pago?.numero_documento}</span></div>
  ${result.tipo_comprobante === 'FACTURA' && result.cliente_ruc ? `<div class="row"><span class="label">RUC:</span><span class="val">${result.cliente_ruc}</span></div><div class="row"><span class="label">Razón social:</span><span class="val">${result.cliente_razon_social || ''}</span></div>` : ''}
  <div class="row"><span class="label">Servicio:</span><span class="val">${pago?.servicio_nombre || '—'}</span></div>
  <div class="row"><span class="label">Doctor:</span><span class="val">${pago?.doctor_nombre || '—'}</span></div>
  <div class="row"><span class="label">Método de pago:</span><span class="val">${pago?.metodo_pago || '—'}</span></div>
  <hr class="divider">
  <div class="row"><span class="label">Subtotal exonerado (Ap. II Ley IGV):</span><span class="val">S/ ${monto}</span></div>
  <div class="row"><span class="label">IGV (exonerado):</span><span class="val">S/ 0.00</span></div>
  <hr class="divider">
  <div class="total-row"><span>TOTAL</span><span class="amount">S/ ${monto}</span></div>
  <div class="footer">
    <p>Comprobante emitido electrónicamente</p>
    <p>Gracias por su preferencia</p>
  </div>
  </div>
  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 250); };
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    // Bloqueador de pop-ups: abrir en la misma pestaña como respaldo
    URL.revokeObjectURL(url);
    const fallback = new Blob([html], { type: 'text/html' });
    window.location.href = URL.createObjectURL(fallback);
    return;
  }
  // Liberar el objeto URL una vez cargado
  win.addEventListener?.('load', () => setTimeout(() => URL.revokeObjectURL(url), 1000));
}

export default function GenerarComprobante() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const pagoId         = searchParams.get('pago_id');

  // Datos del pago
  const [pago,      setPago]      = useState(null);
  const [loadingPago, setLoadingPago] = useState(true);
  const [pagoError, setPagoError] = useState('');

  // Formulario
  const [tipo,           setTipo]           = useState('BOLETA');
  const [clienteRuc,     setClienteRuc]     = useState('');
  const [razonSocial,    setRazonSocial]    = useState('');
  const [formErrors,     setFormErrors]     = useState({});

  // Submit
  const [generating, setGenerating] = useState(false);
  const [result,     setResult]     = useState(null); // comprobante generado

  // Acciones post-generación
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent,    setEmailSent]    = useState(false);
  const [voiding,      setVoiding]      = useState(false);
  const [showVoidModal,setShowVoidModal]= useState(false);
  const [motivoAnul,   setMotivoAnul]   = useState('');

  // ─── Cargar datos del pago ─────────────────────────────────────
  useEffect(() => {
    if (!pagoId) { setPagoError('No se especificó un pago.'); setLoadingPago(false); return; }
    api.get(`/payments/${pagoId}`)
      .then(({ data }) => {
        if (data.comprobante_id && data.comprobante_estado === 'EMITIDO') {
          // Ya tiene comprobante → cargar directamente
          setResult({
            comprobante_id:   data.comprobante_id,
            tipo_comprobante: data.tipo_comprobante,
            serie:            data.serie,
            numero:           data.numero,
            nubefact_pdf_url: data.nubefact_pdf_url,
            nubefact_cpe_url: data.nubefact_cpe_url,
            _already_exists:  true,
          });
        }
        setPago(data);
      })
      .catch(() => setPagoError('No se pudo cargar el pago. Intente nuevamente.'))
      .finally(() => setLoadingPago(false));
  }, [pagoId]);

  // ─── Validar formulario ────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (tipo === 'FACTURA') {
      if (!/^\d{11}$/.test(clienteRuc)) e.ruc = 'El RUC debe tener exactamente 11 dígitos numéricos';
      if (!razonSocial.trim())           e.razonSocial = 'La razón social es requerida';
    }
    return e;
  };

  // ─── Generar comprobante ───────────────────────────────────────
  const handleGenerate = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setGenerating(true);
    try {
      const payload = { pago_id: Number(pagoId), tipo_comprobante: tipo };
      if (tipo === 'FACTURA') {
        payload.cliente_ruc          = clienteRuc;
        payload.cliente_razon_social = razonSocial.trim();
      }
      const { data } = await api.post('/comprobantes', payload);
      setResult(data);
      toast.success('Comprobante generado correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al generar el comprobante';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // ─── Enviar por correo ─────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!result?.comprobante_id) return;
    setSendingEmail(true);
    try {
      await api.post(`/comprobantes/${result.comprobante_id}/email`);
      setEmailSent(true);
      toast.success('Comprobante enviado al correo del cliente');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar el correo');
    } finally {
      setSendingEmail(false);
    }
  };

  // ─── Anular ────────────────────────────────────────────────────
  const handleVoid = async () => {
    if (!motivoAnul.trim()) { toast.error('Ingresa el motivo de anulación'); return; }
    setVoiding(true);
    try {
      await api.put(`/comprobantes/${result.comprobante_id}/void`, { motivo: motivoAnul });
      toast.success('Comprobante anulado correctamente');
      setShowVoidModal(false);
      navigate('/caja/pagos');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al anular el comprobante');
    } finally {
      setVoiding(false);
    }
  };

  // ─── Loading / Error al cargar pago ──────────────────────────
  if (loadingPago) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin text-[#0059B3]" />
        </div>
      </AppLayout>
    );
  }

  if (pagoError) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <AlertTriangle size={40} className="text-amber-400 mx-auto mb-3" />
          <p className="text-slate-600">{pagoError}</p>
          <button onClick={() => navigate('/caja/pagos')}
            className="mt-4 text-[#0059B3] text-sm font-medium hover:underline">
            ← Volver a pagos
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate('/caja/pagos')}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[#0059B3]">Generar comprobante</h1>
              <p className="text-sm text-slate-500">Boleta o factura electrónica para el paciente</p>
            </div>
          </div>

          {/* ── Resumen del pago ── */}
          <section className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Datos del pago
            </p>
            <div className="space-y-1.5 text-sm">
              <Row label="Paciente"   value={pago?.paciente_nombre} />
              <Row label="Documento"  value={`${pago?.tipo_documento}: ${pago?.numero_documento}`} />
              <Row label="Servicio"   value={pago?.servicio_nombre} />
              <Row label="Doctor"     value={pago?.doctor_nombre} />
              <Row label="Cita"       value={pago?.codigo_cita} mono />
              <Row label="Método"     value={pago?.metodo_pago} />
              <div className="border-t border-slate-100 pt-2 mt-2 flex items-center justify-between">
                <span className="text-slate-500">Total cobrado</span>
                <span className="text-lg font-bold text-[#0059B3]">{fmt(pago?.monto_total)}</span>
              </div>
            </div>
          </section>

          {/* ── Desglose tributario ── */}
          <section className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-[#0059B3] uppercase tracking-wide mb-2">
              Desglose tributario
            </p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal exonerado (Ap. II Ley IGV)</span>
                <span className="font-semibold text-slate-800">{fmt(pago?.monto_total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">IGV (exonerado)</span>
                <span className="font-semibold text-slate-800">S/ 0.00</span>
              </div>
              <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                <span className="font-bold text-slate-800">Total</span>
                <span className="font-bold text-[#0059B3]">{fmt(pago?.monto_total)}</span>
              </div>
            </div>
          </section>

          {/* ── Panel de éxito post-generación ── */}
          {result ? (
            <SuccessPanel
              result={result}
              pago={pago}
              emailSent={emailSent}
              sendingEmail={sendingEmail}
              onSendEmail={handleSendEmail}
              onVoid={() => setShowVoidModal(true)}
              onNew={() => navigate('/caja/comprobantes/nuevo?pago_id=' + pagoId)}
            />
          ) : (
            /* ── Formulario de generación ── */
            <section className="bg-white rounded-2xl shadow-sm p-5 space-y-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Tipo de comprobante
              </p>

              {/* Selector tipo */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'BOLETA',  label: 'Boleta de Venta', sub: 'Personas naturales', icon: Receipt },
                  { value: 'FACTURA', label: 'Factura',          sub: 'Personas con RUC',   icon: FileText },
                ].map(({ value, label, sub, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setTipo(value); setFormErrors({}); }}
                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2
                                text-sm font-semibold transition-all
                                ${tipo === value
                                  ? 'border-[#0059B3] bg-blue-50 text-[#0059B3]'
                                  : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <Icon size={22} />
                    <span>{label}</span>
                    <span className="text-xs font-normal text-slate-400">{sub}</span>
                  </button>
                ))}
              </div>

              {/* Campos adicionales para FACTURA */}
              {tipo === 'FACTURA' && (
                <div className="space-y-3">
                  <Field label="RUC del cliente *" error={formErrors.ruc}>
                    <input
                      value={clienteRuc}
                      onChange={e => {
                        setClienteRuc(e.target.value.replace(/\D/g, '').slice(0, 11));
                        setFormErrors(p => ({ ...p, ruc: '' }));
                      }}
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="20123456789"
                      className={fieldCls(formErrors.ruc)}
                    />
                  </Field>
                  <Field label="Razón social *" error={formErrors.razonSocial}>
                    <input
                      value={razonSocial}
                      onChange={e => {
                        setRazonSocial(e.target.value);
                        setFormErrors(p => ({ ...p, razonSocial: '' }));
                      }}
                      placeholder="Empresa S.A.C."
                      className={fieldCls(formErrors.razonSocial)}
                    />
                  </Field>
                </div>
              )}

              {/* Datos del cliente para BOLETA */}
              {tipo === 'BOLETA' && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-600">
                  <p className="font-medium mb-1">Datos del cliente (boleta)</p>
                  <p>{pago?.paciente_nombre}</p>
                  <p className="text-slate-400">{pago?.tipo_documento}: {pago?.numero_documento}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2
                           bg-[#0059B3] hover:bg-[#004a99] disabled:opacity-60
                           text-white font-semibold py-2.5 rounded-lg text-sm
                           transition-colors shadow-sm"
              >
                {generating
                  ? <><Loader2 size={16} className="animate-spin" /> Generando...</>
                  : <><FileText size={16} /> Generar {tipo === 'FACTURA' ? 'Factura' : 'Boleta'}</>}
              </button>
            </section>
          )}
        </div>
      </div>

      {/* ── Modal anulación ── */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-800">Anular comprobante</p>
              <button onClick={() => setShowVoidModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              Esta acción no puede deshacerse. El pago original no se verá afectado.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motivo de anulación *
              </label>
              <textarea
                value={motivoAnul}
                onChange={e => setMotivoAnul(e.target.value)}
                rows={3}
                placeholder="Describe el motivo..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowVoidModal(false)}
                className="flex-1 py-2 rounded-lg border border-slate-300 text-sm
                           font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleVoid} disabled={voiding}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600
                           disabled:opacity-60 text-white text-sm font-semibold
                           transition-colors">
                {voiding ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ── Panel de éxito ─────────────────────────────────────────────────
function SuccessPanel({ result, pago, emailSent, sendingEmail, onSendEmail, onVoid }) {
  const label  = result.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Boleta';
  const numero = `${result.serie}-${result.numero}`;

  const handleDownloadPdf = () => {
    if (result.nubefact_pdf_url) {
      window.open(result.nubefact_pdf_url, '_blank', 'noopener,noreferrer');
    } else {
      openPrintWindow(result, pago);
    }
  };

  const handlePrint = () => openPrintWindow(result, pago);

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 size={30} className="text-[#8BC63F]" />
        </div>
        <p className="text-base font-bold text-slate-800">Comprobante emitido</p>
        <p className="text-sm text-slate-500">
          {label} <span className="font-mono font-semibold text-slate-700">{numero}</span>
        </p>
        {result._demo && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200
                        rounded-lg px-3 py-1.5 inline-block">
            Modo DEMO — sin validez ante SUNAT
          </p>
        )}
        {result._already_exists && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200
                        rounded-lg px-3 py-1.5 inline-block">
            Este pago ya tenía un comprobante emitido
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleDownloadPdf}
          className="flex items-center justify-center gap-2 py-2.5 px-3
                     bg-[#0059B3] hover:bg-[#004a99] text-white text-sm
                     font-semibold rounded-xl transition-colors">
          <Download size={15} /> Descargar PDF
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 py-2.5 px-3
                     border-2 border-slate-200 hover:border-slate-300
                     text-slate-600 text-sm font-semibold rounded-xl transition-colors"
        >
          <Printer size={15} /> Imprimir
        </button>

        <button
          onClick={onSendEmail}
          disabled={sendingEmail || emailSent || !pago?.paciente_email}
          title={!pago?.paciente_email ? 'El cliente no tiene correo registrado' : ''}
          className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-3
                     border-2 border-[#8BC63F] hover:bg-green-50
                     disabled:opacity-50 disabled:cursor-not-allowed
                     text-[#5a8a2a] text-sm font-semibold rounded-xl transition-colors"
        >
          {sendingEmail
            ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
            : emailSent
              ? <><CheckCircle2 size={15} /> Correo enviado</>
              : <><Mail size={15} /> Enviar al correo del cliente</>}
        </button>
      </div>

      {!pago?.paciente_email && (
        <p className="text-xs text-slate-400 text-center">
          El cliente no tiene correo registrado. Actualice sus datos para enviar por correo.
        </p>
      )}

      {/* Anular */}
      {!result._already_exists && (
        <div className="border-t border-slate-100 pt-4">
          <button onClick={onVoid}
            className="w-full flex items-center justify-center gap-2 py-2
                       text-red-500 hover:text-red-700 text-sm font-medium
                       hover:bg-red-50 rounded-lg transition-colors">
            <RotateCcw size={14} /> Anular comprobante
          </button>
        </div>
      )}
    </section>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────
function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className={`font-medium text-slate-800 text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">⚠ {error}</p>}
    </div>
  );
}

function fieldCls(error = '') {
  return `w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none
          focus:ring-2 transition-shadow
          ${error ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-[#0059B3]/40'}`;
}
