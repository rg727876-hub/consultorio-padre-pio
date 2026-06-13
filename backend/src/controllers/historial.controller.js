const pool = require('../config/db');

const isDev = process.env.NODE_ENV !== 'production';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const calcEdad = (fechaNac) => {
  if (!fechaNac) return null;
  // Acepta tanto string 'YYYY-MM-DD' como objeto Date que devuelve mysql2.
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

// Campos completos de una atención (CONSULTA_CLINICA) + datos de la cita/servicio
const CONSULTA_FIELDS = `
  cc.consulta_id, cc.cita_id, cc.fecha_atencion,
  cc.motivo_consulta,
  cc.presion_arterial, cc.pulso, cc.frecuencia_respiratoria, cc.temperatura,
  cc.enfermedad_actual, cc.enfermedad_inicio, cc.enfermedad_evolucion, cc.enfermedad_estado_actual,
  cc.examen_extraoral, cc.examen_intraoral,
  cc.diagnostico_presuntivo, cc.examenes_complementarios,
  cc.diagnostico_definitivo, cc.diagnostico_cie10,
  cc.plan_tratamiento, cc.tratamiento_aplicado, cc.prescripciones,
  cc.pronostico, cc.control_evolucion, cc.alta_paciente, cc.observaciones,
  cc.odontograma_url,
  CONCAT(du.nombre, ' ', du.apellido) AS firmado_por,
  s.nombre       AS servicio_nombre,
  ci.codigo_cita AS codigo_cita,
  ci.fecha       AS cita_fecha`;

const CONSULTA_FROM = `
  FROM   CONSULTA_CLINICA cc
  JOIN   CITA     ci ON ci.cita_id     = cc.cita_id
  JOIN   SERVICIO s  ON s.servicio_id  = ci.servicio_id
  LEFT JOIN USUARIO du ON du.usuario_id = cc.firmado_por_doctor_id`;

// ─────────────────────────────────────────────────────────────────
// GET /api/historial/buscar?q=texto   (rol DOCTOR)
// CA: buscar paciente por documento (DNI/CE/Pasaporte), nombres o apellidos.
// ─────────────────────────────────────────────────────────────────
const buscarPacientes = async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2)
    return res.status(400).json({ error: 'Ingrese al menos 2 caracteres para buscar' });

  const like = `%${q}%`;
  try {
    const [rows] = await pool.query(
      `SELECT paciente_id, nombre, apellido, tipo_documento, numero_documento,
              telefono, sexo,
              DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
              estado
       FROM   PACIENTE
       WHERE  numero_documento LIKE ?
          OR  nombre   LIKE ?
          OR  apellido LIKE ?
          OR  CONCAT(nombre, ' ', apellido) LIKE ?
       ORDER  BY apellido, nombre
       LIMIT  25`,
      [like, like, like, like]
    );

    return res.json({
      data: rows.map((p) => ({ ...p, edad: calcEdad(p.fecha_nacimiento) })),
    });
  } catch (err) {
    console.error('[historial.buscarPacientes]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/historial/paciente/:pacienteId   (rol DOCTOR)
// Historial clínico integral del paciente (SOLO LECTURA).
//   · Datos de filiación + edad calculada.
//   · Antecedentes generales (HISTORIA_CLINICA).
//   · Atenciones previas (CONSULTA_CLINICA) ordenadas por fecha desc.
// Registra la consulta en AUDITORIA.
// ─────────────────────────────────────────────────────────────────
const getHistorialPaciente = async (req, res) => {
  const pacienteId = Number(req.params.pacienteId);
  if (!pacienteId || !Number.isInteger(pacienteId))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    const [[paciente]] = await pool.query(
      `SELECT paciente_id, nombre, apellido, tipo_documento, numero_documento,
              telefono, sexo, direccion, ocupacion, contacto_emergencia,
              DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento
       FROM   PACIENTE WHERE paciente_id = ?`,
      [pacienteId]
    );
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    // Antecedentes (HISTORIA_CLINICA, 1 por paciente). Si no existe → nunca atendido.
    const [[historia]] = await pool.query(
      `SELECT historia_id, antecedentes_sistemicos, antecedentes_estomatologicos,
              antecedentes_farmacologicos, antecedentes_familiares,
              antecedentes_otros, alergias
       FROM   HISTORIA_CLINICA WHERE paciente_id = ? LIMIT 1`,
      [pacienteId]
    );
    const antecedentes = historia
      ? (({ historia_id, ...resto }) => resto)(historia)   // antecedentes sin el id
      : null;

    // Atenciones previas (orden descendente por fecha)
    const [atenciones] = await pool.query(
      `SELECT ${CONSULTA_FIELDS}
       ${CONSULTA_FROM}
       WHERE  ci.paciente_id = ?
       ORDER  BY cc.fecha_atencion DESC`,
      [pacienteId]
    );

    // Auditoría: CONSULTA del historial
    await pool.query(
      `INSERT INTO AUDITORIA
         (usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen)
       VALUES (?, ?, 'CONSULTA_HISTORIAL', 'HISTORIA_CLINICA', ?, ?, ?)`,
      [
        req.user?.id ?? null, pacienteId, pacienteId,
        JSON.stringify({ atenciones: atenciones.length }),
        req.ip ?? null,
      ]
    );

    return res.json({
      paciente: {
        ...paciente,
        nombre_completo: `${paciente.nombre} ${paciente.apellido}`,
        edad: calcEdad(paciente.fecha_nacimiento),
      },
      tiene_historia: !!historia,
      historia_id:    historia?.historia_id ?? null,
      antecedentes,
      atenciones,
    });
  } catch (err) {
    console.error('[historial.getHistorialPaciente]', err.message);
    return res.status(500).json({
      error: 'Error interno del servidor',
      ...(isDev && { detail: err.message }),
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/historial/paciente/:pacienteId/descarga   (rol DOCTOR)
// Registra en AUDITORIA la descarga del historial en PDF. El PDF se
// arma en el cliente (ventana de impresión); aquí solo se audita.
// ─────────────────────────────────────────────────────────────────
const registrarDescarga = async (req, res) => {
  const pacienteId = Number(req.params.pacienteId);
  if (!pacienteId || !Number.isInteger(pacienteId))
    return res.status(400).json({ error: 'ID de paciente inválido' });

  try {
    const [[paciente]] = await pool.query(
      'SELECT paciente_id FROM PACIENTE WHERE paciente_id = ?', [pacienteId]
    );
    if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    await pool.query(
      `INSERT INTO AUDITORIA
         (usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen)
       VALUES (?, ?, 'DESCARGA_HISTORIAL', 'HISTORIA_CLINICA', ?, ?, ?)`,
      [
        req.user?.id ?? null, pacienteId, pacienteId,
        JSON.stringify({ formato: 'PDF' }),
        req.ip ?? null,
      ]
    );

    return res.status(201).json({ message: 'Descarga registrada' });
  } catch (err) {
    console.error('[historial.registrarDescarga]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { buscarPacientes, getHistorialPaciente, registrarDescarga };
