const pool = require('../config/db');

const create = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO PACIENTE
     (nombre, apellido, tipo_documento, numero_documento, telefono, sexo,
      email, fecha_nacimiento, direccion, ocupacion, contacto_emergencia,
      fecha_creacion_cuenta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.nombre,
      data.apellido,
      data.tipo_documento,
      data.numero_documento,
      data.telefono,
      data.sexo,
      data.email         ?? null,
      data.fecha_nacimiento ?? null,
      data.direccion     ?? null,
      data.ocupacion     ?? null,
      data.contacto_emergencia ?? null,
      new Date(),
    ]
  );
  return result.insertId;
};

const findByDocument = async (tipo_documento, numero_documento) => {
  const [[row]] = await pool.query(
    `SELECT paciente_id, estado_cuenta
     FROM   PACIENTE
     WHERE  tipo_documento = ? AND numero_documento = ?`,
    [tipo_documento, numero_documento]
  );
  return row ?? null;
};

const findByEmailCuenta = async (email_cuenta) => {
  const [[row]] = await pool.query(
    `SELECT paciente_id FROM PACIENTE WHERE email_cuenta = ?`,
    [email_cuenta]
  );
  return row ?? null;
};

const registerWebAccount = async (data) => {
  const [result] = await pool.query(
    `INSERT INTO PACIENTE
     (nombre, apellido, tipo_documento, numero_documento, telefono, sexo,
      email, email_cuenta, fecha_nacimiento, password_hash, estado_cuenta, fecha_creacion_cuenta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', NOW())`,
    [
      data.nombre,
      data.apellido,
      data.tipo_documento,
      data.numero_documento,
      data.telefono,
      data.sexo,
      data.email_cuenta,  // email operativo (comprobantes, notificaciones internas)
      data.email_cuenta,  // email_cuenta (login web, UNIQUE)
      data.fecha_nacimiento ?? null,
      data.password_hash,
    ]
  );
  return result.insertId;
};

const findByDocumentForLogin = async (tipo_documento, numero_documento) => {
  const [[row]] = await pool.query(
    `SELECT paciente_id, nombre, apellido, email_cuenta,
            password_hash, estado_cuenta,
            intentos_fallidos, bloqueado_hasta
     FROM   PACIENTE
     WHERE  tipo_documento = ? AND numero_documento = ?`,
    [tipo_documento, numero_documento]
  );
  return row ?? null;
};

const findProfileById = async (paciente_id) => {
  const [[row]] = await pool.query(
    `SELECT paciente_id, nombre, apellido, tipo_documento, numero_documento,
            fecha_nacimiento, sexo, email_cuenta,
            telefono, direccion, ocupacion, contacto_emergencia
     FROM   PACIENTE
     WHERE  paciente_id = ? AND estado_cuenta = 'ACTIVO'`,
    [paciente_id]
  );
  return row ?? null;
};

const updateContactInfo = async (paciente_id, { telefono, direccion, ocupacion, contacto_emergencia }) => {
  await pool.query(
    `UPDATE PACIENTE
     SET telefono = ?, direccion = ?, ocupacion = ?, contacto_emergencia = ?
     WHERE paciente_id = ?`,
    [telefono, direccion ?? null, ocupacion ?? null, contacto_emergencia ?? null, paciente_id]
  );
};

const findByDocumentPreview = async (tipo_documento, numero_documento) => {
  const [[row]] = await pool.query(
    `SELECT paciente_id, nombre, apellido, tipo_documento, numero_documento,
            fecha_nacimiento, estado_cuenta
     FROM   PACIENTE
     WHERE  tipo_documento = ? AND numero_documento = ?
       AND  estado_cuenta = 'SIN_CUENTA'`,
    [tipo_documento, numero_documento]
  );
  return row ?? null;
};

const linkWebAccount = async (paciente_id, { email_cuenta, password_hash }) => {
  await pool.query(
    `UPDATE PACIENTE
     SET email_cuenta = ?, email = ?, password_hash = ?,
         estado_cuenta = 'ACTIVO', intentos_fallidos = 0, bloqueado_hasta = NULL
     WHERE paciente_id = ?`,
    [email_cuenta, email_cuenta, password_hash, paciente_id]
  );
};

module.exports = {
  create, findByDocument, findByEmailCuenta, registerWebAccount,
  findByDocumentForLogin, findProfileById, updateContactInfo,
  findByDocumentPreview, linkWebAccount,
};
