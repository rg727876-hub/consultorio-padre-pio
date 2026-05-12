const { Router } = require('express');
const router = Router();

// GET  /api/auth/activate/:token  → validar token y mostrar form
// POST /api/auth/activate          → completar activación (set password)
// TODO: router.get('/:token', activationController.validateToken);
// TODO: router.post('/', activationController.activateAccount);

module.exports = router;
