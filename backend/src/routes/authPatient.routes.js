const { Router } = require('express');
const { register } = require('../controllers/authPatient.controller');

const router = Router();

// POST /api/auth/patient/register  — Registro de cuenta web (público)
router.post('/register', register);

// POST /api/auth/patient/login  — TODO: implementar en HU002
// router.post('/login', login);

module.exports = router;
