const pool = require('../config/db');

// Busca paciente por documento con todos los campos necesarios para los subcasos
const findByDoc = async (tipo_documento, numero_documento) => {
  const [[row]] = await pool.query(
    `SELECT paciente_id, nombre, apellido, fecha_nacimiento, sexo, estado_cuenta
     FROM   PACIENTE
     WHERE  tipo_documento = ? AND numero_documento = ?`,
    [tipo_documento, numero_documento]
  );
  return row ?? null;
};

// Obtiene documento del titular para comparar con el familiar
const findTitularDoc = async (paciente_id) => {
  const [[row]] = await pool.query(
    `SELECT tipo_documento, numero_documento FROM PACIENTE WHERE paciente_id = ?`,
    [paciente_id]
  );
  return row ?? null;
};

// Crea paciente nuevo con estado FAMILIAR
const createPacienteFamiliar = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO PACIENTE
     (nombre, apellido, tipo_documento, numero_documento,
      fecha_nacimiento, sexo, contacto_emergencia, estado_cuenta, fecha_creacion_cuenta)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'FAMILIAR', NOW())`,
    [
      data.nombre, data.apellido, data.tipo_documento, data.numero_documento,
      data.fecha_nacimiento, data.sexo, data.contacto_emergencia ?? null,
    ]
  );
  return result.insertId;
};

// Busca relación titular-familiar (activa o inactiva)
const findRelacion = async (titular_id, familiar_id) => {
  const [[row]] = await pool.query(
    `SELECT relacion_id, estado FROM PACIENTE_FAMILIAR
     WHERE  titular_id = ? AND familiar_id = ?`,
    [titular_id, familiar_id]
  );
  return row ?? null;
};

// Crea relación titular-familiar en PACIENTE_FAMILIAR
const createRelacion = async (titular_id, familiar_id, parentesco) => {
  await pool.query(
    `INSERT INTO PACIENTE_FAMILIAR (titular_id, familiar_id, parentesco)
     VALUES (?, ?, ?)`,
    [titular_id, familiar_id, parentesco]
  );
};

// Cambia estado del paciente a FAMILIAR (subcaso B1)
const marcarComoFamiliar = async (paciente_id) => {
  await pool.query(
    `UPDATE PACIENTE SET estado_cuenta = 'FAMILIAR' WHERE paciente_id = ?`,
    [paciente_id]
  );
};

// Lista familiares activos del titular — ordenados por vinculación más reciente primero
const getFamiliares = async (titular_id) => {
  const [rows] = await pool.query(
    `SELECT p.paciente_id, p.nombre, p.apellido,
            p.tipo_documento, p.numero_documento,
            p.fecha_nacimiento, p.sexo,
            pf.relacion_id, pf.parentesco, pf.fecha_vinculacion
     FROM   PACIENTE_FAMILIAR pf
     JOIN   PACIENTE p ON p.paciente_id = pf.familiar_id
     WHERE  pf.titular_id = ? AND pf.estado = 'ACTIVO'
     ORDER  BY pf.fecha_vinculacion DESC`,
    [titular_id]
  );
  return rows;
};

// Devuelve el perfil completo de un familiar validando relación ACTIVA con el titular
const getFamiliarDetalle = async (titular_id, familiar_id) => {
  const [[row]] = await pool.query(
    `SELECT p.paciente_id, p.nombre, p.apellido,
            p.tipo_documento, p.numero_documento, p.fecha_nacimiento,
            p.sexo, p.telefono, p.direccion, p.ocupacion, p.contacto_emergencia,
            pf.relacion_id, pf.parentesco, pf.fecha_vinculacion
     FROM   PACIENTE_FAMILIAR pf
     JOIN   PACIENTE p ON p.paciente_id = pf.familiar_id
     WHERE  pf.titular_id = ? AND pf.familiar_id = ? AND pf.estado = 'ACTIVO'`,
    [titular_id, familiar_id]
  );
  return row ?? null;
};

// Desvincula un familiar: marca la relación como INACTIVO y registra fecha
const desvincularRelacion = async (titular_id, familiar_id) => {
  const [result] = await pool.query(
    `UPDATE PACIENTE_FAMILIAR
     SET estado = 'INACTIVO', fecha_desvinculacion = NOW()
     WHERE  titular_id = ? AND familiar_id = ? AND estado = 'ACTIVO'`,
    [titular_id, familiar_id]
  );
  return result.affectedRows;
};

// Verifica si existe relación ACTIVA titular-familiar (para autorizar acceso a datos del familiar)
const esFamiliarActivo = async (titular_id, familiar_id) => {
  const [[row]] = await pool.query(
    `SELECT 1 FROM PACIENTE_FAMILIAR
     WHERE  titular_id = ? AND familiar_id = ? AND estado = 'ACTIVO'
     LIMIT  1`,
    [titular_id, familiar_id]
  );
  return !!row;
};

// Titulares con relación ACTIVA hacia este paciente (para notificarlos al activar su cuenta propia, WEB-HU009)
const getTitularesActivos = async (familiar_id) => {
  const [rows] = await pool.query(
    `SELECT p.paciente_id, p.nombre, p.apellido, p.email_cuenta
     FROM   PACIENTE_FAMILIAR pf
     JOIN   PACIENTE p ON p.paciente_id = pf.titular_id
     WHERE  pf.familiar_id = ? AND pf.estado = 'ACTIVO'`,
    [familiar_id]
  );
  return rows;
};

// Desvincula TODAS las relaciones activas donde el paciente es el familiar
// (activación de cuenta propia, WEB-HU009: deja de estar bajo control de sus titulares)
const desvincularTodasComoFamiliar = async (familiar_id) => {
  await pool.query(
    `UPDATE PACIENTE_FAMILIAR
     SET estado = 'INACTIVO', fecha_desvinculacion = NOW()
     WHERE  familiar_id = ? AND estado = 'ACTIVO'`,
    [familiar_id]
  );
};

// Actualiza info de contacto de un familiar (teléfono, dirección, ocupación, emergencia)
const updateFamiliarInfo = async (familiar_id, data) => {
  await pool.query(
    `UPDATE PACIENTE
     SET telefono = ?, direccion = ?, ocupacion = ?, contacto_emergencia = ?
     WHERE paciente_id = ?`,
    [
      data.telefono           ?? null,
      data.direccion          ?? null,
      data.ocupacion          ?? null,
      data.contacto_emergencia ?? null,
      familiar_id,
    ]
  );
};

module.exports = {
  findByDoc, findTitularDoc, createPacienteFamiliar,
  findRelacion, createRelacion, marcarComoFamiliar,
  getFamiliares, getFamiliarDetalle, desvincularRelacion, updateFamiliarInfo,
  esFamiliarActivo, getTitularesActivos, desvincularTodasComoFamiliar,
};
