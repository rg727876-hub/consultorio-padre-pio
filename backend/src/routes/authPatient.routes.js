const { Router } = require('express');
const authPatientController = require('../controllers/authPatient.controller');

const router = Router();

// POST /api/auth/patient/login
router.post('/login', authPatientController.login);

// POST /api/auth/patient/register
router.post('/register', authPatientController.register);

// POST /api/auth/patient/link
router.post('/link', authPatientController.linkAccount);

module.exports = router;
