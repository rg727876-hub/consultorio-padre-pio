const { Router }    = require('express');
const { getByDoctor, create, update, remove } = require('../controllers/schedule.controller');
const { verifyToken }  = require('../middlewares/auth.middleware');
const { checkRole }    = require('../middlewares/role.middleware');

const router = Router();

// GET /api/schedules?doctor_id=X — cualquier staff autenticado
router.get('/', verifyToken, getByDoctor);

// POST /api/schedules — solo ADMINISTRADOR
router.post('/', verifyToken, checkRole('ADMINISTRADOR'), create);

// PUT /api/schedules/:id — solo ADMINISTRADOR
router.put('/:id', verifyToken, checkRole('ADMINISTRADOR'), update);

// DELETE /api/schedules/:id — solo ADMINISTRADOR
router.delete('/:id', verifyToken, checkRole('ADMINISTRADOR'), remove);

module.exports = router;
