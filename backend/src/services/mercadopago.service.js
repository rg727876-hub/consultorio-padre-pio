const { MercadoPagoConfig, Payment, PaymentRefund, PaymentMethod } = require('mercadopago');

// Solo producción — sin modo test/sandbox.
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN_PROD;

const client = ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: ACCESS_TOKEN }) : null;

// Logos de marcas (Visa/Mastercard/Amex) y de Yape, servidos por MercadoPago.
// Requiere el access token (credencial privada) — por eso se pide desde acá
// y no desde el navegador con la public key.
let cachedMethods = null;
const MARCAS_TARJETA = ['visa', 'master', 'amex', 'diners'];

const getPaymentMethodIcons = async () => {
  if (!client) throw new Error('MercadoPago no está configurado (falta access token)');
  if (!cachedMethods) {
    const paymentMethod = new PaymentMethod(client);
    cachedMethods = await paymentMethod.get();
  }
  // Dedupe por id: MercadoPago devuelve variantes (ej. "Visa" y "Visa Prepaid")
  // con el mismo id — nos quedamos con la primera (marca genérica).
  const vistos = new Set();
  const brands = cachedMethods
    .filter((m) => MARCAS_TARJETA.includes(m.id) && m.status === 'active')
    .filter((m) => (vistos.has(m.id) ? false : vistos.add(m.id)))
    .sort((a, b) => MARCAS_TARJETA.indexOf(a.id) - MARCAS_TARJETA.indexOf(b.id))
    .map((m) => ({ id: m.id, name: m.name, thumbnail: m.thumbnail }));
  const yape = cachedMethods.find((m) => m.id === 'yape' && m.status === 'active');
  return { brands, yape: yape ? { id: yape.id, name: yape.name, thumbnail: yape.thumbnail } : null };
};

// Mensajes en español por status_detail de rechazo de MercadoPago.
// https://www.mercadopago.com.pe/developers/es/docs/checkout-api/response-handling/collection-results
const RECHAZO_MENSAJES = {
  cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes.',
  cc_rejected_bad_filled_card_number: 'Revisa el número de la tarjeta.',
  cc_rejected_bad_filled_date: 'Revisa la fecha de expiración.',
  cc_rejected_bad_filled_security_code: 'Revisa el código de seguridad (CVV) de la tarjeta.',
  cc_rejected_bad_filled_other: 'Revisa los datos de la tarjeta.',
  cc_rejected_call_for_authorize: 'Debes autorizar el pago con tu entidad emisora.',
  cc_rejected_card_disabled: 'La tarjeta está deshabilitada. Contacta a tu entidad emisora.',
  cc_rejected_duplicated_payment: 'Ya realizaste un pago por ese monto. Si necesitas pagar de nuevo, usa otra tarjeta.',
  cc_rejected_high_risk: 'El pago fue rechazado por seguridad. Intenta con otra tarjeta.',
  cc_rejected_max_attempts: 'Superaste el número de intentos permitidos. Intenta con otra tarjeta.',
  cc_rejected_other_reason: 'La entidad emisora no procesó el pago.',
};

const mapRejectionMessage = (statusDetail) =>
  RECHAZO_MENSAJES[statusDetail] || 'El pago fue rechazado por la entidad emisora.';

// Procesa un cobro a partir del formData armado en el frontend (token +
// email, y payment_method_id solo cuando el medio no se infiere del token —
// ej. Yape). Monto, descripción y datos del pagador (nombre/documento)
// SIEMPRE los fija el servidor — nunca se confía en lo que venga del cliente.
// Devuelve { status, payment } cuando MercadoPago respondió (aprobado o
// rechazado); lanza si hay un error de red/conexión con la pasarela (el
// caller lo traduce a 502).
const createPayment = async (formData, { amount, description, payer }) => {
  if (!client) throw new Error('MercadoPago no está configurado (falta access token)');

  const payment = new Payment(client);
  const result = await payment.create({
    body: {
      installments: 1,
      ...formData,
      transaction_amount: Number(amount),
      description,
      payer: { ...formData.payer, ...payer },
    },
  });

  return { status: result.status, payment: result };
};

// Reembolso de emergencia: el cargo se aprobó pero la cita no pudo guardarse
// en BD (colisión de horario de último milisegundo, caída de conexión a la
// BD, etc.). Best-effort — si también falla, el caller debe loguearlo para
// conciliación manual.
const refundPayment = async (paymentId) => {
  if (!client) throw new Error('MercadoPago no está configurado (falta access token)');
  const refund = new PaymentRefund(client);
  return refund.create({ payment_id: paymentId });
};

module.exports = { createPayment, mapRejectionMessage, refundPayment, getPaymentMethodIcons };
