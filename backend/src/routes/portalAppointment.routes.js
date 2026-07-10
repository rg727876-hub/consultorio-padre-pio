const { Router } = require('express');
const {
  getDoctorsByService, getAvailability,
  createHold, releaseHold,
  confirmPayment,
  getMisCitas, getCitaDetalle, cancelarCita, reprogramarCita,
} = require('../controllers/portalAppointment.controller');
const { patientAuth } = require('../middlewares/patientAuth.middleware');

const router = Router();

// GET  /api/portal/appointments/doctors?servicio_id=       — Doctores activos por servicio
router.get('/doctors',                  patientAuth, getDoctorsByService);

// GET  /api/portal/appointments/slots?doctor_id=&servicio_id=&fecha=  — Disponibilidad
router.get('/slots',                    patientAuth, getAvailability);

// POST /api/portal/appointments/hold                        — Bloquea un horario 10 min
router.post('/hold',                    patientAuth, createHold);

// DELETE /api/portal/appointments/hold/:holdId               — Libera el bloqueo manualmente
router.delete('/hold/:holdId',          patientAuth, releaseHold);

// POST /api/portal/appointments/confirm-payment              — Cobra y confirma la cita
router.post('/confirm-payment',         patientAuth, confirmPayment);

// GET  /api/portal/appointments?paciente_id=&tipo=proximas|historial  — Mis citas (WEB-HU004)
router.get('/',                         patientAuth, getMisCitas);

// GET  /api/portal/appointments/:id                          — Detalle completo de una cita
router.get('/:id',                      patientAuth, getCitaDetalle);

// PATCH /api/portal/appointments/:id/cancel                  — Anular una cita próxima
router.patch('/:id/cancel',             patientAuth, cancelarCita);

// PATCH /api/portal/appointments/:id/reschedule              — Reprogramar fecha/hora
router.patch('/:id/reschedule',         patientAuth, reprogramarCita);

module.exports = router;
