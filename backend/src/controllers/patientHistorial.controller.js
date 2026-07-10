const pool = require('../config/db');
const { esFamiliarActivo } = require('../models/familiar.model');
const { logAudit } = require('../utils/audit.util');

const isDev = process.env.NODE_ENV !== 'production';

const calcEdad = (fechaNac) => {
  if (!fechaNac) return null;
  const iso = fechaNac instanceof Date
    ? fechaNac.toISOString().slice(0, 10)
    : String(fechaNac).slice(0, 10);
  const dob = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - dob.getFullYear();
  const m = hoy.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < dob.getDate())) edad--;
  return edad;
};

// Campos completos de una atención (CONSULTA_CLINICA) + datos de la cita/servicio.
// Se excluyen únicamente los IDs técnicos (consulta_id se selecciona solo como key interna).
const CONSULTA_FIELDS = `
  cc.consulta_id, cc.fecha_atencion,
  cc.motivo_consulta,
  cc.presion_arterial, cc.pulso, cc.frecuencia_respiratoria, cc.temperatura,
  cc.enfermedad_actual, cc.enfermedad_inicio, cc.enfermedad_evolucion, cc.enfermedad_estado_actual,
  cc.examen_extraoral, cc.examen_intraoral,
  cc.diagnostico_presuntivo, cc.examenes_complementarios,
  cc.diagnostico_definitivo, cc.diagnostico_cie10,
  cc.plan_tratamiento, cc.prescripciones, cc.tratamiento_aplicado,
  cc.pronostico, cc.control_evolucion, cc.alta_paciente, cc.observaciones,
  cc.odontograma_url,
  CONCAT(du.nombre, ' ', du.apellido) AS doctor_nombre,
  s.nombre AS servicio_nombre`;

const CONSULTA_FROM = `
  FROM   CONSULTA_CLINICA cc
  JOIN   CITA     ci ON ci.cita_id     = cc.cita_id
  JOIN   SERVICIO s  ON s.servicio_id  = ci.servicio_id
  LEFT JOIN USUARIO du ON du.usuario_id = cc.firmado_por_doctor_id`;

// Un titular puede ver su propio historial o el de un familiar vinculado ACTIVO (CA-12)
const puedeVer = async (titular_id, pacienteId) => {
  if (titular_id === pacienteId) return true;
  return esFamiliarActivo(titular_id, pacienteId);
};

// ─────────────────────────────────────────────────────────────────
// GET /api/mi-historial/:pacienteId  (rol PACIENTE)
// Historial clínico integral (solo lectura) del titular o de un familiar
// vinculado activo. Registra la consulta en AUDITORIA.
// ─────────────────────────────────────────────────────────────────
const getMiHistorial = async (req, res) => {
  const titular_id = req.paciente.id;
  const pacienteId = Number(req.params.pacienteId);
  if (!pacienteId || !Number.isInteger(pacienteId))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    if (!(await puedeVer(titular_id, pacienteId)))
      return res.status(403).json({ error: 'No autorizado para ver este historial clínico' });

    const [[paciente]] = await pool.query(
      `SELECT paciente_id, nombre, apellido,
              DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento
       FROM   PACIENTE WHERE paciente_id = ?`,
      [pacienteId]
    );
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    const [[historia]] = await pool.query(
      `SELECT hc.antecedentes_sistemicos, hc.antecedentes_estomatologicos,
              hc.antecedentes_farmacologicos, hc.antecedentes_familiares,
              hc.antecedentes_otros, hc.alergias,
              hc.fecha_creacion, hc.fecha_actualizacion,
              CONCAT(dc.nombre, ' ', dc.apellido) AS creado_por_nombre,
              CONCAT(da.nombre, ' ', da.apellido) AS actualizado_por_nombre
       FROM   HISTORIA_CLINICA hc
       LEFT JOIN USUARIO dc ON dc.usuario_id = hc.creado_por_doctor_id
       LEFT JOIN USUARIO da ON da.usuario_id = hc.actualizado_por_doctor_id
       WHERE  hc.paciente_id = ? LIMIT 1`,
      [pacienteId]
    );

    const [atenciones] = await pool.query(
      `SELECT ${CONSULTA_FIELDS}
       ${CONSULTA_FROM}
       WHERE  ci.paciente_id = ?
       ORDER  BY cc.fecha_atencion DESC`,
      [pacienteId]
    );

    await logAudit({
      paciente_id: titular_id,
      accion:      'CONSULTA_HISTORIAL_PORTAL',
      entidad:     'HISTORIA_CLINICA',
      entidad_id:  pacienteId,
      detalles:    JSON.stringify({ titular_id, paciente_id: pacienteId, atenciones: atenciones.length }),
      ip_origen:   req.ip,
    });

    return res.json({
      paciente: {
        ...paciente,
        nombre_completo: `${paciente.nombre} ${paciente.apellido}`,
        edad: calcEdad(paciente.fecha_nacimiento),
      },
      antecedentes: historia ?? null,
      atenciones,
    });
  } catch (err) {
    console.error('[patientHistorial.getMiHistorial]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/mi-historial/:pacienteId/descarga  (rol PACIENTE)
// Registra en AUDITORIA la descarga/impresión del historial en PDF.
// ─────────────────────────────────────────────────────────────────
const registrarDescarga = async (req, res) => {
  const titular_id = req.paciente.id;
  const pacienteId = Number(req.params.pacienteId);
  if (!pacienteId || !Number.isInteger(pacienteId))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    if (!(await puedeVer(titular_id, pacienteId)))
      return res.status(403).json({ error: 'No autorizado para ver este historial clínico' });

    await logAudit({
      paciente_id: titular_id,
      accion:      'DESCARGA_HISTORIAL_PORTAL',
      entidad:     'HISTORIA_CLINICA',
      entidad_id:  pacienteId,
      detalles:    JSON.stringify({ titular_id, paciente_id: pacienteId, formato: 'PDF' }),
      ip_origen:   req.ip,
    });

    return res.status(201).json({ message: 'Descarga registrada' });
  } catch (err) {
    console.error('[patientHistorial.registrarDescarga]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getMiHistorial, registrarDescarga };
