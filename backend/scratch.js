require('dotenv').config();
const pool = require('./src/config/db');

async function main() {
    try {
        const doctorId = 1; // Assuming 1 is a doctor, we can just test if the query fails

        const [cols] = await pool.query("SHOW COLUMNS FROM SERVICIO");
        console.log("Cols:", cols);

        const [horarios] = await pool.query(`
          SELECT dia_semana, hora_inicio, hora_fin 
          FROM HORARIO 
          WHERE estado = 'ACTIVO'
          ORDER BY dia_semana, hora_inicio
        `);
        console.log("Horarios:", horarios);

        process.exit(0);
    } catch (e) {
        console.error("Error:", e.message);
        process.exit(1);
    }
}

main();
