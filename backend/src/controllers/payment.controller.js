const pool = require('../config/db');

// GET /api/payments/search-appointment?q=:term
// Busca citas en estado RESERVADA por código, nombre de paciente o número de documento
const searchAppointment = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Ingresa al menos 2 caracteres para buscar' });
  }

  const term = q.trim();

  try {
    const [rows] = await pool.query(
      `SELECT
        c.cita_id,
        c.codigo_cita,
        c.fecha,
        TIME_FORMAT(c.hora_inicio, '%H:%i') AS hora_inicio,
        TIME_FORMAT(c.hora_fin,    '%H:%i') AS hora_fin,
        c.precio_aplicado,
        c.estado,
        c.fecha_creacion,
        CONCAT(p.nombre, ' ', p.apellido)          AS paciente_nombre,
        p.tipo_documento,
        p.numero_documento,
        p.telefono                                  AS paciente_telefono,
        s.nombre                                    AS servicio_nombre,
        CONCAT('Dr. ', d.apellido, ', ', d.nombre)  AS doctor_nombre,
        d.especialidad
      FROM  CITA     c
      JOIN  PACIENTE p ON c.paciente_id = p.paciente_id
      JOIN  SERVICIO s ON c.servicio_id  = s.servicio_id
      JOIN  DOCTOR   d ON c.doctor_id    = d.doctor_id
      WHERE c.estado = 'RESERVADA'
        AND (
          c.codigo_cita         = ?
          OR p.numero_documento = ?
          OR CONCAT(p.nombre, ' ', p.apellido) LIKE ?
        )
      ORDER BY c.fecha_creacion DESC
      LIMIT 10`,
      [term.toUpperCase(), term, `%${term}%`]
    );

    res.json(rows);
  } catch (err) {
    console.error('[payment.searchAppointment]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/payments
// Registra el pago de una cita RESERVADA y la actualiza a CONFIRMADA
const registerPayment = async (req, res) => {
  const {
    cita_id,
    metodo_pago,
    monto_total,
    cambio            = 0,
    numero_operacion  = null,
    ultimos_4_tarjeta = null,
    marca_tarjeta     = null,
  } = req.body;

  if (!cita_id || !metodo_pago || monto_total == null) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const METODOS_VALIDOS = ['YAPE', 'EFECTIVO', 'TARJETA_PRESENCIAL', 'PLIN'];
  if (!METODOS_VALIDOS.includes(metodo_pago)) {
    return res.status(400).json({ error: 'Método de pago no válido' });
  }

  if (Number(monto_total) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    // Bloquear la fila para evitar pagos duplicados concurrentes
    const [[cita]] = await conn.query(
      `SELECT cita_id, estado, precio_aplicado, codigo_cita, paciente_id
       FROM CITA WHERE cita_id = ? FOR UPDATE`,
      [Number(cita_id)]
    );

    if (!cita) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (cita.estado !== 'RESERVADA') {
      await conn.query('ROLLBACK');
      return res.status(409).json({
        error: `La cita no se puede pagar. Estado actual: ${cita.estado}`,
      });
    }

    const [[existingPago]] = await conn.query(
      `SELECT pago_id FROM PAGO WHERE cita_id = ?`,
      [Number(cita_id)]
    );
    if (existingPago) {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta cita ya tiene un pago registrado' });
    }

    // Insertar pago
    const [pagoResult] = await conn.query(
      `INSERT INTO PAGO
         (cita_id, usuario_id, monto_total, metodo_pago, cambio,
          numero_operacion, ultimos_4_tarjeta, marca_tarjeta, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADO')`,
      [
        Number(cita_id),
        req.user?.id    ?? null,
        Number(monto_total),
        metodo_pago,
        Number(cambio),
        numero_operacion  || null,
        ultimos_4_tarjeta || null,
        marca_tarjeta     || null,
      ]
    );

    // Actualizar cita a CONFIRMADA
    await conn.query(
      `UPDATE CITA SET estado = 'CONFIRMADA' WHERE cita_id = ?`,
      [Number(cita_id)]
    );

    await conn.query('COMMIT');

    res.status(201).json({
      message:     'Pago registrado. Cita confirmada.',
      pago_id:     pagoResult.insertId,
      codigo_cita: cita.codigo_cita,
    });

  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[payment.registerPayment]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { searchAppointment, registerPayment };
