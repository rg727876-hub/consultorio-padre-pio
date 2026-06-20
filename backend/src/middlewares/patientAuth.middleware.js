const { verifyToken } = require('../utils/jwt.util');

const patientAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token no proporcionado' });

  try {
    const decoded = verifyToken(header.split(' ')[1]);
    if (decoded.tipo !== 'PACIENTE')
      return res.status(403).json({ error: 'Acceso no autorizado' });
    req.paciente = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = { patientAuth };
