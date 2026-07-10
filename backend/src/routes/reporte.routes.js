const { Router } = require('express');
const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole }   = require('../middlewares/role.middleware');
const {
  getResumen, getPagos, getPerdidas,
  getNuevosPacientes, getCitasPorServicio, getIngresosMensuales,
  getPacientesDetalle,
  getTopRankings, getCitasDetalle,
} = require('../controllers/reporte.controller');

const router = Router();

// Todas las rutas: solo ADMINISTRADOR autenticado.
router.use(verifyToken, checkRole('ADMINISTRADOR'));

// KPIs y tablas
router.get('/resumen',  getResumen);
router.get('/pagos',    getPagos);
router.get('/perdidas', getPerdidas);

// Gráficas
router.get('/nuevos-pacientes',    getNuevosPacientes);
router.get('/citas-por-servicio',  getCitasPorServicio);
router.get('/ingresos-mensuales',  getIngresosMensuales);

// Tabla detallada de pacientes registrados
router.get('/pacientes-detalle',   getPacientesDetalle);

// Resumen ejecutivo: top doctores y top pacientes
router.get('/top-rankings',        getTopRankings);

// Drill-down: citas detalladas de un servicio (para modal del pie)
router.get('/citas-detalle',       getCitasDetalle);

module.exports = router;
