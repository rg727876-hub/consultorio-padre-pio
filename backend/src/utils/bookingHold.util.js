const { randomUUID } = require('crypto');

// ── Bloqueo temporal de slots para la reserva online (WEB-HU003) ────────────
// Mapa en memoria, por proceso — mismo patrón y misma limitación (instancia
// única) que el mecanismo de lockSlot/unlockSlot de PIO-30 en
// appointment.controller.js. Se mantiene un Map independiente porque ese otro
// mecanismo bloquea slots de citas YA EXISTENTES (reprogramación) mientras
// este bloquea slots para una cita que todavía no existe (reserva nueva).
const HOLD_TTL_MS = 5 * 60 * 1000; // 5 minutos

const holds = new Map();          // hold_id -> { ...datos, expiresAt, timer }
const slotIndex = new Map();      // "doctorId:fecha:horaInicio" -> hold_id

const slotKey = (doctorId, fecha, horaInicio) => `${doctorId}:${fecha}:${horaInicio}`;

const isExpired = (hold) => !hold || hold.expiresAt <= Date.now();

const releaseHold = (holdId) => {
  const hold = holds.get(holdId);
  if (!hold) return;
  if (hold.timer) clearTimeout(hold.timer);
  holds.delete(holdId);
  const key = slotKey(hold.doctorId, hold.fecha, hold.horaInicio);
  if (slotIndex.get(key) === holdId) slotIndex.delete(key);
};

const getHold = (holdId) => {
  const hold = holds.get(holdId);
  if (!hold) return undefined;
  if (isExpired(hold)) { releaseHold(holdId); return undefined; }
  return hold;
};

// Slot ocupado por un hold vigente del doctor o del paciente
const isSlotHeld = (doctorId, pacienteId, fecha, horaInicio, excludeHoldId = null) => {
  // Check doctor overlap
  const holdId = slotIndex.get(slotKey(doctorId, fecha, horaInicio));
  if (holdId && holdId !== excludeHoldId && getHold(holdId)) {
    return true; // Doctor is busy
  }

  // Check patient overlap
  for (const [id, hold] of holds.entries()) {
    if (id !== excludeHoldId && hold.pacienteId === pacienteId && hold.fecha === fecha && hold.horaInicio === horaInicio && !isExpired(hold)) {
      return true; // Patient is busy
    }
  }

  return false;
};

const createHold = ({ titularId, pacienteId, doctorId, servicioId, fecha, horaInicio, horaFin }) => {
  const key = slotKey(doctorId, fecha, horaInicio);

  if (isSlotHeld(doctorId, pacienteId, fecha, horaInicio)) return null;

  const holdId = randomUUID();
  const expiresAt = Date.now() + HOLD_TTL_MS;

  const timer = setTimeout(() => releaseHold(holdId), HOLD_TTL_MS);
  if (timer.unref) timer.unref();

  holds.set(holdId, {
    holdId, titularId, pacienteId, doctorId, servicioId, fecha, horaInicio, horaFin,
    expiresAt, timer,
  });
  slotIndex.set(key, holdId);

  return { holdId, expiresAt };
};

module.exports = { createHold, getHold, releaseHold, isSlotHeld, HOLD_TTL_MS };
