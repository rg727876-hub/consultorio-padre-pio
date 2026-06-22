const { Router } = require('express');
const { register, login, logout, preview, vincular } = require('../controllers/authPatient.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/auth/patient/register  — Registro de cuenta web (público)
router.post('/register', register);

// POST /api/auth/patient/login     — Login con documento + contraseña (público)
router.post('/login', login);

// POST /api/auth/patient/logout    — Cierre de sesión (requiere token, solo auditoría)
router.post('/logout', verifyToken, logout);

// POST /api/auth/patient/preview   — Datos anonimizados para reconocimiento (público)
router.post('/preview', preview);

// POST /api/auth/patient/vincular  — Vinculación de cuenta web con historial (público)
router.post('/vincular', vincular);

module.exports = router;
