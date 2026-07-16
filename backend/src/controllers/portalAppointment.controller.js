const pool             = require('../config/db');
const crypto            = require('crypto');
const familiarModel      = require('../models/familiar.model');
const comprobanteModel   = require('../models/comprobante.model');
const { emitirComprobante }              = require('../services/nubefact.service');
const mercadopago                         = require('../services/mercadopago.service');
const bookingHold                         = require('../utils/bookingHold.util');
const { logAudit }                        = require('../utils/audit.util');
const { sendAppointmentConfirmationEmail } = require('../utils/mailer.util');

const isDev = process.env.NODE_ENV !== 'production';

// Sede única del consultorio — no existe tabla SEDE, ver plan WEB-HU003.
const SEDE = 'Consultorio Padre Pio — Av. Ricardo Palma 679, Urb. Santo Dominguito 13007';

const BOLETA_SERIE = process.env.BOLETA_SERIE || 'B001';

// Máxima anticipación para reservar una cita online por el portal.
const DIAS_MAX_ANTICIPACION_RESERVA = 30;
const maxFechaReserva = () => {
  const max = new Date();
  max.setDate(max.getDate() + DIAS_MAX_ANTICIPACION_RESERVA);
  return max.toLocaleDateString('en-CA');
};

// ── Utilidades (copiadas deliberadamente de appointment.controller.js para no
//    acoplar este controller nuevo al de staff — ver plan WEB-HU003) ────────
const timeToMins = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const minsToTime = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const generateCode = () => crypto.randomBytes(5).toString('hex').toUpperCase();

