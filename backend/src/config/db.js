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
    timezone: '-05:00'  // Zona horaria de Perú
});

// Verificar conexión al iniciar
pool.getConnection()
    .then(conn => {
        console.log('MySQL conectado — Base de datos:', process.env.DB_NAME);
        conn.release();
    }
)
    .catch(err => {
        console.error('Error conectando a MySQL:', err.message);
    }
);

module.exports = pool;