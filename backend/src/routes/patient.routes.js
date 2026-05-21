const { Router }    = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');
const { register }  = require('../controllers/patient.controller');

const router = Router();

router.post('/', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), register);

module.exports = router;
