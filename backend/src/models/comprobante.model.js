const pool = require('../config/db');

/** Próximo número correlativo para una serie */
async function getNextNumero(serie) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM COMPROBANTE WHERE serie = ?`,
    [serie]
  );
  return row.siguiente;
}

/** Comprobante por pago_id (con datos del pago) */
async function findByPagoId(pago_id) {
  const [[row]] = await pool.query(
    `SELECT c.*,
            p.metodo_pago, p.monto_total, p.fecha_pago,
            p.cita_id,
            CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
            pat.tipo_documento, pat.numero_documento, pat.email AS paciente_email,
            s.nombre AS servicio_nombre,
            CONCAT('Dr. ', u.apellido, ', ', u.nombre) AS doctor_nombre
     FROM   COMPROBANTE c
     JOIN   PAGO        p   ON c.pago_id    = p.pago_id
     JOIN   CITA        ci  ON p.cita_id    = ci.cita_id
     JOIN   PACIENTE    pat ON ci.paciente_id = pat.paciente_id
     JOIN   SERVICIO    s   ON ci.servicio_id = s.servicio_id
     JOIN   DOCTOR      d   ON ci.doctor_id   = d.doctor_id
     JOIN   USUARIO     u   ON d.doctor_id    = u.usuario_id
     WHERE  c.pago_id = ?`,
    [pago_id]
  );
  return row ?? null;
}

/** Comprobante por comprobante_id */
async function findById(comprobante_id) {
  const [[row]] = await pool.query(
    `SELECT c.*,
            p.metodo_pago, p.monto_total, p.fecha_pago,
            p.cita_id,
            CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
            pat.tipo_documento, pat.numero_documento, pat.email AS paciente_email,
            s.nombre AS servicio_nombre
     FROM   COMPROBANTE c
     JOIN   PAGO        p   ON c.pago_id    = p.pago_id
     JOIN   CITA        ci  ON p.cita_id    = ci.cita_id
     JOIN   PACIENTE    pat ON ci.paciente_id = pat.paciente_id
     JOIN   SERVICIO    s   ON ci.servicio_id = s.servicio_id
     WHERE  c.comprobante_id = ?`,
    [comprobante_id]
  );
  return row ?? null;
}

/** Crear comprobante */
async function create({
  pago_id, tipo_comprobante, serie, numero,
  monto_final, subtotal_exonerado, igv,
  nubefact_id, nubefact_cpe_url, nubefact_pdf_url,
  nubefact_hash, nubefact_aceptado_sunat,
  cliente_ruc, cliente_razon_social,
}) {
  const [result] = await pool.query(
    `INSERT INTO COMPROBANTE
       (pago_id, tipo_comprobante, serie, numero,
        monto_final, subtotal_exonerado, igv,
        nubefact_id, nubefact_cpe_url, nubefact_pdf_url,
        nubefact_hash, nubefact_aceptado_sunat,
        cliente_ruc, cliente_razon_social, estado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'EMITIDO')`,
    [
      pago_id, tipo_comprobante, serie, numero,
      monto_final, subtotal_exonerado, igv,
      nubefact_id          ?? null,
      nubefact_cpe_url     ?? null,
      nubefact_pdf_url     ?? null,
      nubefact_hash        ?? null,
      nubefact_aceptado_sunat ?? null,
      cliente_ruc          ?? null,
      cliente_razon_social ?? null,
    ]
  );
  return result.insertId;
}

/** Marcar como enviado por correo */
async function markEmailSent(comprobante_id) {
  await pool.query(
    `UPDATE COMPROBANTE
     SET enviado_correo = TRUE, fecha_envio_correo = NOW()
     WHERE comprobante_id = ?`,
    [comprobante_id]
  );
}

/** Anular comprobante */
async function voidById(comprobante_id) {
  await pool.query(
    `UPDATE COMPROBANTE SET estado = 'ANULADO' WHERE comprobante_id = ?`,
    [comprobante_id]
  );
}

module.exports = { getNextNumero, findByPagoId, findById, create, markEmailSent, voidById };
