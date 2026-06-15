const jwt = require('jsonwebtoken');

// Algoritmo fijo: evita ataques de confusión de algoritmo (p.ej. alg:none o RS↔HS).
const ALG = 'HS256';

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        algorithm: ALG,
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
};

const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALG] });
};

module.exports = { generateToken, verifyToken };