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

// GET /api/public/reniec/:dni — consultar DNI (primero en BD, luego en Decolecta)
router.get('/reniec/:dni', async (req, res) => {
  const { dni } = req.params;
  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'El DNI debe tener 8 dígitos numéricos' });
  }

  try {
    // ── 1. Buscar en la BD primero (ahorra llamadas a la API) ──────────────
    const [rows] = await pool.query(
      `SELECT nombre, apellido, fecha_nacimiento, sexo
       FROM   PACIENTE
       WHERE  tipo_documento = 'DNI'
         AND  numero_documento = ?
         AND  estado = 'ACTIVO'
       LIMIT  1`,
      [dni]
    );

    if (rows.length > 0) {
      const p = rows[0];
      // Formato fecha: YYYY-MM-DD (solo la parte de la fecha)
      const fecha = p.fecha_nacimiento
        ? (typeof p.fecha_nacimiento === 'string'
            ? p.fecha_nacimiento.split('T')[0]
            : p.fecha_nacimiento.toISOString().split('T')[0])
        : null;

      return res.json({
        first_name:        p.nombre,
        first_last_name:   p.apellido.split(' ')[0] || p.apellido,
        second_last_name:  p.apellido.split(' ').slice(1).join(' ') || '',
        full_name:         `${p.apellido} ${p.nombre}`,
        document_number:   dni,
        fecha_nacimiento:  fecha,
        sexo:              p.sexo,
        fuente:            'bd',      // indica que vino de la BD local
      });
    }

    // ── 2. No está en BD → consultar a Decolecta ───────────────────────────
    const data = await consultarDni(dni);
    return res.json({ ...data, fuente: 'reniec' });

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
