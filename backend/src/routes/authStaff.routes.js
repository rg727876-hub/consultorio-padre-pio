const { Router } = require('express');
const { login }  = require('../controllers/authStaff.controller');

const router = Router();

// POST /api/auth/staff/login
router.post('/login', login);

module.exports = router;
