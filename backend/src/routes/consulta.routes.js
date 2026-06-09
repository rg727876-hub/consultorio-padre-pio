const { Router }      = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const {
  getContextoAtencion, crearAtencion,
} = require('../controllers/consulta.controller');

const router = Router();

// GET /api/consultas/cita/:citaId  → contexto de la atención (CA1) / lectura (CA7)
router.get('/cita/:citaId', verifyToken, checkRole('DOCTOR', 'ADMINISTRADOR'), getContextoAtencion);

// POST /api/consultas  → registrar la atención clínica (CA2/CA5/CA6/CA7)
router.post('/', verifyToken, checkRole('DOCTOR'), crearAtencion);

module.exports = router;
