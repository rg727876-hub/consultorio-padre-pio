const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack || err.message);

  // Origen bloqueado por la allowlist de CORS
    if (err.message === 'Origen no permitido por CORS') {
        return res.status(403).json({ error: 'Origen no autorizado' });
    }

  // Body que supera el límite de tamaño (posible intento de DoS)
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'La solicitud es demasiado grande' });
    }

  // JSON malformado en el body
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        return res.status(400).json({ error: 'JSON inválido en la solicitud' });
    }

  // Duplicado (UNIQUE constraint)
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            error: 'El registro ya existe (dato duplicado)'
        });
    }

  // FK inválida
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
            error: 'Referencia inválida: el registro relacionado no existe'
        });
    }

  // CHECK constraint
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
        return res.status(400).json({
            error: 'Los datos no cumplen las validaciones'
        });
    }

    // Multer / Formato no soportado
    if (err.message && err.message.includes('Formato de archivo no soportado')) {
        return res.status(400).json({ error: err.message, detail: err.message, stack: err.stack });
    }

    const status = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Error interno del servidor';

    res.status(status).json({ error: message, detail: err.message, stack: err.stack });
};

module.exports = { errorHandler };