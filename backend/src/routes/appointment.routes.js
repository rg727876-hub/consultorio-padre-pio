const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const { getSlots, create, list, getById } = require('../controllers/appointment.controller');

const router = Router();

// GET /api/appointments/slots?doctor_id=X&servicio_id=Y&fecha=YYYY-MM-DD
router.get('/slots', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), getSlots);

// GET /api/appointments  → listar/buscar/filtrar citas (paginado)
router.get('/', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), list);

// GET /api/appointments/:id  → detalle completo de una cita
router.get('/:id', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), getById);

// POST /api/appointments
router.post('/', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), create);

module.exports = router;
