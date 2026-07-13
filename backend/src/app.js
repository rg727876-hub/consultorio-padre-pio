require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const morgan = require('morgan');
const { errorHandler } = require('./middlewares/error.middleware');
const {
  validateEnv, corsOptions, globalLimiter, authLimiter,
} = require('./config/security');

// Valida secretos críticos antes de levantar nada (fail-fast en producción).
validateEnv();

// Rutas
const authStaffRoutes = require('./routes/authStaff.routes');
const authPatientRoutes = require('./routes/authPatient.routes');
const activationRoutes = require('./routes/activation.routes');
const userRoutes = require('./routes/user.routes');
const patientRoutes = require('./routes/patient.routes');
const serviceRoutes = require('./routes/service.routes');
const doctorRoutes = require('./routes/doctor.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const paymentRoutes      = require('./routes/payment.routes');
const comprobanteRoutes  = require('./routes/comprobante.routes');
const agendaRoutes       = require('./routes/agenda.routes');
const auditRoutes        = require('./routes/audit.routes');
const consultaRoutes     = require('./routes/consulta.routes');
const historialRoutes       = require('./routes/historial.routes');
const especialidadRoutes    = require('./routes/especialidad.routes');
const patientProfileRoutes  = require('./routes/patientProfile.routes');
const reporteRoutes         = require('./routes/reporte.routes');
const familiarRoutes        = require('./routes/familiar.routes');
const publicRoutes          = require('./routes/public.routes');
const patientHistorialRoutes = require('./routes/patientHistorial.routes');
const portalAppointmentRoutes = require('./routes/portalAppointment.routes');

const app = express();

// Detrás del proxy de Railway/Vercel: confía en 1 salto para obtener la IP
// real del cliente (necesario para rate-limiting y auditoría correctos).
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Cabeceras de seguridad (helmet) ─────────────────────────────────────────
app.use(helmet({
    // HSTS: fuerza HTTPS durante 180 días (solo aplica si se sirve por HTTPS).
    hsts: { maxAge: 15552000, includeSubDomains: true },
    // La API no sirve HTML; estas políticas reducen superficie de ataque.
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
}));

// ── CORS estricto (allowlist en config/security.js) ─────────────────────────
app.use(cors(corsOptions));

// ── Límite global de peticiones por IP ──────────────────────────────────────
app.use(globalLimiter);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body parser con límite de tamaño (mitiga DoS por payload gigante) ───────
app.use(express.json({ limit: '100kb' }));

// ── Protección contra HTTP Parameter Pollution ─────────────────────────────
app.use(hpp());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== AUTH (dos sistemas separados) — con rate-limit estricto anti fuerza-bruta =====
app.use('/api/auth/staff', authLimiter, authStaffRoutes);     // Staff: email + password
app.use('/api/auth/patient', authLimiter, authPatientRoutes); // Paciente: doc + password
app.use('/api/auth/activate', authLimiter, activationRoutes); // Activación de cuentas

// ===== UPLOADS (Archivos estáticos) =====
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
    setHeaders: (res) => {
        // Permitir carga cross-origin de recursos estáticos para el frontend
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// ===== RECURSOS =====
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/comprobantes', comprobanteRoutes);
app.use('/api/agenda',       agendaRoutes);
app.use('/api/audit',        auditRoutes);
app.use('/api/consultas',    consultaRoutes);
app.use('/api/historial',    historialRoutes);
app.use('/api/especialidades', especialidadRoutes);
app.use('/api/patient',       patientProfileRoutes);
app.use('/api/reportes',      reporteRoutes);
app.use('/api/familiar',      familiarRoutes);
app.use('/api/public',        publicRoutes);
app.use('/api/mi-historial',  patientHistorialRoutes);
app.use('/api/portal/appointments', portalAppointmentRoutes);

// Manejo de errores
app.use(errorHandler);

module.exports = app;