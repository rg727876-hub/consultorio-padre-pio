const pool        = require('../config/db');
const comprobanteModel = require('../models/comprobante.model');
const { emitirComprobante } = require('../services/nubefact.service');
const { logAudit }          = require('../utils/audit.util');
const { sendComprobanteEmail } = require('../utils/mailer.util');

const BOLETA_SERIE  = process.env.BOLETA_SERIE  || 'B001';
const FACTURA_SERIE = process.env.FACTURA_SERIE || 'F001';

// ─────────────────────────────────────────────────────────
// POST /api/comprobantes
// Genera un comprobante para un pago COMPLETADO
// ─────────────────────────────────────────────────────────
const generateComprobante = async (req, res) => {
  const {
    pago_id,
    tipo_comprobante,        // 'BOLETA' | 'FACTURA'
    cliente_ruc = null,
    cliente_razon_social = null,
  } = req.body;

  if (!pago_id || !tipo_comprobante) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  if (!['BOLETA', 'FACTURA'].includes(tipo_comprobante)) {
    return res.status(400).json({ error: 'Tipo de comprobante inválido' });
  }
  if (tipo_comprobante === 'FACTURA') {
    if (!cliente_ruc || !/^\d{11}$/.test(cliente_ruc)) {
      return res.status(400).json({ error: 'RUC inválido (debe tener 11 dígitos numéricos)' });
    }
    if (!cliente_razon_social?.trim()) {
      return res.status(400).json({ error: 'La razón social es requerida para facturas' });
    }
  }

  try {
    // Verificar pago
    const [[pago]] = await pool.query(
      `SELECT p.pago_id, p.monto_total, p.metodo_pago, p.estado AS pago_estado,
              ci.cita_id, ci.codigo_cita, ci.precio_aplicado,
              s.nombre AS servicio_nombre,
              CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
              pat.tipo_documento, pat.numero_documento,
              pat.email AS paciente_email
       FROM   PAGO     p
       JOIN   CITA     ci  ON p.cita_id     = ci.cita_id
       JOIN   SERVICIO s   ON ci.servicio_id = s.servicio_id
       JOIN   PACIENTE pat ON ci.paciente_id = pat.paciente_id
       WHERE  p.pago_id = ?`,
      [Number(pago_id)]
    );

    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    if (pago.pago_estado !== 'COMPLETADO') {
      return res.status(409).json({ error: 'Solo se pueden generar comprobantes de pagos completados' });
    }

    // Verificar que no exista ya un comprobante EMITIDO para este pago
    const existing = await comprobanteModel.findByPagoId(pago_id);
    if (existing && existing.estado === 'EMITIDO') {
      return res.status(409).json({
        error: 'Ya existe un comprobante emitido para este pago',
        comprobante_id: existing.comprobante_id,
      });
    }

    const serie  = tipo_comprobante === 'FACTURA' ? FACTURA_SERIE : BOLETA_SERIE;
    const numero = await comprobanteModel.getNextNumero(serie);
    const monto  = Number(pago.monto_total);

    // Llamar a Nubefact (o mock demo)
    const nubefactResp = await emitirComprobante({
      tipo: tipo_comprobante,
      serie,
      numero,
      monto,
      descripcionServicio: pago.servicio_nombre,
      clienteTipoDoc:  pago.tipo_documento,
      clienteNumeroDoc: pago.numero_documento,
      clienteNombre:   pago.paciente_nombre,
      clienteEmail:    pago.paciente_email,
      metodoPago:      pago.metodo_pago,
      clienteRuc:      cliente_ruc,
      clienteRazonSocial: cliente_razon_social,
    });

    // Guardar en BD
    const comprobante_id = await comprobanteModel.create({
      pago_id:       Number(pago_id),
      tipo_comprobante,
      serie,
      numero,
      monto_final:          monto,
      subtotal_exonerado:   monto,
      igv:                  0,
      nubefact_id:          nubefactResp.hash       || nubefactResp.codigo_hash || null,
      nubefact_cpe_url:     nubefactResp.enlace_del_cdr || null,
      nubefact_pdf_url:     nubefactResp.enlace_del_pdf || null,
      nubefact_hash:        nubefactResp.codigo_hash    || null,
      nubefact_aceptado_sunat: nubefactResp.accepted_by_sunat ?? null,
      cliente_ruc:          cliente_ruc    || null,
      cliente_razon_social: cliente_razon_social || null,
    });

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'GENERAR_COMPROBANTE',
      entidad:    'COMPROBANTE',
      entidad_id: comprobante_id,
      detalles:   `${tipo_comprobante} ${serie}-${numero} para pago #${pago_id}`,
      ip_origen:  req.ip,
    });

    const comprobante = await comprobanteModel.findById(comprobante_id);

    return res.status(201).json({
      message:        'Comprobante generado correctamente',
      comprobante_id,
      serie,
      numero,
      tipo_comprobante,
      nubefact_pdf_url: nubefactResp.enlace_del_pdf  || null,
      nubefact_cpe_url: nubefactResp.enlace_del_cdr  || null,
      nubefact_sunat_description: nubefactResp.sunat_description || null,
      _demo:          nubefactResp._demo ?? false,
      comprobante,
    });

  } catch (err) {
    console.error('[comprobante.generate]', err.message);
    if (err.response?.data) {
      return res.status(502).json({ error: 'Error al comunicarse con Nubefact', detalle: err.response.data });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────
// GET /api/comprobantes/payment/:pago_id
// Obtiene el comprobante asociado a un pago
// ─────────────────────────────────────────────────────────
const getByPagoId = async (req, res) => {
  const { pago_id } = req.params;
  try {
    const comprobante = await comprobanteModel.findByPagoId(Number(pago_id));
    if (!comprobante) return res.status(404).json({ error: 'Comprobante no encontrado' });
    res.json(comprobante);
  } catch (err) {
    console.error('[comprobante.getByPagoId]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────
// POST /api/comprobantes/:id/email
// Reenvía el comprobante al correo del paciente
// ─────────────────────────────────────────────────────────
const sendEmail = async (req, res) => {
  const { id } = req.params;
  try {
    const comp = await comprobanteModel.findById(Number(id));
    if (!comp) return res.status(404).json({ error: 'Comprobante no encontrado' });
    if (comp.estado === 'ANULADO') {
      return res.status(409).json({ error: 'No se puede enviar un comprobante anulado' });
    }
    if (!comp.paciente_email) {
      return res.status(422).json({
        error: 'El cliente no tiene correo registrado. Actualice sus datos para enviar.',
      });
    }

    await sendComprobanteEmail(comp);
    await comprobanteModel.markEmailSent(Number(id));

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'ENVIAR_EMAIL_COMPROBANTE',
      entidad:    'COMPROBANTE',
      entidad_id: Number(id),
      detalles:   `Enviado a ${comp.paciente_email}`,
      ip_origen:  req.ip,
    });

    res.json({ message: 'Comprobante enviado correctamente al correo del cliente.' });
  } catch (err) {
    console.error('[comprobante.sendEmail]', err.message);
    res.status(500).json({ error: 'Error al enviar el correo. Intente nuevamente.' });
  }
};

// ─────────────────────────────────────────────────────────
// PUT /api/comprobantes/:id/void
// Anula un comprobante emitido
// ─────────────────────────────────────────────────────────
const voidComprobante = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;
  if (!motivo?.trim()) {
    return res.status(400).json({ error: 'El motivo de anulación es requerido' });
  }
  try {
    const comp = await comprobanteModel.findById(Number(id));
    if (!comp) return res.status(404).json({ error: 'Comprobante no encontrado' });
    if (comp.estado === 'ANULADO') {
      return res.status(409).json({ error: 'El comprobante ya está anulado' });
    }

    await comprobanteModel.voidById(Number(id));

    await logAudit({
      usuario_id: req.user?.id,
      accion:     'ANULAR_COMPROBANTE',
      entidad:    'COMPROBANTE',
      entidad_id: Number(id),
      detalles:   `Motivo: ${motivo.trim()}`,
      ip_origen:  req.ip,
    });

    res.json({ message: 'Comprobante anulado correctamente' });
  } catch (err) {
    console.error('[comprobante.void]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { generateComprobante, getByPagoId, sendEmail, voidComprobante };
