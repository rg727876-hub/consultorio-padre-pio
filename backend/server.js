const app = require('./src/app');
const { startCronJobs } = require('./src/jobs/expireAppointments');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Entorno: ${process.env.NODE_ENV}`);

  // Iniciar jobs programados
    startCronJobs();
});