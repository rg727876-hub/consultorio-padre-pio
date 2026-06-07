const { Router }    = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const {
  register,
  search,
  list,
  getById,
  update,
  deactivate,
  reactivate,
} = require('../controllers/patient.controller');

const router = Router();

// ── Helper de roles ──────────────────────────────────────────────
const recepOAdmin = checkRole('RECEPCIONISTA', 'ADMINISTRADOR');

// ── Rutas ─────────────────────────────────────────────────────────

// Búsqueda rápida (autocomplete en AgendarCita, etc.)
// GET /api/patients/search?q=xxx
router.get('/search', verifyToken, recepOAdmin, search);

// Listado paginado con filtros (HU-011 — módulo Gestión de Pacientes)
// GET /api/patients?q=xxx&estado=ACTIVO&page=1
router.get('/', verifyToken, recepOAdmin, list);

// Detalle del paciente + historial de citas (sin datos clínicos)
// GET /api/patients/:id
router.get('/:id', verifyToken, recepOAdmin, getById);

// Registro de nuevo paciente
// POST /api/patients
router.post('/', verifyToken, recepOAdmin, register);

// Editar datos personales (nombre, apellido, contacto…)
// NO modifica tipo_documento ni numero_documento
// PUT /api/patients/:id
router.put('/:id', verifyToken, recepOAdmin, update);

// Desactivar + cancelar citas futuras en transacción
// RECEPCIONISTA y ADMINISTRADOR pueden desactivar
// PATCH /api/patients/:id/deactivate
router.patch('/:id/deactivate', verifyToken, recepOAdmin, deactivate);

// Reactivar paciente
// PATCH /api/patients/:id/reactivate
router.patch('/:id/reactivate', verifyToken, recepOAdmin, reactivate);

module.exports = router;
