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
        CONCAT(p.nombre, ' ', p.apellido)              AS paciente_nombre,
        p.tipo_documento,
        p.numero_documento,
        p.telefono                                  AS paciente_telefono,
        p.email                                     AS paciente_email,
        s.nombre                                    AS servicio_nombre,
        CONCAT('Dr. ', u.apellido, ', ', u.nombre)    AS doctor_nombre,
        (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
           FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
          WHERE de.doctor_id = d.doctor_id) AS especialidad
      FROM  CITA     c
      JOIN  PACIENTE p ON c.paciente_id = p.paciente_id
      JOIN  SERVICIO s ON c.servicio_id  = s.servicio_id
      JOIN  DOCTOR   d ON c.doctor_id    = d.doctor_id
      JOIN  USUARIO  u ON d.doctor_id    = u.usuario_id
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

  if (['YAPE', 'PLIN'].includes(metodo_pago)) {
    if (!numero_operacion || !/^\d{6,8}$/.test(numero_operacion)) {
      return res.status(400).json({ error: 'Número de operación inválido (debe tener entre 6 y 8 dígitos numéricos)' });
    }
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

    // ── Integridad financiera ────────────────────────────────────────────
    // El precio es el que dicta el servidor (precio_aplicado de la cita), no el
    // cliente. Se rechaza cualquier monto que no cubra exactamente ese precio,
    // evitando manipulación del importe desde el navegador.
    const precioReal = Number(cita.precio_aplicado);
    const montoRecibido = Number(monto_total);
    if (!Number.isFinite(precioReal) || precioReal <= 0) {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: 'La cita no tiene un precio válido asignado' });
    }
    // Tolerancia de 1 céntimo por redondeo de punto flotante.
    if (Math.abs(montoRecibido - precioReal) > 0.01) {
      await conn.query('ROLLBACK');
      return res.status(400).json({
        error: `El monto no coincide con el precio de la cita (S/ ${precioReal.toFixed(2)})`,
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
        precioReal,                 // monto autoritativo del servidor, no del cliente
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

// GET /api/payments?fecha_inicio=&fecha_fin=&page=1
// Lista pagos COMPLETADOS con estado de comprobante para el cajero
const getPayments = async (req, res) => {
  const { fecha_inicio, fecha_fin, page = 1 } = req.query;
  const limit  = 20;
  const offset = (Number(page) - 1) * limit;

  let dateFilter = '';
  const params   = [];

  if (fecha_inicio && fecha_fin) {
    dateFilter = 'AND DATE(p.fecha_pago) BETWEEN ? AND ?';
    params.push(fecha_inicio, fecha_fin);
  } else if (fecha_inicio) {
    dateFilter = 'AND DATE(p.fecha_pago) >= ?';
    params.push(fecha_inicio);
  } else if (fecha_fin) {
    dateFilter = 'AND DATE(p.fecha_pago) <= ?';
    params.push(fecha_fin);
  }

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM PAGO p
       JOIN COMPROBANTE comp ON comp.pago_id = p.pago_id AND comp.estado = 'EMITIDO'
       WHERE p.estado = 'COMPLETADO' ${dateFilter}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT
         p.pago_id,
         p.monto_total,
         p.metodo_pago,
         p.fecha_pago,
         c.cita_id,
         c.codigo_cita,
         c.fecha          AS cita_fecha,
         TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
         CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
         pat.tipo_documento,
         pat.numero_documento,
         pat.email        AS paciente_email,
         s.nombre         AS servicio_nombre,
         comp.comprobante_id,
         comp.tipo_comprobante,
         comp.serie,
         comp.numero,
         comp.estado      AS comprobante_estado,
         comp.nubefact_pdf_url
       FROM   PAGO     p
       JOIN   CITA     c   ON p.cita_id     = c.cita_id
       JOIN   PACIENTE pat ON c.paciente_id  = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id  = s.servicio_id
       JOIN   COMPROBANTE comp ON comp.pago_id = p.pago_id
                              AND comp.estado = 'EMITIDO'
       WHERE  p.estado = 'COMPLETADO' ${dateFilter}
       ORDER  BY p.fecha_pago DESC
       LIMIT  ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data:  rows,
      total: Number(total),
      page:  Number(page),
      pages: Math.ceil(Number(total) / limit),
    });
  } catch (err) {
    console.error('[payment.getPayments]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/payments/:id
// Detalle de un pago con datos para generar comprobante
const getPaymentById = async (req, res) => {
  const { id } = req.params;
  try {
    const [[pago]] = await pool.query(
      `SELECT
         p.pago_id,
         p.monto_total,
         p.metodo_pago,
         p.fecha_pago,
         p.estado         AS pago_estado,
         c.cita_id,
         c.codigo_cita,
         c.fecha          AS cita_fecha,
         TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
         TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
         CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
         pat.tipo_documento,
         pat.numero_documento,
         pat.email        AS paciente_email,
         pat.telefono     AS paciente_telefono,
         s.nombre         AS servicio_nombre,
         CONCAT('Dr. ', u.apellido, ', ', u.nombre) AS doctor_nombre,
         comp.comprobante_id,
         comp.tipo_comprobante,
         comp.serie,
         comp.numero,
         comp.estado      AS comprobante_estado,
         comp.nubefact_pdf_url,
         comp.nubefact_cpe_url
       FROM   PAGO     p
       JOIN   CITA     c   ON p.cita_id     = c.cita_id
       JOIN   PACIENTE pat ON c.paciente_id  = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id  = s.servicio_id
       JOIN   DOCTOR   d   ON c.doctor_id    = d.doctor_id
       JOIN   USUARIO  u   ON d.doctor_id    = u.usuario_id
       LEFT JOIN COMPROBANTE comp ON comp.pago_id = p.pago_id
                                  AND comp.estado = 'EMITIDO'
       WHERE  p.pago_id = ?`,
      [Number(id)]
    );

    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(pago);
  } catch (err) {
    console.error('[payment.getPaymentById]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { searchAppointment, registerPayment, getPayments, getPaymentById };
