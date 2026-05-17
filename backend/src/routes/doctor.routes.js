const { Router }    = require('express');
const { getActive } = require('../controllers/doctor.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/doctors — cualquier staff autenticado
router.get('/', verifyToken, getActive);

module.exports = router;
