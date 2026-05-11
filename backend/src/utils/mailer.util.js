const transporter = require('../config/mailer');

/**
 * Envía email de activación de cuenta (INT-HU005)
 * Flujo: Admin crea usuario → email con link → usuario activa
 */
const sendActivationEmail = async (to, nombre, token) => {
    const activationUrl = `${process.env.FRONTEND_URL}/activate/${token}`;

    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject: 'Activa tu cuenta — Clínica Dental',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2>¡Hola ${nombre}!</h2>
            <p>Se ha creado una cuenta para ti en el sistema de la Clínica Dental.</p>
            <p>Haz clic en el siguiente botón para activar tu cuenta:</p>
            <a href="${activationUrl}"
                style="display: inline-block; background: #2563eb; color: white;
                    padding: 12px 24px; border-radius: 6px; text-decoration: none;
                    margin: 16px 0;">
                Activar mi cuenta
            </a>
            <p style="color: #666; font-size: 14px;">
            Este enlace expira en ${process.env.ACTIVATION_TOKEN_HOURS || 24} horas.
            </p>
        </div>
    `
    });
};

module.exports = { sendActivationEmail };