const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const { registrar }   = require('../controllers/audit.controller');

const router = Router();

// POST /api/audit
// Registra una acción de UI en el log de auditoría.
// Roles: RECEPCIONISTA, ADMINISTRADOR, DOCTOR
router.post(
  '/',
  verifyToken,
  checkRole('RECEPCIONISTA', 'ADMINISTRADOR', 'DOCTOR'),
  registrar,
);

module.exports = router;
