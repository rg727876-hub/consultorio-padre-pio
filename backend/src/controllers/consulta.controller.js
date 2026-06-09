const pool         = require('../config/db');
const { logAudit } = require('../utils/audit.util');

const isDev = process.env.NODE_ENV !== 'production';

// Campos clínicos obligatorios (sigue la ficha oficial: vitales + motivo + dx)
const CAMPOS_OBLIGATORIOS = [
  ['motivo_consulta',         'Motivo de consulta'],
  ['presion_arterial',        'Presión arterial (P.A)'],
  ['pulso',                   'Pulso'],
  ['frecuencia_respiratoria', 'Frecuencia respiratoria (F.R)'],
  ['temperatura',             'Temperatura (T)'],
  ['diagnostico_presuntivo',  'Diagnóstico presuntivo'],
  ['diagnostico_definitivo',  'Diagnóstico definitivo (CIE-10)'],
];

const esVacio = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

const limpio = (v) => (esVacio(v) ? null : String(v).trim());

// ─────────────────────────────────────────────────────────────────
// GET /api/consultas/cita/:citaId   (rol DOCTOR / ADMINISTRADOR)
// CA1: abre el contexto de la atención. Devuelve datos de filiación del
// paciente, antecedentes de su HISTORIA_CLINICA (para revisar/actualizar)
// y, si ya existe, la consulta clínica completa (solo lectura — CA7).
// ─────────────────────────────────────────────────────────────────
const getContextoAtencion = async (req, res) => {
  const citaId = Number(req.params.citaId);
  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });

  try {
    const [[cita]] = await pool.query(
      `SELECT
         c.cita_id, c.codigo_cita, c.fecha, c.doctor_id, c.paciente_id, c.estado,
         TIME_FORMAT(c.hora_inicio,'%H:%i') AS hora_inicio,
         TIME_FORMAT(c.hora_fin,   '%H:%i') AS hora_fin,
         pat.nombre AS paciente_nombre, pat.apellido AS paciente_apellido,
         pat.tipo_documento, pat.numero_documento, pat.sexo, pat.fecha_nacimiento,
         pat.direccion, pat.ocupacion, pat.telefono AS paciente_telefono,
         pat.contacto_emergencia, pat.email AS paciente_email,
         s.nombre AS servicio_nombre,
         CONCAT(u.nombre,' ',u.apellido) AS doctor_nombre,
         (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
            FROM DOCTOR_ESPECIALIDAD de JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
           WHERE de.doctor_id = d.doctor_id) AS especialidad
       FROM   CITA     c
       JOIN   PACIENTE pat ON c.paciente_id = pat.paciente_id
       JOIN   SERVICIO s   ON c.servicio_id = s.servicio_id
       JOIN   USUARIO  u   ON c.doctor_id   = u.usuario_id
       LEFT JOIN DOCTOR d  ON d.doctor_id   = u.usuario_id
       WHERE  c.cita_id = ?`,
      [citaId]
    );

    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    if (req.user?.rol === 'DOCTOR' && cita.doctor_id !== req.user.id)
      return res.status(403).json({ error: 'No puede acceder a citas de otro doctor' });

    // Antecedentes del paciente (HISTORIA_CLINICA, 1 por paciente)
    const [[antecedentes]] = await pool.query(
      `SELECT antecedentes_sistemicos, antecedentes_estomatologicos,
              antecedentes_farmacologicos, antecedentes_familiares,
              antecedentes_otros, alergias
       FROM   HISTORIA_CLINICA WHERE paciente_id = ? LIMIT 1`,
      [cita.paciente_id]
    );

    // Atención clínica existente (si la cita ya fue atendida)
    const [[consulta]] = await pool.query(
      `SELECT
         cc.consulta_id, cc.motivo_consulta,
         cc.presion_arterial, cc.pulso, cc.frecuencia_respiratoria, cc.temperatura,
         cc.enfermedad_inicio, cc.enfermedad_evolucion, cc.enfermedad_estado_actual,
         cc.examen_extraoral, cc.examen_intraoral,
         cc.diagnostico_presuntivo, cc.examenes_complementarios,
         cc.diagnostico_definitivo, cc.diagnostico_cie10,
         cc.plan_tratamiento, cc.tratamiento_aplicado, cc.prescripciones,
         cc.pronostico, cc.control_evolucion, cc.alta_paciente, cc.observaciones,
         cc.fecha_atencion,
         CONCAT(du.nombre,' ',du.apellido) AS firmado_por
       FROM   CONSULTA_CLINICA cc
       LEFT JOIN USUARIO du ON cc.firmado_por_doctor_id = du.usuario_id
       WHERE  cc.cita_id = ?
       LIMIT  1`,
      [citaId]
    );

    return res.json({
      cita,
      antecedentes: antecedentes ?? null,
      consulta:     consulta ?? null,
    });
  } catch (err) {
    console.error('[consulta.getContextoAtencion]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/consultas   (rol DOCTOR)
// Registra la atención según la Historia Clínica Odontológica oficial.
//   · Antecedentes → HISTORIA_CLINICA (se crea/actualiza, 1 por paciente).
//   · Datos de la visita → CONSULTA_CLINICA (inmutable, INSERT-only — CA7).
//   · CA5: valida campos obligatorios.  CA6: cita CONFIRMADA → ATENDIDA.
// ─────────────────────────────────────────────────────────────────
const crearAtencion = async (req, res) => {
  const doctorId = req.user?.id;
  const b = req.body;
  const citaId = Number(b.cita_id);

  if (!citaId || !Number.isInteger(citaId))
    return res.status(400).json({ error: 'ID de cita inválido' });

  // CA5 — campos obligatorios
  const faltantes = CAMPOS_OBLIGATORIOS
    .filter(([campo]) => esVacio(b[campo]))
    .map(([, label]) => label);
  if (faltantes.length)
    return res.status(400).json({ error: 'Faltan campos clínicos obligatorios', faltantes });

  // Temperatura: validación numérica suave
  const tempNum = Number(b.temperatura);
  if (Number.isNaN(tempNum) || tempNum < 30 || tempNum > 45)
    return res.status(400).json({ error: 'Temperatura inválida (°C). Use un valor entre 30 y 45.' });

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query('START TRANSACTION');

    // 1. Bloquear cita + validaciones
    const [[cita]] = await conn.query(
      `SELECT cita_id, doctor_id, paciente_id, estado, codigo_cita
       FROM   CITA WHERE cita_id = ? FOR UPDATE`,
      [citaId]
    );
    if (!cita) {
      await conn.query('ROLLBACK');
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    if (cita.doctor_id !== doctorId) {
      await conn.query('ROLLBACK');
      return res.status(403).json({ error: 'No puede atender citas de otro doctor' });
    }
    if (cita.estado !== 'CONFIRMADA') {
      await conn.query('ROLLBACK');
      return res.status(409).json({
        error: cita.estado === 'ATENDIDA'
          ? 'Esta cita ya fue atendida'
          : `Solo se pueden atender citas confirmadas (estado actual: ${cita.estado})`,
      });
    }

    const [[{ ya }]] = await conn.query(
      'SELECT COUNT(*) AS ya FROM CONSULTA_CLINICA WHERE cita_id = ?', [citaId]
    );
    if (ya > 0) {
      await conn.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta cita ya tiene una atención registrada' });
    }

    // 2. HISTORIA_CLINICA del paciente: crear o actualizar antecedentes
    const [[historia]] = await conn.query(
      'SELECT historia_id FROM HISTORIA_CLINICA WHERE paciente_id = ? LIMIT 1',
      [cita.paciente_id]
    );
    let historiaId = historia?.historia_id;
    if (!historiaId) {
      const [hc] = await conn.query(
        `INSERT INTO HISTORIA_CLINICA
           (paciente_id, antecedentes_sistemicos, antecedentes_estomatologicos,
            antecedentes_farmacologicos, antecedentes_familiares, antecedentes_otros,
            alergias, creado_por_doctor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cita.paciente_id,
          limpio(b.antecedentes_sistemicos), limpio(b.antecedentes_estomatologicos),
          limpio(b.antecedentes_farmacologicos), limpio(b.antecedentes_familiares),
          limpio(b.antecedentes_otros), limpio(b.alergias),
          doctorId,
        ]
      );
      historiaId = hc.insertId;
    } else {
      await conn.query(
        `UPDATE HISTORIA_CLINICA
           SET antecedentes_sistemicos      = ?,
               antecedentes_estomatologicos = ?,
               antecedentes_farmacologicos  = ?,
               antecedentes_familiares      = ?,
               antecedentes_otros           = ?,
               alergias                     = ?,
               actualizado_por_doctor_id    = ?
         WHERE historia_id = ?`,
        [
          limpio(b.antecedentes_sistemicos), limpio(b.antecedentes_estomatologicos),
          limpio(b.antecedentes_farmacologicos), limpio(b.antecedentes_familiares),
          limpio(b.antecedentes_otros), limpio(b.alergias),
          doctorId, historiaId,
        ]
      );
    }

    // 3. INSERT de la consulta (inmutable)
    const [ins] = await conn.query(
      `INSERT INTO CONSULTA_CLINICA
        (cita_id, historia_id, motivo_consulta,
         presion_arterial, pulso, frecuencia_respiratoria, temperatura,
         enfermedad_inicio, enfermedad_evolucion, enfermedad_estado_actual,
         examen_extraoral, examen_intraoral,
         diagnostico_presuntivo, examenes_complementarios,
         diagnostico_definitivo, diagnostico_cie10,
         plan_tratamiento, tratamiento_aplicado, prescripciones,
         pronostico, control_evolucion, alta_paciente, observaciones,
         firmado_por_doctor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        citaId, historiaId, limpio(b.motivo_consulta),
        limpio(b.presion_arterial), limpio(b.pulso), limpio(b.frecuencia_respiratoria), tempNum,
        limpio(b.enfermedad_inicio), limpio(b.enfermedad_evolucion), limpio(b.enfermedad_estado_actual),
        limpio(b.examen_extraoral), limpio(b.examen_intraoral),
        limpio(b.diagnostico_presuntivo), limpio(b.examenes_complementarios),
        limpio(b.diagnostico_definitivo), limpio(b.diagnostico_cie10),
        limpio(b.plan_tratamiento), limpio(b.tratamiento_aplicado), limpio(b.prescripciones),
        limpio(b.pronostico), limpio(b.control_evolucion), limpio(b.alta_paciente), limpio(b.observaciones),
        doctorId,
      ]
    );

    // 4. La cita pasa a ATENDIDA (CA6)
    await conn.query("UPDATE CITA SET estado = 'ATENDIDA' WHERE cita_id = ?", [citaId]);

    // 5. Auditoría dentro de la transacción
    await conn.query(
      `INSERT INTO AUDITORIA
         (usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen)
       VALUES (?, ?, 'REGISTRO_ATENCION', 'CONSULTA_CLINICA', ?, ?, ?)`,
      [
        doctorId, cita.paciente_id, ins.insertId,
        JSON.stringify({ cita_id: citaId, codigo_cita: cita.codigo_cita }),
        req.ip ?? null,
      ]
    );

    await conn.query('COMMIT');

    return res.status(201).json({
      message:     'Atención registrada correctamente',
      consulta_id: ins.insertId,
      cita_id:     citaId,
      estado_cita: 'ATENDIDA',
    });
  } catch (err) {
    if (conn) { try { await conn.query('ROLLBACK'); } catch (_) {} }
    console.error('[consulta.crearAtencion]', err.message);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'Esta cita ya tiene una atención registrada' });
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { getContextoAtencion, crearAtencion };
