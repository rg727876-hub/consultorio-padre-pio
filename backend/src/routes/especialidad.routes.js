const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { getAll }      = require('../controllers/especialidad.controller');

const router = Router();

// GET /api/especialidades — cualquier staff autenticado
router.get('/', verifyToken, getAll);

module.exports = router;
