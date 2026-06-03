const axios = require('axios');

// Nubefact: URL única por cliente que actúa como endpoint (incluye client-id)
const NUBEFACT_URL   = process.env.NUBEFACT_URL;
const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;
// NUBEFACT_DEMO=true  → siempre usa mock (sin llamar a la API real)
const FORCE_DEMO     = process.env.NUBEFACT_DEMO === 'true';

// Tipo de documento → código Nubefact (1=DNI, 4=CE, 7=Pasaporte, 6=RUC, 0=Sin doc)
const mapTipoDoc = (tipo) => ({ DNI: 1, CE: 4, PASAPORTE: 7, RUC: 6 }[tipo?.toUpperCase()] ?? 0);

// Método de pago → texto Nubefact
const mapMetodo = (metodo) =>
  ({ EFECTIVO: 'EFECTIVO', YAPE: 'TRANSFERENCIA', PLIN: 'TRANSFERENCIA',
     TARJETA_PRESENCIAL: 'TARJETA', TARJETA_ONLINE: 'TARJETA' }[metodo] ?? 'EFECTIVO');

/**
 * Emite un comprobante vía Nubefact.
 * Si NUBEFACT_TOKEN no está configurado entra en modo demo (respuesta simulada).
 */
async function emitirComprobante({
  tipo,                  // 'BOLETA' | 'FACTURA'
  serie,                 // 'B001' | 'F001'
  numero,                // correlativo numérico
  monto,                 // decimal (precio del servicio)
  descripcionServicio,   // nombre del servicio
  clienteTipoDoc,        // 'DNI' | 'CE' | 'PASAPORTE'
  clienteNumeroDoc,
  clienteNombre,
  clienteEmail,
  metodoPago,
  clienteRuc,            // requerido si tipo === 'FACTURA'
  clienteRazonSocial,    // requerido si tipo === 'FACTURA'
}) {
  const esFact   = tipo === 'FACTURA';
  const tipoCpe  = esFact ? 1 : 2;
  const docTipo  = esFact ? 6 : mapTipoDoc(clienteTipoDoc);
  const docNum   = esFact ? clienteRuc        : (clienteNumeroDoc || '');
  const docNom   = esFact ? clienteRazonSocial : (clienteNombre   || 'Cliente');

  const now   = new Date();
  const fecha = [now.getDate(), now.getMonth() + 1, now.getFullYear()]
    .map(n => String(n).padStart(2, '0')).join('/');
  const hora  = [now.getHours(), now.getMinutes()]
    .map(n => String(n).padStart(2, '0')).join(':');

  const body = {
    operacion: 'generar_comprobante',
    tipo_de_comprobante: tipoCpe,
    serie,
    numero,
    sunat_transaction: 1,
    cliente_tipo_de_documento: docTipo,
    cliente_numero_de_documento: docNum,
    cliente_denominacion: docNom,
    cliente_direccion: '',
    cliente_email: clienteEmail || '',
    cliente_email_1: '',
    cliente_email_2: '',
    fecha_de_emision: fecha,
    hora_de_emision: hora,
    moneda: 1,
    tipo_de_cambio: '',
    porcentaje_de_descuento: 0,
    total_descuento: 0,
    total_anticipo: 0,
    total_gravada: 0,
    total_inafecta: 0,
    total_exonerada: Number(monto),   // servicios médicos exonerados de IGV
    total_igv: 0,
    total_gratuita: 0,
    total_otros_cargos: 0,
    total: Number(monto),
    percepcion_tipo: '',
    percepcion_base_imponible: 0,
    total_percepcion: 0,
    total_incluido_percepcion: 0,
    detraccion: false,
    observaciones: '',
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: !!(clienteEmail),
    medio_de_pago: mapMetodo(metodoPago),
    items: [{
      unidad_de_medida: 'ZZ',
      codigo: 'S001',
      descripcion: descripcionServicio,
      cantidad: 1,
      valor_unitario: Number(monto),
      precio_unitario: Number(monto),
      descuento: '',
      subtotal: Number(monto),
      tipo_de_igv: 7,   // Exonerado
      igv: 0,
      total: Number(monto),
      anticipo_regularizacion: false,
      anticipo_documento_serie: '',
      anticipo_documento_numero: '',
    }],
  };

  if (!NUBEFACT_TOKEN || FORCE_DEMO) {
    return _mockResponse(tipo, serie, numero);
  }

  try {
    const { data } = await axios.post(NUBEFACT_URL, body, {
      headers: { Authorization: `Token ${NUBEFACT_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 15_000,
    });

    if (data.errors && data.errors.length) {
      throw new Error(data.errors.join(', '));
    }

    return data;
  } catch (err) {
    // Si falla la API (credenciales incorrectas, entorno, etc.) y estamos en desarrollo
    // caemos al mock para no bloquear el flujo
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[nubefact] API falló, usando modo DEMO:', err.message);
      return _mockResponse(tipo, serie, numero);
    }
    throw err;
  }
}

function _mockResponse(tipo, serie, numero) {
  const label = tipo === 'FACTURA' ? 'Factura' : 'Boleta';
  const id    = `DEMO-${Date.now()}`;
  return {
    accepted_by_sunat: true,
    sunat_description: `${label} ${serie}-${numero} aceptada (modo DEMO — sin validez SUNAT).`,
    sunat_note: 'Configure NUBEFACT_TOKEN para emitir comprobantes reales.',
    sunat_responsecode: '0',
    enlace_del_pdf: null,
    enlace_del_cdr: null,
    hash: id,
    codigo_hash: id,
    _demo: true,
  };
}

module.exports = { emitirComprobante };
