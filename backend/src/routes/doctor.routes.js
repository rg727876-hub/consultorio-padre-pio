const { Router }      = require('express');
const { getActive, getByService } = require('../controllers/doctor.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// GET /api/doctors — cualquier staff autenticado
router.get('/', verifyToken, getActive);

// GET /api/doctors/by-service/:servicio_id
router.get('/by-service/:servicio_id', verifyToken, getByService);

module.exports = router;
