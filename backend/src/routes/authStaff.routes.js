const { Router } = require('express');
const { login, reauthenticate } = require('../controllers/authStaff.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = Router();

// POST /api/auth/staff/login
router.post('/login', login);

// POST /api/auth/staff/reauthenticate — doble factor para zonas sensibles
router.post('/reauthenticate', verifyToken, reauthenticate);

module.exports = router;
