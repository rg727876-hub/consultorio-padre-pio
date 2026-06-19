const { Router } = require('express');
const { register, login, logout } = require('../controllers/authPatient.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/auth/patient/register  — Registro de cuenta web (público)
router.post('/register', register);

// POST /api/auth/patient/login     — Login con documento + contraseña (público)
router.post('/login', login);

// POST /api/auth/patient/logout    — Cierre de sesión (requiere token, solo auditoría)
router.post('/logout', verifyToken, logout);

module.exports = router;
