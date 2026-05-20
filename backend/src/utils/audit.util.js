const pool = require('../config/db');

/**
 * Registra en tabla AUDITORIA
 * Campos: usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen
 */
const logAudit = async ({
    usuario_id = null,
    paciente_id = null,
    accion,
    entidad = null,
    entidad_id = null,
    detalles = null,
    ip_origen = null
}) => {
    try {
        await pool.execute(
            `INSERT INTO AUDITORIA
            (usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [usuario_id, paciente_id, accion, entidad, entidad_id, detalles, ip_origen]
    );
    } catch (err) {
        console.error('Error registrando auditoría:', err.message);
    }
};

module.exports = { logAudit };