const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // El servidor de BD (Railway) guarda los DATETIME en UTC. Leerlos como UTC ('Z')
    // produce un ISO correcto y el navegador los convierte a la hora local (Perú).
    // Con '-05:00' se malinterpretaba el valor → se mostraba +5 h adelantado.
    timezone: 'Z',
    dateStrings: false,
});

pool.getConnection()
    .then(conn => {
        console.log('MySQL conectado — BD:', process.env.DB_NAME);
        conn.release();
    })
    .catch(err => {
        console.error('Error conectando a MySQL:', err.message);
    });

module.exports = pool;