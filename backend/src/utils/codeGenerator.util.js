/**
 * Genera código de cita: CIT-XXXNNN (10 caracteres)
 * Ejemplo: CIT-ABC1234, CIT-XYZ0089
 * Formato según el documento del proyecto
 */
const generateAppointmentCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letterPart = Array.from({ length: 3 }, () =>
    letters.charAt(Math.floor(Math.random() * letters.length))
    ).join('');

     const numberPart = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');

    return `CIT${letterPart}${numberPart}`;
  // Resultado: 10 caracteres exactos (CIT + 3 letras + 4 números)
};

module.exports = { generateAppointmentCode };