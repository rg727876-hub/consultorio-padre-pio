const { Router }           = require('express');
const { verifyToken }      = require('../middlewares/auth.middleware');
const { checkRole }        = require('../middlewares/role.middleware');
const { getDisponibilidad } = require('../controllers/agenda.controller');

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

module.exports = router;
