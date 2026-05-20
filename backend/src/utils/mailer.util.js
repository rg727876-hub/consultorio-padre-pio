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

module.exports = { sendActivationEmail };
