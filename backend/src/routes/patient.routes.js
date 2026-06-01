const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const { register, search, getById, update } = require('../controllers/patient.controller');

const router = Router();

router.get('/search', verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), search);
router.post('/',      verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), register);
router.get('/:id',   verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), getById);
router.put('/:id',   verifyToken, checkRole('RECEPCIONISTA', 'ADMINISTRADOR'), update);

module.exports = router;
