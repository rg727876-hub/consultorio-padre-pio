const { Router }    = require('express');
const { getAll, getAdmin, create, update } = require('../controllers/service.controller');
const { verifyToken }    = require('../middlewares/auth.middleware');
const { checkRole }      = require('../middlewares/role.middleware');

const router = Router();

// GET /api/services      — cualquier staff autenticado (solo ACTIVOS)
router.get('/', verifyToken, getAll);

// GET /api/services/all  — solo ADMINISTRADOR (todos)
router.get('/all', verifyToken, checkRole('ADMINISTRADOR'), getAdmin);

// POST /api/services     — solo ADMINISTRADOR
router.post('/', verifyToken, checkRole('ADMINISTRADOR'), create);

// PUT /api/services/:id  — solo ADMINISTRADOR
router.put('/:id', verifyToken, checkRole('ADMINISTRADOR'), update);

module.exports = router;
