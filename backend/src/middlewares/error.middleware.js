const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack || err.message);

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

    const status = err.statusCode || 500;
    const message = err.statusCode ? err.message : 'Error interno del servidor';

    res.status(status).json({ error: message });
};

module.exports = { errorHandler };