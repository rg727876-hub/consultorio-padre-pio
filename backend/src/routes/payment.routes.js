const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const {
  searchAppointment,
  registerPayment,
  getPayments,
  getPaymentById,
} = require('../controllers/payment.controller');

const router    = Router();
const cajeroAdmin = checkRole('CAJERO', 'ADMINISTRADOR');

// GET  /api/payments                          → Listar pagos (con estado comprobante)
router.get('/',                     verifyToken, cajeroAdmin, getPayments);

// GET  /api/payments/search-appointment?q=   → Buscar cita RESERVADA para cobrar
router.get('/search-appointment',   verifyToken, cajeroAdmin, searchAppointment);

// GET  /api/payments/:id                      → Detalle de un pago
router.get('/:id',                  verifyToken, cajeroAdmin, getPaymentById);

// POST /api/payments                          → Registrar pago
router.post('/',                    verifyToken, cajeroAdmin, registerPayment);

module.exports = router;
