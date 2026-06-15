const crypto = require('crypto');

/**
 * Genera código de cita: CITXXXNNN (10 caracteres)
 * Ejemplo: CITABC1234, CITXYZ0089
 *
 * Usa crypto.randomInt (CSPRNG) en lugar de Math.random para que el código no
 * sea predecible y no se pueda enumerar/adivinar códigos de otras citas.
 */
const generateAppointmentCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letterPart = Array.from({ length: 3 }, () =>
        letters.charAt(crypto.randomInt(letters.length))
    ).join('');

    const numberPart = crypto.randomInt(10000)
        .toString()
        .padStart(4, '0');

    return `CIT${letterPart}${numberPart}`;
  // Resultado: 10 caracteres exactos (CIT + 3 letras + 4 números)
};

module.exports = { generateAppointmentCode };