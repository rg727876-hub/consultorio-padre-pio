const { Router } = require('express');
const { patientAuth } = require('../middlewares/patientAuth.middleware');
const { getMiHistorial, registrarDescarga } = require('../controllers/patientHistorial.controller');

const router = Router();

// GET /api/mi-historial/:pacienteId  → historial clínico integral (solo lectura)
router.get('/:pacienteId', patientAuth, getMiHistorial);

// POST /api/mi-historial/:pacienteId/descarga  → auditar descarga/impresión PDF
router.post('/:pacienteId/descarga', patientAuth, registrarDescarga);

module.exports = router;
