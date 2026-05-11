const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
  secure: false, // true para 465, false para 587
        auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// Verificar conexión al iniciar
transporter.verify()
    .then(() => console.log('Servidor de email configurado'))
    .catch(err => console.warn('Email no configurado:', err.message));

module.exports = transporter;