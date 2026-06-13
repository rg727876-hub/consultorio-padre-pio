const { Router } = require('express');
const {
  register, list, getById, update, deactivate, reactivate, resendActivation, getActivity,
} = require('../controllers/user.controller');
const { verifyToken: authMiddleware } = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');

const router = Router();
const soloAdmin = checkRole('ADMINISTRADOR');

// GET /api/users  — listar/buscar personal (paginado)
router.get('/', authMiddleware, soloAdmin, list);

// GET /api/users/:id  — perfil completo del usuario
router.get('/:id', authMiddleware, soloAdmin, getById);

// GET /api/users/:id/activity  — historial de actividad (auditoría)
router.get('/:id/activity', authMiddleware, soloAdmin, getActivity);

// POST /api/users  — registrar usuario
router.post('/', authMiddleware, soloAdmin, register);

// PUT /api/users/:id  — editar datos de contacto
router.put('/:id', authMiddleware, soloAdmin, update);

// POST /api/users/:id/resend-activation  — reenviar correo de activación
router.post('/:id/resend-activation', authMiddleware, soloAdmin, resendActivation);

// PATCH /api/users/:id/deactivate | /reactivate  — gestión de estado
router.patch('/:id/deactivate', authMiddleware, soloAdmin, deactivate);
router.patch('/:id/reactivate', authMiddleware, soloAdmin, reactivate);

module.exports = router;
