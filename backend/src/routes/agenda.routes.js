const { Router }           = require('express');
const { verifyToken }      = require('../middlewares/auth.middleware');
const { checkRole }        = require('../middlewares/role.middleware');
const { getDisponibilidad, getResumenMes } = require('../controllers/agenda.controller');

const router = Router();

// GET /api/agenda/disponibilidad/:doctorId?fecha=YYYY-MM-DD
// Retorna la grilla de disponibilidad del doctor para un día concreto.
// Roles: RECEPCIONISTA, ADMINISTRADOR, DOCTOR
router.get(
  '/disponibilidad/:doctorId',
  verifyToken,
  checkRole('RECEPCIONISTA', 'ADMINISTRADOR', 'DOCTOR'),
  getDisponibilidad,
);

// GET /api/agenda/resumen-mes/:doctorId?anio=YYYY&mes=M
// Retorna el resumen por día del mes para la vista Mensual.
// Roles: RECEPCIONISTA, ADMINISTRADOR, DOCTOR
router.get(
  '/resumen-mes/:doctorId',
  verifyToken,
  checkRole('RECEPCIONISTA', 'ADMINISTRADOR', 'DOCTOR'),
  getResumenMes,
);

module.exports = router;
