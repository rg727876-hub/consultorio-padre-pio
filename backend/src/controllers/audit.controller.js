const { logAudit } = require('../utils/audit.util');

// ─────────────────────────────────────────────────────────────────
// POST /api/audit
//
// Registra en la tabla AUDITORIA acciones de UI que no pasan por un
// endpoint de negocio propio (ej. cambios de vista en la Agenda Médica).
//
// Las acciones se restringen a una lista blanca para evitar que el
// cliente inyecte registros arbitrarios en el log.
// ─────────────────────────────────────────────────────────────────
const ACCIONES_PERMITIDAS = new Set([
  'CAMBIO_VISTA_AGENDA',
  'CONSULTAR_DISPONIBILIDAD_UI',
  'FILTRAR_AGENDA',
]);

const registrar = async (req, res) => {
  const { accion, detalles } = req.body;

  if (!accion || !ACCIONES_PERMITIDAS.has(accion))
    return res.status(400).json({ error: 'Acción de auditoría no permitida' });

  await logAudit({
    usuario_id: req.user?.id ?? null,
    accion,
    entidad:    'AGENDA',
    detalles:   typeof detalles === 'string' ? detalles : JSON.stringify(detalles ?? {}),
    ip_origen:  req.ip,
  });

  return res.status(201).json({ message: 'Auditoría registrada' });
};

module.exports = { registrar };