// GET /api/portal/appointments/doctors?servicio_id=
const getDoctorsByService = async (req, res) => {
  const servicioId = Number(req.query.servicio_id);
  if (!servicioId || !Number.isInteger(servicioId))
    return res.status(400).json({ error: 'servicio_id inválido' });

  try {
    const [rows] = await pool.query(
      `SELECT u.usuario_id AS doctor_id,
              u.nombre, u.apellido, u.avatar,
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                 FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
                WHERE de.doctor_id = u.usuario_id) AS especialidad
       FROM   USUARIO u
       JOIN   DOCTOR d           ON d.doctor_id    = u.usuario_id
       JOIN   SERVICIO_DOCTOR sd ON sd.doctor_id   = u.usuario_id
       WHERE  sd.servicio_id = ? AND sd.estado = 'ACTIVO'
         AND  u.estado = 'ACTIVO'
       ORDER  BY u.apellido, u.nombre`,
      [servicioId]
    );

    if (!rows.length)
      return res.status(404).json({ error: 'No hay doctores disponibles para este servicio.' });

    return res.json(rows);
  } catch (err) {
    console.error('[portalAppointment.getDoctorsByService]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/portal/appointments/slots?doctor_id=&servicio_id=&fecha=
// Misma lógica que appointment.controller.getSlots (horarios + buffer + citas
// existentes) más el filtro de slots retenidos por un hold vigente de otro
// paciente. Duplicado deliberado — ver plan WEB-HU003.
const getAvailability = async (req, res) => {
  const doctorId   = Number(req.query.doctor_id);
  const servicioId = Number(req.query.servicio_id);
  const { fecha }  = req.query;

  if (!doctorId || !servicioId || !fecha)
    return res.status(400).json({ error: 'Parámetros requeridos: doctor_id, servicio_id, fecha' });

  const hoy = new Date().toLocaleDateString('en-CA');
  if (fecha < hoy)
    return res.status(400).json({ error: 'La fecha no puede ser en el pasado' });
  if (fecha > maxFechaReserva())
    return res.status(400).json({ error: `Solo se puede reservar con hasta ${DIAS_MAX_ANTICIPACION_RESERVA} días de anticipación` });

  const DIAS = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
  const [y, m, d] = fecha.split('-').map(Number);
  const diaSemana = DIAS[new Date(y, m - 1, d).getDay()];
  if (diaSemana === 'DOMINGO')
    return res.json({ slots: [] });

  try {
    const [horarios] = await pool.query(
      `SELECT TIME_FORMAT(hora_inicio,'%H:%i') AS hora_inicio,
              TIME_FORMAT(hora_fin,   '%H:%i') AS hora_fin
       FROM   HORARIO
       WHERE  doctor_id = ? AND dia_semana = ? AND estado = 'ACTIVO'
       ORDER  BY hora_inicio`,
      [doctorId, diaSemana]
    );
    if (!horarios.length) return res.json({ slots: [] });

    const [[servicioNuevo]] = await pool.query(
      `SELECT duracion, buffer FROM SERVICIO
       WHERE  servicio_id = ? AND estado = 'ACTIVO'`,
      [servicioId]
    );
    if (!servicioNuevo) return res.status(404).json({ error: 'Servicio no encontrado' });

    const [booked] = await pool.query(
      `SELECT
        TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
        TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
        s.buffer AS service_buffer
       FROM   CITA c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       WHERE  c.doctor_id = ? AND c.fecha = ?
         AND  UPPER(c.estado) IN ('RESERVADA','CONFIRMADA')
       ORDER BY c.hora_inicio`,
      [doctorId, fecha]
    );

    const STEP = 5;
    const slots = [];

    let ahoraMins = -1;
    if (fecha === hoy) {
      const ahora = new Date();
      ahoraMins = ahora.getHours() * 60 + ahora.getMinutes();
    }

    for (const h of horarios) {
      let cur = timeToMins(h.hora_inicio);
      const end = timeToMins(h.hora_fin);

      while (cur + servicioNuevo.duracion <= end) {
        const slotInicio = cur;
        const slotFin = cur + servicioNuevo.duracion;
        const slotFinConBuffer = slotFin + servicioNuevo.buffer;

        if (ahoraMins >= 0 && slotInicio < ahoraMins) {
          cur += STEP;
          continue;
        }

        const horaInicioStr = minsToTime(slotInicio);

        const overlaps = booked.some(b => {
          const bookedInicio = timeToMins(b.hi);
          const bookedFin = timeToMins(b.hf);
          const bookedFinConBuffer = bookedFin + b.service_buffer;
          return (slotInicio < bookedFinConBuffer && slotFinConBuffer > bookedInicio);
        });

        if (!overlaps && !bookingHold.isSlotHeld(doctorId, null, fecha, horaInicioStr)) {
          slots.push({ hora_inicio: horaInicioStr, hora_fin: minsToTime(slotFin) });
        }

        cur += STEP;
      }
    }

    return res.json({ slots });
  } catch (err) {
    console.error('[portalAppointment.getAvailability]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/portal/appointments/hold
const createHoldHandler = async (req, res) => {
  const titularId = req.paciente.id;
  const { paciente_id, doctor_id, servicio_id, fecha, hora_inicio } = req.body;

  if (!paciente_id || !doctor_id || !servicio_id || !fecha || !hora_inicio)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  const hoy = new Date().toLocaleDateString('en-CA');
  if (fecha < hoy)
    return res.status(400).json({ error: 'La fecha no puede ser en el pasado' });
  if (fecha > maxFechaReserva())
    return res.status(400).json({ error: `Solo se puede reservar con hasta ${DIAS_MAX_ANTICIPACION_RESERVA} días de anticipación` });

  try {
    if (Number(paciente_id) !== titularId) {
      const esFamiliar = await familiarModel.esFamiliarActivo(titularId, Number(paciente_id));
      if (!esFamiliar)
        return res.status(403).json({ error: 'El paciente indicado no está vinculado a tu cuenta.' });
    }

    const [[servicio]] = await pool.query(
      `SELECT duracion, buffer FROM SERVICIO WHERE servicio_id = ? AND estado = 'ACTIVO'`,
      [Number(servicio_id)]
    );
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado o inactivo' });

    const hora_fin = minsToTime(timeToMins(hora_inicio) + servicio.duracion);

    if (bookingHold.isSlotHeld(Number(doctor_id), Number(paciente_id), fecha, hora_inicio))
      return res.status(409).json({ error: 'Horario no disponible: ya estás reservando o alguien más está reservando este horario.' });

    const [existentes] = await pool.query(
      `SELECT TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
              TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
              s.buffer AS buffer,
              c.doctor_id,
              c.paciente_id
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       WHERE  (c.doctor_id = ? OR c.paciente_id = ?) AND c.fecha = ?
         AND  c.estado IN ('RESERVADA','CONFIRMADA')`,
      [Number(doctor_id), Number(paciente_id), fecha]
    );
    const nIni    = timeToMins(hora_inicio);
    const nFinBuf = timeToMins(hora_fin) + servicio.buffer;
    const conflicto = existentes.find(
      b => nIni < (timeToMins(b.hf) + (b.buffer || 0)) && nFinBuf > timeToMins(b.hi)
    );
    if (conflicto) {
      if (conflicto.paciente_id === Number(paciente_id)) {
        return res.status(409).json({ error: 'Ya tienes otra cita agendada que se cruza con este horario. Por favor, elige otro.' });
      } else {
        return res.status(409).json({ error: 'Ese horario ya no está disponible. Elige otro.' });
      }
    }

    const hold = bookingHold.createHold({
      titularId, pacienteId: Number(paciente_id), doctorId: Number(doctor_id),
      servicioId: Number(servicio_id), fecha, horaInicio: hora_inicio, horaFin: hora_fin,
    });
    if (!hold)
      return res.status(409).json({ error: 'Horario no disponible: otro paciente ya está reservando este horario.' });

    return res.status(201).json({
      hold_id:    hold.holdId,
      expires_at: new Date(hold.expiresAt).toISOString(),
      ttl_secs:   bookingHold.HOLD_TTL_MS / 1000,
    });
  } catch (err) {
    console.error('[portalAppointment.createHold]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/portal/appointments/hold/:holdId
const releaseHoldHandler = async (req, res) => {
  const { holdId } = req.params;
  const hold = bookingHold.getHold(holdId);
  if (hold && hold.titularId === req.paciente.id) {
    bookingHold.releaseHold(holdId);
  }
  return res.json({ message: 'Bloqueo liberado' });
};

// POST /api/portal/appointments/confirm-payment
// form_data: { token, payment_method_id?, payer } armado en el frontend con
// el SDK de MercadoPago (Secure Fields para tarjeta, mp.yape() para Yape) —
// el backend siempre fuerza monto, descripción y documento del pagador,
// nunca confía en el del cliente.
const confirmPayment = async (req, res) => {
  const titularId = req.paciente.id;
  const { hold_id, form_data, device_id } = req.body;

  if (!hold_id || !form_data)
    return res.status(400).json({ error: 'hold_id y form_data son requeridos' });

  const hold = bookingHold.getHold(hold_id);
  if (!hold)
    return res.status(408).json({ error: 'El tiempo de reserva expiró. Selecciona un nuevo horario.' });

  if (hold.titularId !== titularId)
    return res.status(403).json({ error: 'Este bloqueo de horario no pertenece a tu sesión.' });

  try {
    const [[servicio]] = await pool.query(
      `SELECT nombre, costo, buffer FROM SERVICIO WHERE servicio_id = ? AND estado = 'ACTIVO'`,
      [hold.servicioId]
    );
    if (!servicio)
      return res.status(404).json({ error: 'El servicio seleccionado ya no está disponible.' });

    // MercadoPago Perú suele requerir el documento del pagador para aprobar
    // el cobro (tarjeta/Yape) — se toma del titular logueado, nunca del cliente.
    const [[titular]] = await pool.query(
      `SELECT nombre, apellido, tipo_documento, numero_documento FROM PACIENTE WHERE paciente_id = ?`,
      [titularId]
    );

    // Re-verificación defensiva: el horario podría haberse ocupado por otra vía
    // (staff) entre el hold y el pago.
    const [existentes] = await pool.query(
      `SELECT TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
              TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
              s.buffer AS buffer
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       WHERE  c.doctor_id = ? AND c.fecha = ?
         AND  c.estado IN ('RESERVADA','CONFIRMADA')`,
      [hold.doctorId, hold.fecha]
    );
    const nIni    = timeToMins(hold.horaInicio);
    const nFinBuf = timeToMins(hold.horaFin) + servicio.buffer;
    const choca = existentes.some(
      b => nIni < (timeToMins(b.hf) + (b.buffer || 0)) && nFinBuf > timeToMins(b.hi)
    );
    if (choca) {
      bookingHold.releaseHold(hold_id);
      return res.status(409).json({ error: 'Este horario ya no está disponible. Selecciona un nuevo horario.' });
    }

    const monto = Number(servicio.costo);

    let paymentResult;
    try {
      paymentResult = await mercadopago.createPayment(form_data, {
        amount: monto,
        description: `Cita médica - ${servicio.nombre}`,
        payer: titular && {
          first_name: titular.nombre,
          last_name:  titular.apellido,
          identification: { type: titular.tipo_documento === 'CE' ? 'CE' : 'DNI', number: titular.numero_documento },
        },
        deviceId: device_id,
      });
    } catch (mpErr) {
      console.error('[portalAppointment.confirmPayment] MercadoPago error', mpErr.message);
      return res.status(502).json({ error: 'Error al procesar el pago. Intenta nuevamente.' });
    }

    const payment = paymentResult.payment;

    if (paymentResult.status !== 'approved') {
      const detail = payment.status_detail;
      return res.status(402).json({ error: mercadopago.mapRejectionMessage(detail) });
    }

    // ── Cita + Pago + Auditoría en una sola transacción ──────────────────
    let conn;
    let citaId;
    let codigo_cita;
    try {
      conn = await pool.getConnection();
      await conn.query('START TRANSACTION');

      // ── Prevenir Race Conditions entre Portal y Recepción ──
      await conn.query('SELECT 1 FROM PACIENTE WHERE paciente_id = ? FOR UPDATE', [Number(hold.pacienteId)]);
      await conn.query('SELECT 1 FROM USUARIO WHERE usuario_id = ? FOR UPDATE', [Number(hold.doctorId)]);

      // Re-verificar que el horario no haya sido ocupado (ej. por Recepción) mientras se pagaba
      const [[servicio]] = await conn.query('SELECT buffer FROM SERVICIO WHERE servicio_id = ?', [hold.servicioId]);
      const [existentes] = await conn.query(
        `SELECT TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
                TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
                s.buffer AS buffer,
                c.doctor_id,
                c.paciente_id
         FROM   CITA     c
         JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
         WHERE  (c.doctor_id = ? OR c.paciente_id = ?) AND c.fecha = ?
           AND  UPPER(c.estado) IN ('RESERVADA','CONFIRMADA')`,
        [Number(hold.doctorId), Number(hold.pacienteId), hold.fecha]
      );
      
      const nIni = timeToMins(hold.horaInicio);
      const nFinBuf = timeToMins(hold.horaFin) + (servicio?.buffer || 0);
      const conflicto = existentes.find(
        b => nIni < (timeToMins(b.hf) + (b.buffer || 0)) && nFinBuf > timeToMins(b.hi)
      );

      if (conflicto) {
        throw new Error('El horario fue ocupado durante el proceso de pago');
      }

      for (let i = 0; i < 5; i++) {
        const code = generateCode();
        const [[{ c }]] = await conn.query('SELECT COUNT(*) AS c FROM CITA WHERE codigo_cita = ?', [code]);
        if (c === 0) { codigo_cita = code; break; }
      }
      if (!codigo_cita) throw new Error('No se pudo generar un código único para la cita');

      const [citaResult] = await conn.query(
        `INSERT INTO CITA
         (paciente_id, titular_id, doctor_id, servicio_id, fecha, hora_inicio, hora_fin,
          precio_aplicado, codigo_cita, estado, creado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', 'PACIENTE_ONLINE')`,
        [
          hold.pacienteId, hold.titularId, hold.doctorId, hold.servicioId,
          hold.fecha, hold.horaInicio, hold.horaFin, monto, codigo_cita,
        ]
      );
      citaId = citaResult.insertId;

      await conn.query(
        `INSERT INTO PAGO
         (cita_id, monto_total, metodo_pago, pasarela_transaction_id, pasarela_status,
          pasarela_nombre, ultimos_4_tarjeta, marca_tarjeta, estado)
         VALUES (?, ?, 'TARJETA_ONLINE', ?, ?, 'MERCADOPAGO', ?, ?, 'COMPLETADO')`,
        [
          citaId, monto, String(payment.id), payment.status,
          payment.card?.last_four_digits || null, payment.payment_method_id || null,
        ]
      );

      await conn.query('COMMIT');
    } catch (dbErr) {
      if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
      console.error('[portalAppointment.confirmPayment] DB error tras pago aprobado', dbErr.message);

      // El cobro ya se hizo pero no se pudo guardar la cita: reembolso de emergencia.
      try {
        await mercadopago.refundPayment(payment.id);
        console.error(`[portalAppointment.confirmPayment] Pago ${payment.id} reembolsado tras fallo de BD`);
      } catch (refundErr) {
        console.error(`[portalAppointment.confirmPayment] CRÍTICO: no se pudo reembolsar el pago ${payment.id}`, refundErr.message);
      }

      return res.status(500).json({
        error: 'Ocurrió un error al confirmar tu reserva. El cargo fue anulado, no se te cobrará. Intenta nuevamente.',
        ...(isDev && { detail: dbErr.message }),
      });
    } finally {
      if (conn) conn.release();
    }

    bookingHold.releaseHold(hold_id);

    await logAudit({
      paciente_id: hold.pacienteId,
      accion:      'RESERVA_CITA_ONLINE',
      entidad:     'CITA',
      entidad_id:  citaId,
      detalles:    JSON.stringify({
        titular_id: hold.titularId, codigo_cita, monto,
        doctor_id: hold.doctorId, servicio_id: hold.servicioId,
        fecha: hold.fecha, hora_inicio: hold.horaInicio,
        mercadopago_payment_id: payment.id,
      }),
      ip_origen: req.ip,
    });

    const [[detalle]] = await pool.query(
      `SELECT c.cita_id, c.codigo_cita,
              DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
              c.precio_aplicado,
              CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre,
              pat.tipo_documento, pat.numero_documento, pat.email AS paciente_email,
              s.nombre AS servicio_nombre,
              CONCAT('Dr. ', u.apellido, ', ', u.nombre) AS doctor_nombre
       FROM   CITA     c
       JOIN   PACIENTE pat ON c.paciente_id = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id = s.servicio_id
       JOIN   USUARIO  u   ON c.doctor_id   = u.usuario_id
       WHERE  c.cita_id = ?`,
      [citaId]
    );

    // El correo del comprobante es el que el titular escribió en el checkout
    // (form_data.payer.email, ya validado por el <input type="email" required>
    // del frontend) — no el guardado en la BD del paciente atendido, que puede
    // no tener email propio si es un familiar registrado por el titular.
    const emailIngresado = String(form_data?.payer?.email || '').trim();
    if (emailIngresado) {
      detalle.paciente_email = emailIngresado;
    }

    // Comprobante y correo son best-effort e independientes entre sí: no deben
    // tumbar la respuesta de éxito (la cita y el pago ya están confirmados/cobrados),
    // y un fallo en uno no debe impedir el otro (ej. Nubefact caído no debe
    // bloquear el email de confirmación que el paciente sí necesita ver).
    (async () => {
      let nubefactResp = null;

      try {
        const numero = await comprobanteModel.getNextNumero(BOLETA_SERIE, Number(process.env.BOLETA_NUMERO_BASE || 0));
        nubefactResp = await emitirComprobante({
          tipo: 'BOLETA',
          serie: BOLETA_SERIE,
          numero,
          monto: detalle.precio_aplicado,
          descripcionServicio: detalle.servicio_nombre,
          clienteTipoDoc:  detalle.tipo_documento,
          clienteNumeroDoc: detalle.numero_documento,
          clienteNombre:   detalle.paciente_nombre,
          clienteEmail:    detalle.paciente_email,
          metodoPago:      'TARJETA_ONLINE',
        });

        const [pagoRow] = await pool.query('SELECT pago_id FROM PAGO WHERE cita_id = ?', [citaId]);
        const pago_id = pagoRow[0]?.pago_id;

        await comprobanteModel.create({
          pago_id,
          tipo_comprobante: 'BOLETA',
          serie: BOLETA_SERIE,
          numero,
          monto_final: detalle.precio_aplicado,
          subtotal_exonerado: detalle.precio_aplicado,
          igv: 0,
          nubefact_id:      nubefactResp.key || nubefactResp.hash || nubefactResp.codigo_hash || null,
          nubefact_cpe_url: nubefactResp.enlace_del_cdr || null,
          nubefact_pdf_url: nubefactResp.enlace_del_pdf || null,
          nubefact_hash:    nubefactResp.codigo_hash    || null,
          nubefact_aceptado_sunat: nubefactResp.aceptada_por_sunat ?? nubefactResp.accepted_by_sunat ?? null,
        });
      } catch (comprobanteErr) {
        console.error('[portalAppointment.confirmPayment] emisión de comprobante Nubefact falló', comprobanteErr.message);
      }

      if (detalle.paciente_email) {
        try {
          await sendAppointmentConfirmationEmail({
            paciente_email:   detalle.paciente_email,
            paciente_nombre:  detalle.paciente_nombre,
            codigo_cita:      detalle.codigo_cita,
            servicio_nombre:  detalle.servicio_nombre,
            doctor_nombre:    detalle.doctor_nombre,
            sede:             SEDE,
            fecha:             detalle.fecha,
            hora_inicio:      detalle.hora_inicio,
            precio_aplicado:  detalle.precio_aplicado,
            nubefact_pdf_url: nubefactResp?.enlace_del_pdf || null,
          });
        } catch (mailErr) {
          console.error('[portalAppointment.confirmPayment] envío de email de confirmación falló', mailErr.message);
        }
      } else {
        console.warn(`[portalAppointment.confirmPayment] cita ${citaId} sin email de paciente registrado, no se envió confirmación`);
      }
    })();

    return res.status(201).json({
      message:     `Reservaste con éxito la cita para ${detalle.paciente_nombre}`,
      codigo_cita: detalle.codigo_cita,
      cita_id:     citaId,
      resumen: {
        paciente: detalle.paciente_nombre,
        servicio: detalle.servicio_nombre,
        doctor:   detalle.doctor_nombre,
        sede:     SEDE,
        fecha:    detalle.fecha,
        hora:     detalle.hora_inicio,
        precio:   detalle.precio_aplicado,
      },
    });
  } catch (err) {
    console.error('[portalAppointment.confirmPayment]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// Utilidades compartidas por listar/anular/reprogramar (WEB-HU004)
// ─────────────────────────────────────────────────────────────────

// El titular puede operar sobre su propia cita o la de un familiar vinculado ACTIVO.
const puedeOperar = async (titularId, pacienteId) => {
  if (titularId === pacienteId) return true;
  return familiarModel.esFamiliarActivo(titularId, pacienteId);
};

const HORAS_ANTICIPACION_ANULAR = 24;

const esAnulable = (fecha, horaInicio) => {
  const fechaStr = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
  const citaMs = new Date(`${fechaStr}T${horaInicio}:00`).getTime();
  return citaMs - Date.now() >= HORAS_ANTICIPACION_ANULAR * 60 * 60 * 1000;
};

// GET /api/portal/appointments?paciente_id=&tipo=proximas|pagos
const getMisCitas = async (req, res) => {
  const titularId  = req.paciente.id;
  const pacienteId = Number(req.query.paciente_id);
  const tipo       = req.query.tipo === 'pagos' ? 'pagos' : 'proximas';

  if (!pacienteId || !Number.isInteger(pacienteId))
    return res.status(400).json({ error: 'paciente_id inválido' });

  try {
    if (!(await puedeOperar(titularId, pacienteId)))
      return res.status(403).json({ error: 'No autorizado para ver las citas de este paciente' });

    // "Mis pagos": toda cita con un pago COMPLETADO (sin importar su estado actual),
    // más reciente primero — permite ver si asistió, canceló, etc. y su comprobante.
    if (tipo === 'pagos') {
      const [rows] = await pool.query(
        `SELECT c.cita_id, c.codigo_cita,
                DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
                c.estado,
                s.nombre AS servicio_nombre,
                p.monto_total AS monto_pagado,
                (SELECT nubefact_pdf_url FROM COMPROBANTE
                  WHERE pago_id = p.pago_id ORDER BY comprobante_id DESC LIMIT 1) AS comprobante_url
         FROM   CITA     c
         JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
         JOIN   PAGO     p ON p.cita_id     = c.cita_id
         WHERE  c.paciente_id = ? AND p.estado = 'COMPLETADO'
         ORDER  BY c.fecha DESC, c.hora_inicio DESC`,
        [pacienteId]
      );
      return res.json({ citas: rows });
    }

    const [rows] = await pool.query(
      `SELECT c.cita_id, c.codigo_cita,
              DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
              TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
              c.estado, c.precio_aplicado,
              s.nombre AS servicio_nombre,
              CONCAT('Dr. ', u.apellido, ', ', u.nombre) AS doctor_nombre
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       JOIN   USUARIO  u ON u.usuario_id  = c.doctor_id
       WHERE  c.paciente_id = ? AND c.estado = 'CONFIRMADA'
       ORDER  BY c.fecha ASC, c.hora_inicio ASC`,
      [pacienteId]
    );

    const citas = rows.map((c) => ({ ...c, anulable: esAnulable(c.fecha, c.hora_inicio) }));

    return res.json({ citas });
  } catch (err) {
    console.error('[portalAppointment.getMisCitas]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/portal/appointments/:id
const getCitaDetalle = async (req, res) => {
  const titularId = req.paciente.id;
  const citaId    = Number(req.params.id);
  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });

  try {
    const [[cita]] = await pool.query(
      `SELECT c.cita_id, c.codigo_cita, c.paciente_id,
              DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
              TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
              c.estado, c.precio_aplicado, c.motivo_cancelacion, c.fecha_cancelacion,
              c.doctor_id, c.servicio_id,
              s.nombre AS servicio_nombre,
              CONCAT('Dr. ', u.apellido, ', ', u.nombre) AS doctor_nombre,
              CONCAT(pat.nombre,' ',pat.apellido) AS paciente_nombre
       FROM   CITA     c
       JOIN   SERVICIO s   ON s.servicio_id = c.servicio_id
       JOIN   USUARIO  u   ON u.usuario_id  = c.doctor_id
       JOIN   PACIENTE pat ON pat.paciente_id = c.paciente_id
       WHERE  c.cita_id = ?`,
      [citaId]
    );
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    if (!(await puedeOperar(titularId, cita.paciente_id)))
      return res.status(403).json({ error: 'No autorizado para ver esta cita' });

    const [[pago]] = await pool.query(
      `SELECT pago_id, metodo_pago, estado, monto_total, fecha_pago
       FROM   PAGO WHERE cita_id = ? ORDER BY pago_id DESC LIMIT 1`,
      [citaId]
    );

    let comprobante = null;
    if (pago) {
      const [[comp]] = await pool.query(
        `SELECT tipo_comprobante, serie, numero, nubefact_pdf_url
         FROM   COMPROBANTE WHERE pago_id = ? ORDER BY comprobante_id DESC LIMIT 1`,
        [pago.pago_id]
      );
      comprobante = comp ?? null;
    }

    return res.json({
      ...cita,
      anulable: cita.estado === 'CONFIRMADA' && esAnulable(cita.fecha, cita.hora_inicio),
      pago:        pago ?? null,
      comprobante,
    });
  } catch (err) {
    console.error('[portalAppointment.getCitaDetalle]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/portal/appointments/:id/cancel
const cancelarCita = async (req, res) => {
  const titularId = req.paciente.id;
  const citaId    = Number(req.params.id);
  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    const [[cita]] = await conn.query(
      `SELECT cita_id, paciente_id, codigo_cita, estado,
              DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(hora_inicio,'%H:%i') AS hora_inicio
       FROM   CITA WHERE cita_id = ? FOR UPDATE`,
      [citaId]
    );

    if (!cita) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (!(await puedeOperar(titularId, cita.paciente_id))) {
      await conn.query('ROLLBACK');
      return res.status(403).json({ error: 'No autorizado para anular esta cita' });
    }

    if (cita.estado !== 'CONFIRMADA') {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: `No se puede anular una cita en estado '${cita.estado}'.` });
    }

    if (!esAnulable(cita.fecha, cita.hora_inicio)) {
      await conn.query('ROLLBACK');
      return res.status(409).json({
        error: 'No es posible anular citas con menos de 24 horas de anticipación. Comunícate con el consultorio.',
      });
    }

    await conn.query(
      `UPDATE CITA
       SET    estado = 'CANCELADA', motivo_cancelacion = 'PACIENTE_VOLUNTARIO', fecha_cancelacion = NOW()
       WHERE  cita_id = ?`,
      [citaId]
    );

    await conn.query(
      `INSERT INTO AUDITORIA
         (usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen)
       VALUES (NULL, ?, 'ANULACION_CITA_PORTAL', 'CITA', ?, ?, ?)`,
      [
        cita.paciente_id, citaId,
        JSON.stringify({ titular_id: titularId, paciente_id: cita.paciente_id, codigo_cita: cita.codigo_cita, estado_previo: cita.estado }),
        req.ip ?? null,
      ]
    );

    await conn.query('COMMIT');

    return res.json({ message: 'Cita anulada correctamente', cita_id: citaId, codigo_cita: cita.codigo_cita, estado: 'CANCELADA' });
  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[portalAppointment.cancelarCita]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  } finally {
    if (conn) conn.release();
  }
};

// PATCH /api/portal/appointments/:id/reschedule
const reprogramarCita = async (req, res) => {
  const titularId = req.paciente.id;
  const citaId    = Number(req.params.id);
  const { nueva_fecha, nueva_hora_inicio } = req.body;

  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });
  if (!nueva_fecha || !nueva_hora_inicio)
    return res.status(400).json({ error: 'nueva_fecha y nueva_hora_inicio son requeridos' });

  const hoy = new Date().toLocaleDateString('en-CA');
  if (nueva_fecha < hoy)
    return res.status(400).json({ error: 'La fecha no puede ser en el pasado' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    const [[cita]] = await conn.query(
      `SELECT cita_id, paciente_id, codigo_cita, estado, doctor_id, servicio_id,
              DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
              TIME_FORMAT(hora_inicio,'%H:%i') AS hora_inicio,
              TIME_FORMAT(hora_fin,   '%H:%i') AS hora_fin
       FROM   CITA WHERE cita_id = ? FOR UPDATE`,
      [citaId]
    );

    if (!cita) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (!(await puedeOperar(titularId, cita.paciente_id))) {
      await conn.query('ROLLBACK');
      return res.status(403).json({ error: 'No autorizado para reprogramar esta cita' });
    }

    if (cita.estado !== 'CONFIRMADA') {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: `No se puede reprogramar una cita en estado '${cita.estado}'.` });
    }

    const [[servicio]] = await conn.query(
      `SELECT duracion, buffer FROM SERVICIO WHERE servicio_id = ?`,
      [cita.servicio_id]
    );
    if (!servicio) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'El servicio de esta cita ya no está disponible.' });
    }

    const nueva_hora_fin = minsToTime(timeToMins(nueva_hora_inicio) + servicio.duracion);

    const [otras] = await conn.query(
      `SELECT TIME_FORMAT(c.hora_inicio,'%H:%i') AS hi,
              TIME_FORMAT(c.hora_fin,   '%H:%i') AS hf,
              s.buffer AS buffer
       FROM   CITA     c
       JOIN   SERVICIO s ON s.servicio_id = c.servicio_id
       WHERE  c.doctor_id = ? AND c.fecha = ? AND c.cita_id <> ?
         AND  c.estado IN ('RESERVADA','CONFIRMADA')`,
      [cita.doctor_id, nueva_fecha, citaId]
    );
    const rIni    = timeToMins(nueva_hora_inicio);
    const rFinBuf = timeToMins(nueva_hora_fin) + servicio.buffer;
    const solapa = otras.some(
      b => rIni < (timeToMins(b.hf) + (b.buffer || 0)) && rFinBuf > timeToMins(b.hi)
    );
    if (solapa) {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: 'El horario solicitado se cruza con otra cita o su tiempo de limpieza (buffer).' });
    }

    await conn.query(
      `UPDATE CITA
       SET    fecha = ?, hora_inicio = ?, hora_fin = ?, veces_reprogramada = veces_reprogramada + 1
       WHERE  cita_id = ?`,
      [nueva_fecha, nueva_hora_inicio, nueva_hora_fin, citaId]
    );

    await conn.query(
      `INSERT INTO AUDITORIA
         (usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen)
       VALUES (NULL, ?, 'REPROGRAMACION_CITA_PORTAL', 'CITA', ?, ?, ?)`,
      [
        cita.paciente_id, citaId,
        JSON.stringify({
          titular_id: titularId, paciente_id: cita.paciente_id, codigo_cita: cita.codigo_cita,
          fecha_anterior: cita.fecha, hora_inicio_antes: cita.hora_inicio, hora_fin_antes: cita.hora_fin,
          nueva_fecha, nueva_hora_inicio, nueva_hora_fin,
        }),
        req.ip ?? null,
      ]
    );

    await conn.query('COMMIT');

    return res.json({
      message: 'Cita reprogramada correctamente',
      cita_id: citaId,
      codigo_cita: cita.codigo_cita,
      fecha: nueva_fecha,
      hora_inicio: nueva_hora_inicio,
      hora_fin: nueva_hora_fin,
    });
  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[portalAppointment.reprogramarCita]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor', ...(isDev && { detail: err.message }) });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  getDoctorsByService, getAvailability,
  createHold: createHoldHandler, releaseHold: releaseHoldHandler,
  confirmPayment,
  getMisCitas, getCitaDetalle, cancelarCita, reprogramarCita,
};
