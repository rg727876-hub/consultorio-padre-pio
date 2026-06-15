const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    try {
        const token = header.split(' ')[1];
        // Algoritmo fijo HS256: bloquea tokens con alg:none o algoritmo alterado.
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

module.exports = { verifyToken };