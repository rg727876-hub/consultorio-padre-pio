const { Router } = require('express');
const pool       = require('../config/db');
const { getPaymentMethodIcons } = require('../services/mercadopago.service');
const { consultarDni }          = require('../services/reniec.service');

const router = Router();

// GET /api/public/payment-methods — logos de marcas de tarjeta y Yape (sin auth)
router.get('/payment-methods', async (req, res) => {
  try {
    const icons = await getPaymentMethodIcons();
    return res.json(icons);
  } catch (err) {
    console.error('[public.paymentMethods]', err.message);
    return res.status(502).json({ error: 'No se pudo cargar los medios de pago' });
  }
});

// GET /api/public/reniec/:dni — consultar DNI a RENIEC (sin auth, pero limitado por CORS y rate-limit global)
router.get('/reniec/:dni', async (req, res) => {
  const { dni } = req.params;
  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'El DNI debe tener 8 dígitos numéricos' });
  }

  try {
    const data = await consultarDni(dni);
    return res.json(data);
  } catch (err) {
    if (err.message.includes('DNI no encontrado')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('[public.reniec]', err.message);
    return res.status(500).json({ error: 'Servicio de validación temporalmente no disponible' });
  }
});

// GET /api/public/servicios — servicios activos (sin auth, para landing page)
router.get('/servicios', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT servicio_id, nombre, descripcion, duracion, costo, imagen
       FROM   SERVICIO
       WHERE  estado = 'ACTIVO'
       ORDER  BY nombre`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[public.servicios]', err.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/public/doctores — doctores activos (sin auth, para landing page)
router.get('/doctores', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.usuario_id AS doctor_id,
              u.nombre, u.apellido, u.avatar,
              (SELECT GROUP_CONCAT(e.nombre ORDER BY e.nombre SEPARATOR ', ')
                 FROM DOCTOR_ESPECIALIDAD de
                 JOIN ESPECIALIDAD e ON e.especialidad_id = de.especialidad_id
                WHERE de.doctor_id = d.doctor_id) AS especialidad
       FROM   USUARIO u
       JOIN   ROL_USUARIO ru ON ru.usuario_id = u.usuario_id
       JOIN   ROL r          ON r.rol_id = ru.rol_id
       JOIN   DOCTOR d       ON d.doctor_id = u.usuario_id
       WHERE  r.nombre_rol = 'DOCTOR'
         AND  u.estado = 'ACTIVO'
       ORDER  BY u.apellido, u.nombre`
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
