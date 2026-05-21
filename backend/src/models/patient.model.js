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

module.exports = { create };
