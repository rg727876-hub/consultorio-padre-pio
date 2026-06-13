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
    // 1. RESERVADA sin pago → EXPIRADA (pasados LIMITE_MIN desde su creación)
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

    // 2. CONFIRMADA cuya hora de fin ya pasó → NO_ASISTIO
    //    El doctor no registró atención (eso la habría puesto en ATENDIDA) ni
    //    marcó inasistencia, así que se asume que el paciente no llegó. El pago
    //    se mantiene (sin reembolso), igual que en la marca manual.
    //    fecha/hora_fin están en hora local del consultorio (Lima); se compara
    //    contra la hora actual de Lima para no adelantar/atrasar la transición.
    try {
      const ahoraLima = new Date().toLocaleString('sv-SE', { timeZone: 'America/Lima' });
      const [result] = await pool.execute(
        `UPDATE CITA
           SET estado = 'NO_ASISTIO'
         WHERE estado = 'CONFIRMADA'
           AND TIMESTAMP(fecha, hora_fin) < ?`,
        [ahoraLima]
      );

      if (result.affectedRows > 0) {
        console.log(`[CRON] ${result.affectedRows} cita(s) confirmada(s) vencida(s) marcada(s) como NO_ASISTIO`);
      }
    } catch (err) {
      console.error('[CRON] Error marcando citas como NO_ASISTIO:', err.message);
    }
  });

  console.log(`Jobs de citas iniciados: expiración de reservas (${LIMITE_MIN} min) y NO_ASISTIO automático, cada minuto`);
};

module.exports = { startCronJobs };
