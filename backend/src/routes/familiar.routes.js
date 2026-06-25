const { Router } = require('express');
const { listar, registrar, getDetalle, actualizar, desvincular } = require('../controllers/patientFamilycontroller');
const { patientAuth } = require('../middlewares/patientAuth.middleware');

const router = Router();

// GET  /api/familiar              — Lista familiares activos del titular
router.get('/',                    patientAuth, listar);

// POST /api/familiar/registrar    — Registra o vincula un familiar (HU008)
router.post('/registrar',          patientAuth, registrar);

// GET  /api/familiar/:id          — Detalle de un familiar con validación de relación (HU010)
router.get('/:id',                 patientAuth, getDetalle);

// PATCH /api/familiar/:id         — Edita info de contacto del familiar (HU010)
router.patch('/:id',               patientAuth, actualizar);

// PATCH /api/familiar/:id/desvincular — Desvincula familiar del titular (HU010)
router.patch('/:id/desvincular',   patientAuth, desvincular);

module.exports = router;
