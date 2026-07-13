const { Router } = require('express');
const { login, reauthenticate, forgotPassword, verifyResetToken, resetPassword } = require('../controllers/authStaff.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/auth/staff/login
router.post('/login', login);

// POST /api/auth/staff/reauthenticate — doble factor para zonas sensibles
router.post('/reauthenticate', verifyToken, reauthenticate);

// Rutas de recuperación de contraseña
router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', verifyResetToken);
router.post('/reset-password', resetPassword);

module.exports = router;
