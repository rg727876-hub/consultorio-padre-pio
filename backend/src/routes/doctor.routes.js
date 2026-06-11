const { Router }      = require('express');
const { getActive, getByService, getDoctorProfile, updateDoctorProfile, updateDoctorStatus } = require('../controllers/doctor.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');

const router = Router();

// GET /api/doctors — cualquier staff autenticado
router.get('/', verifyToken, getActive);

// GET /api/doctors/by-service/:servicio_id
router.get('/by-service/:servicio_id', verifyToken, getByService);

// GET /api/doctors/:id/profile — solo ADMINISTRADOR
router.get('/:id/profile', verifyToken, checkRole('ADMINISTRADOR'), getDoctorProfile);

// PUT /api/doctors/:id — solo ADMINISTRADOR
router.put('/:id', verifyToken, checkRole('ADMINISTRADOR'), updateDoctorProfile);

// PUT /api/doctors/:id/status — solo ADMINISTRADOR
router.put('/:id/status', verifyToken, checkRole('ADMINISTRADOR'), updateDoctorStatus);

module.exports = router;
