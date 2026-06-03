const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const {
  generateComprobante,
  getByPagoId,
  sendEmail,
  voidComprobante,
} = require('../controllers/comprobante.controller');

const router = Router();
const cajeroAdmin = checkRole('CAJERO', 'ADMINISTRADOR');

// POST   /api/comprobantes              → Generar comprobante
router.post('/',                    verifyToken, cajeroAdmin, generateComprobante);

// GET    /api/comprobantes/payment/:id  → Obtener por pago_id
router.get('/payment/:pago_id',     verifyToken, cajeroAdmin, getByPagoId);

// POST   /api/comprobantes/:id/email    → Reenviar por correo
router.post('/:id/email',           verifyToken, cajeroAdmin, sendEmail);

// PUT    /api/comprobantes/:id/void     → Anular
router.put('/:id/void',             verifyToken, cajeroAdmin, voidComprobante);

module.exports = router;
