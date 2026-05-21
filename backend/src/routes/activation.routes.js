const { Router }                       = require('express');
const { verifyToken, activate, verifyDni } = require('../controllers/activation.controller');

const router = Router();

// GET  /api/auth/activate/:token       → validar token y devolver datos del usuario
router.get('/:token', verifyToken);

// POST /api/auth/activate/verify-dni   → { token, DNI } → verificar DNI (sin activar)
router.post('/verify-dni', verifyDni);

// POST /api/auth/activate              → { token, DNI, password } → activar cuenta
router.post('/', activate);

module.exports = router;
