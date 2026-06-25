const pool = require('../config/db');

// Busca paciente por documento con todos los campos necesarios para los subcasos
const findByDoc = async (tipo_documento, numero_documento) => {
  const [[row]] = await pool.query(
    `SELECT paciente_id, nombre, apellido, fecha_nacimiento, estado_cuenta
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

// Lista familiares activos del titular
const getFamiliares = async (titular_id) => {
  const [rows] = await pool.query(
    `SELECT p.paciente_id, p.nombre, p.apellido,
            p.tipo_documento, p.numero_documento,
            p.fecha_nacimiento, p.sexo,
            pf.relacion_id, pf.parentesco
     FROM   PACIENTE_FAMILIAR pf
     JOIN   PACIENTE p ON p.paciente_id = pf.familiar_id
     WHERE  pf.titular_id = ? AND pf.estado = 'ACTIVO'
     ORDER  BY p.nombre, p.apellido`,
    [titular_id]
  );
  return rows;
};

module.exports = {
  findByDoc, findTitularDoc, createPacienteFamiliar,
  findRelacion, createRelacion, marcarComoFamiliar, getFamiliares,
};
