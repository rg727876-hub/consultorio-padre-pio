const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const { register, search } = require('../controllers/patient.controller');

const router = Router();

router.get('/search', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), search);
router.post('/',      verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), register);

module.exports = router;
