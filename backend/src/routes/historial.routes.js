const { Router }      = require('express');
const pool            = require('../config/db');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const {
  buscarPacientes, getHistorialPaciente, registrarDescarga,
} = require('../controllers/historial.controller');

const router = Router();

// ─────────────────────────────────────────────────────────────────
// Middleware: confirma contra ROL_USUARIO que el usuario realmente
// tiene el rol DOCTOR antes de permitir el acceso al historial.
// (El JWT trae el rol activo; esta verificación va directo a la BD
//  según lo exige la historia de usuario.)
// ─────────────────────────────────────────────────────────────────
const ensureDoctorEnBD = async (req, res, next) => {
  try {
    const [[fila]] = await pool.query(
      `SELECT 1
         FROM ROL_USUARIO ru
         JOIN ROL r ON r.rol_id = ru.rol_id
        WHERE ru.usuario_id = ? AND r.nombre_rol = 'DOCTOR'
        LIMIT 1`,
      [req.user?.id]
    );
    if (!fila)
      return res.status(403).json({ error: 'Solo el personal médico (Doctor) puede acceder al historial clínico' });
    return next();
  } catch (err) {
    console.error('[historial.ensureDoctorEnBD]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const soloDoctor = [verifyToken, checkRole('DOCTOR'), ensureDoctorEnBD];

// GET /api/historial/buscar?q=...  → buscar paciente (documento / nombres / apellidos)
router.get('/buscar', soloDoctor, buscarPacientes);

// GET /api/historial/paciente/:pacienteId  → historial integral (solo lectura)
router.get('/paciente/:pacienteId', soloDoctor, getHistorialPaciente);

// POST /api/historial/paciente/:pacienteId/descarga  → auditar descarga PDF
router.post('/paciente/:pacienteId/descarga', soloDoctor, registrarDescarga);

module.exports = router;
