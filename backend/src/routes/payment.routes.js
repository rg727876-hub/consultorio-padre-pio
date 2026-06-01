const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const { searchAppointment, registerPayment } = require('../controllers/payment.controller');

const router = Router();

// GET /api/payments/search-appointment?q=:term
router.get('/search-appointment', verifyToken, checkRole('CAJERO', 'ADMINISTRADOR'), searchAppointment);

// POST /api/payments
router.post('/', verifyToken, checkRole('CAJERO', 'ADMINISTRADOR'), registerPayment);

module.exports = router;
