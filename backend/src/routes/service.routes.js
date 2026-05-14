const { Router } = require('express');
const { getAll } = require('../controllers/service.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/services  — requiere estar autenticado
router.get('/', verifyToken, getAll);

module.exports = router;
