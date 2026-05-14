const { Router }               = require('express');
const { verifyToken, activate } = require('../controllers/activation.controller');

const router = Router();

// GET  /api/auth/activate/:token  → validar token y devolver datos del usuario
router.get('/:token', verifyToken);

// POST /api/auth/activate          → { token, DNI, password } → activar cuenta
router.post('/', activate);

module.exports = router;
