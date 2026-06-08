const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const {
  getSlots, create, list, getById, agenda, marcarNoAsistio, cancel,
  lockSlot, unlockSlot, reschedule,
} = require('../controllers/appointment.controller');

const router = Router();

// GET /api/appointments/slots?doctor_id=X&servicio_id=Y&fecha=YYYY-MM-DD
router.get('/slots', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), getSlots);

// GET /api/appointments/agenda  → agenda del doctor logueado (vistas/filtros)
router.get('/agenda', verifyToken, checkRole('DOCTOR'), agenda);

// GET /api/appointments  → listar/buscar/filtrar citas (paginado)
router.get('/', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), list);

// GET /api/appointments/:id  → detalle completo de una cita
router.get('/:id', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), getById);

// PUT /api/appointments/:id/no-asistio  → marcar como NO_ASISTIO (doctor)
router.put('/:id/no-asistio', verifyToken, checkRole('DOCTOR'), marcarNoAsistio);

// PATCH /api/appointments/:id/cancel  → cancelar cita RESERVADA o CONFIRMADA
router.patch('/:id/cancel', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), cancel);

// POST /api/appointments/:id/lock  → bloquea temporalmente un slot (10 min) para reprogramar
router.post('/:id/lock', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), lockSlot);

// POST /api/appointments/:id/unlock  → libera el bloqueo manualmente (usuario cancela)
router.post('/:id/unlock', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), unlockSlot);

// PATCH /api/appointments/:id/reschedule  → reprogramar: nueva fecha/hora (PIO-30)
router.patch('/:id/reschedule', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), reschedule);

// POST /api/appointments
router.post('/', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), create);

module.exports = router;
