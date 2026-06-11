const cron = require('node-cron');
const pool = require('../config/db');

// Minutos que una cita RESERVADA tiene para pagarse antes de expirar.
const LIMITE_MIN = Number(process.env.RESERVA_LIMITE_MIN) || 20;

/**
 * Job: Auto-expirar citas RESERVADAS no pagadas.
 *
 * Regla de negocio: al reservar, la cita queda en estado RESERVADA. Si no se
 * paga (no pasa a CONFIRMADA) dentro de LIMITE_MIN minutos desde su creación,
 * pasa a EXPIRADA y su horario se libera automáticamente (la columna generada
 * `slot_activo` vale NULL para estados distintos de RESERVADA/CONFIRMADA, así
 * que el slot vuelve a estar disponible para reservar).
 *
 * Se ejecuta cada minuto. fecha_creacion y NOW() están ambos en la hora del
 * servidor (UTC), por lo que la comparación es consistente.
 */
const startCronJobs = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const [result] = await pool.execute(
        `UPDATE CITA
           SET estado = 'EXPIRADA'
         WHERE estado = 'RESERVADA'
           AND fecha_creacion < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
        [LIMITE_MIN]
      );

      if (result.affectedRows > 0) {
        console.log(`[CRON] ${result.affectedRows} cita(s) expirada(s) por falta de pago (${LIMITE_MIN} min)`);
      }
    } catch (err) {
      console.error('[CRON] Error expirando citas:', err.message);
    }
  });

  console.log(`Job de expiración de citas iniciado (límite ${LIMITE_MIN} min, cada minuto)`);
};

module.exports = { startCronJobs };
