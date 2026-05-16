const { Router }    = require('express');
const { getAll, create } = require('../controllers/service.controller');
const { verifyToken }    = require('../middlewares/auth.middleware');
const { checkRole }      = require('../middlewares/role.middleware');

const router = Router();

// GET /api/services      — cualquier staff autenticado
router.get('/', verifyToken, getAll);

// POST /api/services     — solo ADMINISTRADOR
router.post('/', verifyToken, checkRole('ADMINISTRADOR'), create);

module.exports = router;
