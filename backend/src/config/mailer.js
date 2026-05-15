const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST,
  port:   Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Verificar conexión al iniciar
transporter.verify()
    .then(() => console.log('Servidor de email configurado'))
    .catch(err => console.warn('Email no configurado:', err.message));

module.exports = transporter;