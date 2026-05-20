require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middlewares/error.middleware');

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
const paymentRoutes = require('./routes/payment.routes');

const app = express();

// Middlewares globales
app.use(helmet());
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        /\.vercel\.app$/,
    ],
    credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== AUTH (dos sistemas separados) =====
app.use('/api/auth/staff', authStaffRoutes);       // Staff: email + password
app.use('/api/auth/patient', authPatientRoutes);   // Paciente: doc + password
app.use('/api/auth/activate', activationRoutes);   // Activación de cuentas

// ===== RECURSOS =====
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);

// Manejo de errores
app.use(errorHandler);

module.exports = app;