const { Router } = require('express');
const { listar, registrar } = require('../controllers/patientFamilycontroller');
const { patientAuth } = require('../middlewares/patientAuth.middleware');

const router = Router();

// GET  /api/familiar          — Lista familiares del titular
router.get('/',           patientAuth, listar);

// POST /api/familiar/registrar — Registra o vincula un familiar
router.post('/registrar', patientAuth, registrar);

module.exports = router;
