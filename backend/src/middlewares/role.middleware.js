// Roles válidos según tu BD: 'RECEPCIONISTA', 'CAJERO', 'ADMINISTRADOR', 'DOCTOR'
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
    if (!req.user || !req.user.rol) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
        return res.status(403).json({
        error: 'No tiene permisos para esta acción'
        });
    }

    next();
    };
};

module.exports = { checkRole };