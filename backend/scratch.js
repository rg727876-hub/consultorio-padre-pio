require('dotenv').config();
const pool = require('./src/config/db');
const axios = require('axios');

async function main() {
    try {
        const doctorId = 1; // Assuming 1 is a doctor, we can just test if the query fails

        const req = { query: { estado: 'INACTIVO', page: '1' } };
        const res = {
            status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) }),
            json: (data) => console.log("Success JSON:", JSON.stringify(data, null, 2))
        };
        
        async function test() {
          try {
            const res = await axios.post('http://localhost:4000/api/auth/staff/login', {
              email: 'consultoripadrepio@gmail.com',
              password: 'consultorio@padrepio123'
            });
            console.log("Login success:", res.data);
          } catch (err) {
            console.error("Login failed:", err.response?.data || err.message);
          }
        }
        test();
        
        const patientController = require('./src/controllers/patient.controller.js');
        await patientController.list(req, res);

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
