const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Job: Auto-expirar citas RESERVADAS sin pago después de 24h
 * Ejecuta cada hora
 * Regla de negocio del documento del proyecto
 */
const startCronJobs = () => {
  // Cada hora: revisa citas RESERVADA con más de 24h
  cron.schedule('0 * * * *', async () => {
    try {
        const [result] = await pool.execute(
            `UPDATE CITA
            SET estado = 'EXPIRADA'
            WHERE estado = 'RESERVADA'
            AND fecha_creacion < DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        );

        if (result.affectedRows > 0) {
            console.log(`[CRON] ${result.affectedRows} cita(s) expirada(s)`);
        }
    } catch (err) {
        console.error('[CRON] Error expirando citas:', err.message);
    }
    });

    console.log('Jobs programados iniciados');
};

module.exports = { startCronJobs };