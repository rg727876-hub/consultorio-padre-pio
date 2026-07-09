import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { confirmarPago } from '../../services/portalAppointments.service';

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY;

const fieldStyle = {
  base: {
    fontSize: '14px',
    color: '#1e293b',
    fontFamily: 'Arial, sans-serif',
    placeholderColor: '#94a3b8',
  },
};

// Formulario de un único medio de pago (tarjeta o yape) — el medio ya viene
// elegido desde afuera (botón que abrió el modal), este componente no lo cambia.
export default function StepPago({ metodo, holdId, amount, defaultEmail, onSuccess, onExpired }) {
  const mpRef = useRef(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState(null);

  const [cardholderName, setCardholderName] = useState('');
  const [phoneNumber, setPhoneNumber]       = useState('');
  const [otp, setOtp]                       = useState('');
  const [email, setEmail]                   = useState(defaultEmail ?? '');
  const [cardBrand, setCardBrand]           = useState(null); // { id, name, thumbnail }

  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError]     = useState(null);

  // Inicializa el SDK y monta los Secure Fields (si es tarjeta) una sola vez
  // por instancia del modal. Todo síncrono entre crear y guardar la
  // referencia, para que el cleanup desmonte bien bajo React StrictMode.
  useEffect(() => {
    if (!MP_PUBLIC_KEY) { setSdkError('Falta configurar VITE_MP_PUBLIC_KEY en el portal.'); return; }
    if (!window.MercadoPago) { setSdkError('No se pudo cargar el módulo de pagos. Recarga la página.'); return; }

    const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
    mpRef.current = mp;
    setSdkReady(true);

    if (metodo !== 'tarjeta') return;

    const cardNumberField = mp.fields
      .create('cardNumber', { placeholder: '0000 0000 0000 0000', style: fieldStyle })
      .mount('mp-card-number');
    const expirationDateField = mp.fields
      .create('expirationDate', { placeholder: 'MM/AA', style: fieldStyle })
      .mount('mp-expiration-date');
    const securityCodeField = mp.fields
      .create('securityCode', { placeholder: 'CVV', style: fieldStyle })
      .mount('mp-security-code');

    cardNumberField.on('binChange', async (data) => {
      const bin = data?.bin;
      if (!bin) { setCardBrand(null); return; }
      try {
        const { results } = await mp.getPaymentMethods({ bin });
        setCardBrand(results?.[0] ?? null);
      } catch {
        setCardBrand(null);
      }
    });

    return () => {
      cardNumberField.unmount();
      expirationDateField.unmount();
      securityCodeField.unmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mpRef.current || submitting) return;
    setPayError(null);
    setSubmitting(true);

    try {
      let formData;
      if (metodo === 'tarjeta') {
        const tokenResp = await mpRef.current.fields.createCardToken({ cardholderName });
        formData = { token: tokenResp.id, payer: { email } };
      } else {
        const yapeToken = await mpRef.current.yape({ otp, phoneNumber }).create();
        formData = { token: yapeToken?.id ?? yapeToken, payment_method_id: 'yape', payer: { email } };
      }

      const { data } = await confirmarPago({ hold_id: holdId, form_data: formData });
      onSuccess(data);
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error;

      if (status === 408) { onExpired(); return; }
      if (serverMsg) {
        setPayError(serverMsg);
      } else if (metodo === 'yape') {
        setPayError('Revisa tu número y el código OTP de la app Yape e intenta nuevamente.');
      } else {
        setPayError('Revisa los datos de tu tarjeta e intenta nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = sdkReady && !submitting && email.trim() && (
    metodo === 'tarjeta'
      ? cardholderName.trim()
      : phoneNumber.trim().length === 9 && otp.trim().length === 6
  );

  return (
    <div className="space-y-4">
      {sdkError && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={15} /> {sdkError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {metodo === 'tarjeta' ? (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Número de tarjeta</label>
              <div className="relative">
                <div id="mp-card-number" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-12 h-10 bg-white" />
                {cardBrand?.thumbnail && (
                  <img
                    src={cardBrand.thumbnail}
                    alt={cardBrand.name}
                    title={cardBrand.name}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-auto pointer-events-none select-none"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Vencimiento</label>
                <div id="mp-expiration-date" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 h-10 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CVV</label>
                <div id="mp-security-code" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 h-10 bg-white" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre del titular</label>
              <input
                type="text" required value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                placeholder="COMO APARECE EN LA TARJETA"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none
                           focus:ring-2 focus:ring-primary/25 focus:border-primary"
              />
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#6d2eb3]/5 border border-[#6d2eb3]/20 rounded-xl px-4 py-3">
              <p className="text-xs text-[#6d2eb3] leading-relaxed">
                Activa "Compras por internet" en tu app Yape, genera un código y escríbelo aquí junto a tu número.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Número de celular</label>
              <input
                type="tel" required value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="987654321" maxLength={9}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none
                           focus:ring-2 focus:ring-[#6d2eb3]/25 focus:border-[#6d2eb3]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Código OTP (app Yape)</label>
              <input
                type="text" inputMode="numeric" required value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456" maxLength={6}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none tracking-widest
                           focus:ring-2 focus:ring-[#6d2eb3]/25 focus:border-[#6d2eb3]"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correo para el comprobante</label>
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2
              ${metodo === 'yape' ? 'focus:ring-[#6d2eb3]/25 focus:border-[#6d2eb3]' : 'focus:ring-primary/25 focus:border-primary'}`}
          />
        </div>

        {payError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-3">
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> <span>{payError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full flex items-center justify-center gap-2 text-white font-bold
                     text-sm py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors
            ${metodo === 'yape' ? 'bg-[#6d2eb3] hover:bg-[#5c2596]' : 'bg-accent hover:bg-[#78b52c]'}`}
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Procesando pago…</>
            : <><ShieldCheck size={16} /> Pagar S/ {Number(amount).toFixed(2)}</>}
        </button>
      </form>
    </div>
  );
}
