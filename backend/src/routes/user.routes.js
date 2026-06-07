const { Router }    = require('express');
const { register, getAllUsers, getUserById, updateUser, updateUserStatus, resendActivation }  = require('../controllers/user.controller');
const { verifyToken: authMiddleware } = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');

const router = Router();

// GET /api/users — listar
router.get('/', authMiddleware, checkRole('ADMINISTRADOR'), getAllUsers);

// POST /api/users  — registrar usuarios
router.post('/', authMiddleware, checkRole('ADMINISTRADOR'), register);

// GET /api/users/:id — obtener detalle de perfil
router.get('/:id', authMiddleware, checkRole('ADMINISTRADOR'), getUserById);

// PUT /api/users/:id — editar perfil (solo contacto)
router.put('/:id', authMiddleware, checkRole('ADMINISTRADOR'), updateUser);

// PUT /api/users/:id/status — activar/desactivar
router.put('/:id/status', authMiddleware, checkRole('ADMINISTRADOR'), updateUserStatus);

// POST /api/users/:id/resend-activation — reenviar correo
router.post('/:id/resend-activation', authMiddleware, checkRole('ADMINISTRADOR'), resendActivation);

module.exports = router;
