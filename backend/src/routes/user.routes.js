const { Router }    = require('express');
const { register }  = require('../controllers/user.controller');
const { verifyToken: authMiddleware } = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');

const router = Router();

// POST /api/users  — solo administrador puede registrar usuarios
router.post('/', authMiddleware, checkRole('ADMINISTRADOR'), register);

module.exports = router;
