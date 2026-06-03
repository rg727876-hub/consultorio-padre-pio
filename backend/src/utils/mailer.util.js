const transporter = require('../config/mailer');

const sendActivationEmail = async (to, nombre, token) => {
  const url   = `${process.env.FRONTEND_URL}/activate/${token}`;
  const horas = process.env.ACTIVATION_TOKEN_HOURS || 24;

  await transporter.sendMail({
    from:    process.env.MAIL_FROM,
    to,
    subject: 'Activa tu cuenta — Consultorio Padre Pio',
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- Header azul -->
          <tr>
            <td style="background:#0059B3;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">
                Consultorio Padre Pio
              </h1>
              <p style="margin:4px 0 0;color:#b3d4ff;font-size:12px;letter-spacing:1px;text-transform:uppercase;">
                Sistema de Gestión Interna
              </p>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="margin:0 0 12px;font-size:16px;color:#1e293b;">
                Hola, <strong>${nombre}</strong>
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                El administrador ha creado una cuenta para ti en el sistema de la clínica.
                Para activarla y crear tu contraseña, haz clic en el botón de abajo.
              </p>

              <!-- Botón verde -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="background:#8BC63F;border-radius:8px;">
                    <a href="${url}"
                       style="display:inline-block;padding:14px 32px;
                              color:#ffffff;font-size:15px;font-weight:700;
                              text-decoration:none;letter-spacing:.3px;">
                      Activar mi cuenta
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info adicional -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;
                            border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;color:#64748b;">
                      ⏱ Este enlace expira en <strong>${horas} horas</strong>.
                    </p>
                    <p style="margin:0;font-size:13px;color:#64748b;">
                      🔒 Durante la activación deberás ingresar tu DNI para confirmar tu identidad.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                Si no solicitaste esta cuenta o crees que es un error, ignora este correo
                o contacta al administrador.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                       padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                © ${new Date().getFullYear()} Consultorio Padre Pio · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};

// Documento de boleta/factura independiente (mismo formato que la versión imprimible).
// Se adjunta al correo como archivo HTML para que el cliente lo pueda guardar o imprimir como PDF.
const buildComprobanteDocHtml = (comp) => {
  const label   = comp.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Boleta';
  const numero  = `${comp.serie}-${comp.numero}`;
  const monto   = Number(comp.monto_final).toFixed(2);
  const subtotal = Number(comp.subtotal_exonerado ?? comp.monto_final).toFixed(2);
  const igv     = Number(comp.igv ?? 0).toFixed(2);
  const fecha   = new Date(comp.fecha_emision).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const esFactura = comp.tipo_comprobante === 'FACTURA';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${label} ${numero}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; max-width: 420px; margin: 24px auto; font-size: 13px; color: #1e293b; }
    .header { text-align: center; margin-bottom: 16px; }
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
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="clinic-name">Consultorio Padre Pío</div>
    <div class="comp-type">${label} Electrónica</div>
    <div class="comp-num">${numero}</div>
    ${comp.nubefact_pdf_url ? '' : '<span class="demo-badge">MODO DEMO — Sin validez ante SUNAT</span>'}
  </div>
  <hr class="divider">
  <div class="row"><span class="label">Fecha:</span><span class="val">${fecha}</span></div>
  <div class="row"><span class="label">Paciente:</span><span class="val">${comp.paciente_nombre || '—'}</span></div>
  <div class="row"><span class="label">Documento:</span><span class="val">${comp.tipo_documento}: ${comp.numero_documento}</span></div>
  ${esFactura && comp.cliente_ruc ? `<div class="row"><span class="label">RUC:</span><span class="val">${comp.cliente_ruc}</span></div><div class="row"><span class="label">Razón social:</span><span class="val">${comp.cliente_razon_social || ''}</span></div>` : ''}
  <div class="row"><span class="label">Servicio:</span><span class="val">${comp.servicio_nombre || '—'}</span></div>
  <div class="row"><span class="label">Método de pago:</span><span class="val">${comp.metodo_pago || '—'}</span></div>
  <hr class="divider">
  <div class="row"><span class="label">Subtotal exonerado (Ap. II Ley IGV):</span><span class="val">S/ ${subtotal}</span></div>
  <div class="row"><span class="label">IGV (exonerado):</span><span class="val">S/ ${igv}</span></div>
  <hr class="divider">
  <div class="total-row"><span>TOTAL</span><span class="amount">S/ ${monto}</span></div>
  <div class="footer">
    <p>Comprobante emitido electrónicamente</p>
    <p>Gracias por su preferencia</p>
  </div>
</body>
</html>`;
};

const sendComprobanteEmail = async (comp) => {
  const label  = comp.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Boleta';
  const numero = `${comp.serie}-${comp.numero}`;
  const monto  = `S/ ${Number(comp.monto_final).toFixed(2)}`;
  const subtotal = `S/ ${Number(comp.subtotal_exonerado ?? comp.monto_final).toFixed(2)}`;
  const igv      = `S/ ${Number(comp.igv ?? 0).toFixed(2)}`;
  const fecha  = new Date(comp.fecha_emision).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const pdfLink = comp.nubefact_pdf_url
    ? `<p style="margin:0 0 12px;font-size:14px;text-align:center;">
         <a href="${comp.nubefact_pdf_url}"
            style="background:#0059B3;color:#fff;padding:12px 28px;border-radius:8px;
                   text-decoration:none;font-weight:700;display:inline-block;">
           Ver / Descargar ${label}
         </a>
       </p>`
    : `<p style="margin:0 0 12px;font-size:13px;color:#64748b;text-align:center;">
         Encontrarás tu ${label.toLowerCase()} adjunta a este correo. Ábrela para verla o imprimirla.
       </p>`;

  const docHtml  = buildComprobanteDocHtml(comp);

  await transporter.sendMail({
    from:    process.env.MAIL_FROM,
    to:      comp.paciente_email,
    subject: `Tu ${label} ${numero} — Consultorio Padre Pio`,
    attachments: [{
      filename:    `${label}_${comp.serie}-${comp.numero}.html`,
      content:     docHtml,
      contentType: 'text/html; charset=utf-8',
    }],
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <tr>
            <td style="background:#0059B3;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                Consultorio Padre Pio
              </h1>
              <p style="margin:4px 0 0;color:#b3d4ff;font-size:12px;text-transform:uppercase;letter-spacing:1px;">
                Comprobante de Pago
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">
                Hola, <strong>${comp.paciente_nombre}</strong>
              </p>
              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                Adjunto encontrarás tu <strong>${label} Electrónica ${numero}</strong>
                por el servicio recibido en nuestro consultorio.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;
                            border-radius:8px;margin-bottom:24px;">
                <tr><td style="padding:16px 20px;">
                  <table width="100%">
                    <tr>
                      <td style="font-size:13px;color:#64748b;padding:4px 0;">Comprobante</td>
                      <td style="font-size:13px;font-weight:700;color:#1e293b;text-align:right;padding:4px 0;">
                        ${label} ${numero}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#64748b;padding:4px 0;">Documento</td>
                      <td style="font-size:13px;font-weight:700;color:#1e293b;text-align:right;padding:4px 0;">
                        ${comp.tipo_documento}: ${comp.numero_documento}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#64748b;padding:4px 0;">Servicio</td>
                      <td style="font-size:13px;font-weight:700;color:#1e293b;text-align:right;padding:4px 0;">
                        ${comp.servicio_nombre}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#64748b;padding:4px 0;">Fecha de emisión</td>
                      <td style="font-size:13px;font-weight:700;color:#1e293b;text-align:right;padding:4px 0;">
                        ${fecha}
                      </td>
                    </tr>
                    <tr><td colspan="2" style="border-top:1px solid #e2e8f0;padding:6px 0 0;"></td></tr>
                    <tr>
                      <td style="font-size:13px;color:#64748b;padding:4px 0;">Subtotal exonerado (Ap. II Ley IGV)</td>
                      <td style="font-size:13px;font-weight:700;color:#1e293b;text-align:right;padding:4px 0;">
                        ${subtotal}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#64748b;padding:4px 0;">IGV (exonerado)</td>
                      <td style="font-size:13px;font-weight:700;color:#1e293b;text-align:right;padding:4px 0;">
                        ${igv}
                      </td>
                    </tr>
                    <tr>
                      <td style="font-size:15px;font-weight:700;color:#0059B3;padding:10px 0 4px;border-top:1px solid #e2e8f0;">Total pagado</td>
                      <td style="font-size:15px;font-weight:700;color:#0059B3;text-align:right;padding:10px 0 4px;border-top:1px solid #e2e8f0;">
                        ${monto}
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              ${pdfLink}

              <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
                Si tienes dudas sobre este comprobante, comunícate con nosotros.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                © ${new Date().getFullYear()} Consultorio Padre Pio · Todos los derechos reservados
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
};

module.exports = { sendActivationEmail, sendComprobanteEmail };
