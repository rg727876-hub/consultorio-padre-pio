const pool = require('../config/db');
const { logAudit } = require('../utils/audit.util');

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/resumen?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
//
// KPIs del dashboard de reportes (INT-HU023):
//   • total_ingresos_brutos  — suma de pagos completados en el periodo
//   • citas_atendidas        — número de citas con estado ATENDIDA
//   • perdidas_proyectadas   — suma del precio aplicado de citas NO_ASISTIO o CANCELADA
//   • tasa_retorno           — % de pacientes con ≥2 citas atendidas en el periodo
//                              respecto al total de pacientes atendidos (proxy de fidelización)
//   • alerta_fidelizacion    — true si tasa_retorno < 30%
//
// Restringido a ADMINISTRADOR (validado en routes). Cada consulta se audita.
// ─────────────────────────────────────────────────────────────────

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UMBRAL_FIDELIZACION = 30; // % por debajo del cual se dispara la alerta

// Perú es UTC-5 (sin DST). Todas las columnas DATETIME están en UTC en BD,
// así que las convertimos a Perú antes de comparar/agrupar por fecha.
// De lo contrario un pago hecho a las 21:00 hora Perú (02:00 UTC del día
// siguiente) aparecería en el día equivocado en filtros y gráficas.
const TZ_PERU  = "'-05:00'";
const TZ_UTC   = "'+00:00'";
const A_PERU   = (col) => `CONVERT_TZ(${col}, ${TZ_UTC}, ${TZ_PERU})`;

const getResumen = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Complete el rango de fechas para continuar.' });
  }
  if (!FECHA_REGEX.test(fecha_inicio) || !FECHA_REGEX.test(fecha_fin)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (use YYYY-MM-DD).' });
  }
  if (fecha_inicio > fecha_fin) {
    return res.status(400).json({ error: 'Rango de fechas inválido. Verifique la información.' });
  }

  try {
    const [[ingresosRow]] = await pool.query(
      `SELECT COALESCE(SUM(monto_total), 0) AS total
         FROM PAGO
        WHERE estado = 'COMPLETADO'
          AND DATE(${A_PERU('fecha_pago')}) BETWEEN ? AND ?`,
      [fecha_inicio, fecha_fin],
    );

    const [[citasRow]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM CITA
        WHERE estado = 'ATENDIDA'
          AND fecha BETWEEN ? AND ?`,
      [fecha_inicio, fecha_fin],
    );

    const [[perdidasRow]] = await pool.query(
      `SELECT COALESCE(SUM(precio_aplicado), 0) AS total
         FROM CITA
        WHERE estado IN ('NO_ASISTIO', 'CANCELADA')
          AND fecha BETWEEN ? AND ?`,
      [fecha_inicio, fecha_fin],
    );

    // Tasa de retorno = pacientes con ≥2 atenciones / pacientes con ≥1 atención
    const [[retornoRow]] = await pool.query(
      `SELECT
          COUNT(*) AS total_atendidos,
          SUM(CASE WHEN visitas >= 2 THEN 1 ELSE 0 END) AS recurrentes
         FROM (
           SELECT paciente_id, COUNT(*) AS visitas
             FROM CITA
            WHERE estado = 'ATENDIDA'
              AND fecha BETWEEN ? AND ?
            GROUP BY paciente_id
         ) t`,
      [fecha_inicio, fecha_fin],
    );

    const totalAtendidos = Number(retornoRow.total_atendidos) || 0;
    const recurrentes    = Number(retornoRow.recurrentes) || 0;
    const tasaRetorno    = totalAtendidos === 0 ? 0 : (recurrentes / totalAtendidos) * 100;

    await logAudit({
      usuario_id: req.user?.id ?? null,
      accion:     'CONSULTAR_DASHBOARD_REPORTES',
      entidad:    'REPORTE',
      detalles:   JSON.stringify({ fecha_inicio, fecha_fin }),
      ip_origen:  req.ip,
    });

    return res.json({
      filtros: { fecha_inicio, fecha_fin },
      kpis: {
        total_ingresos_brutos: Number(ingresosRow.total),
        citas_atendidas:       Number(citasRow.total),
        perdidas_proyectadas:  Number(perdidasRow.total),
        tasa_retorno: {
          porcentaje:           Number(tasaRetorno.toFixed(2)),
          pacientes_atendidos:  totalAtendidos,
          pacientes_recurrentes: recurrentes,
          alerta:               tasaRetorno > 0 && tasaRetorno < UMBRAL_FIDELIZACION,
          umbral:               UMBRAL_FIDELIZACION,
        },
      },
    });
  } catch (err) {
    console.error('Error en getResumen reportes:', err);
    return res.status(500).json({ error: 'Error al generar el resumen de reportes.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/pagos?fecha_inicio=&fecha_fin=
// Tabla detallada de pagos completados del periodo.
// Columnas: fecha_pago, paciente, servicio, monto_total, metodo_pago.
// ─────────────────────────────────────────────────────────────────
const getPagos = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Complete el rango de fechas para continuar.' });
  }
  if (!FECHA_REGEX.test(fecha_inicio) || !FECHA_REGEX.test(fecha_fin)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (use YYYY-MM-DD).' });
  }
  if (fecha_inicio > fecha_fin) {
    return res.status(400).json({ error: 'Rango de fechas inválido. Verifique la información.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
          pg.pago_id,
          pg.fecha_pago,
          CONCAT(pac.nombre, ' ', pac.apellido) AS paciente,
          s.nombre AS servicio,
          pg.monto_total,
          pg.metodo_pago
         FROM PAGO pg
         INNER JOIN CITA c       ON c.cita_id      = pg.cita_id
         INNER JOIN PACIENTE pac ON pac.paciente_id = c.paciente_id
         INNER JOIN SERVICIO s   ON s.servicio_id   = c.servicio_id
        WHERE pg.estado = 'COMPLETADO'
          AND DATE(${A_PERU('pg.fecha_pago')}) BETWEEN ? AND ?
        ORDER BY pg.fecha_pago DESC`,
      [fecha_inicio, fecha_fin],
    );

    await logAudit({
      usuario_id: req.user?.id ?? null,
      accion:     'CONSULTAR_REPORTE_PAGOS',
      entidad:    'REPORTE',
      detalles:   JSON.stringify({ fecha_inicio, fecha_fin, total: rows.length }),
      ip_origen:  req.ip,
    });

    return res.json({
      filtros: { fecha_inicio, fecha_fin },
      total:   rows.length,
      data:    rows,
    });
  } catch (err) {
    console.error('Error en getPagos reportes:', err);
    return res.status(500).json({ error: 'Error al generar la tabla de pagos.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/perdidas?fecha_inicio=&fecha_fin=
// Tabla de pérdidas económicas (citas NO_ASISTIO o CANCELADA).
// Columnas: fecha, paciente, servicio, doctor, monto, motivo.
// ─────────────────────────────────────────────────────────────────
const getPerdidas = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Complete el rango de fechas para continuar.' });
  }
  if (!FECHA_REGEX.test(fecha_inicio) || !FECHA_REGEX.test(fecha_fin)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (use YYYY-MM-DD).' });
  }
  if (fecha_inicio > fecha_fin) {
    return res.status(400).json({ error: 'Rango de fechas inválido. Verifique la información.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
          c.cita_id,
          c.fecha,
          CONCAT(pac.nombre, ' ', pac.apellido) AS paciente,
          s.nombre AS servicio,
          CONCAT(u.nombre, ' ', u.apellido) AS doctor,
          c.precio_aplicado AS monto,
          c.estado AS motivo
         FROM CITA c
         INNER JOIN PACIENTE pac ON pac.paciente_id = c.paciente_id
         INNER JOIN SERVICIO s   ON s.servicio_id   = c.servicio_id
         INNER JOIN USUARIO u    ON u.usuario_id    = c.doctor_id
        WHERE c.estado IN ('NO_ASISTIO', 'CANCELADA')
          AND c.fecha BETWEEN ? AND ?
        ORDER BY c.fecha DESC`,
      [fecha_inicio, fecha_fin],
    );

    const total_monto = rows.reduce((acc, r) => acc + Number(r.monto || 0), 0);

    await logAudit({
      usuario_id: req.user?.id ?? null,
      accion:     'CONSULTAR_REPORTE_PERDIDAS',
      entidad:    'REPORTE',
      detalles:   JSON.stringify({ fecha_inicio, fecha_fin, total: rows.length }),
      ip_origen:  req.ip,
    });

    return res.json({
      filtros:     { fecha_inicio, fecha_fin },
      total:       rows.length,
      total_monto,
      data:        rows,
    });
  } catch (err) {
    console.error('Error en getPerdidas reportes:', err);
    return res.status(500).json({ error: 'Error al generar la tabla de pérdidas.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// Helpers comunes a los endpoints de gráficas
// ─────────────────────────────────────────────────────────────────
function validarFechas(fecha_inicio, fecha_fin) {
  if (!fecha_inicio || !fecha_fin)
    return 'Complete el rango de fechas para continuar.';
  if (!FECHA_REGEX.test(fecha_inicio) || !FECHA_REGEX.test(fecha_fin))
    return 'Formato de fecha inválido (use YYYY-MM-DD).';
  if (fecha_inicio > fecha_fin)
    return 'Rango de fechas inválido. Verifique la información.';
  return null;
}

// Decide la granularidad de las gráficas temporales según el rango.
// Rangos cortos (≤ 90 días) → vista diaria. Más largos → vista mensual.
// Para que se vea evolución incluso si los datos están concentrados en pocos meses.
const UMBRAL_DIAS_DIARIA = 90;

function elegirGranularidad(fecha_inicio, fecha_fin) {
  const dias = Math.floor(
    (Date.parse(fecha_fin) - Date.parse(fecha_inicio)) / 86_400_000
  ) + 1;
  return dias <= UMBRAL_DIAS_DIARIA ? 'dia' : 'mes';
}

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/nuevos-pacientes?fecha_inicio=&fecha_fin=
// Evolución mensual de pacientes registrados en el periodo.
// Devuelve: [{ mes: 'YYYY-MM', total: N }, ...]
// ─────────────────────────────────────────────────────────────────
const getNuevosPacientes = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const err = validarFechas(fecha_inicio, fecha_fin);
  if (err) return res.status(400).json({ error: err });

  const granularidad = elegirGranularidad(fecha_inicio, fecha_fin);
  const formato      = granularidad === 'dia' ? '%Y-%m-%d' : '%Y-%m';

  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(${A_PERU('fecha_registro')}, ?) AS periodo,
              COUNT(*) AS total
         FROM PACIENTE
        WHERE DATE(${A_PERU('fecha_registro')}) BETWEEN ? AND ?
        GROUP BY periodo
        ORDER BY periodo ASC`,
      [formato, fecha_inicio, fecha_fin],
    );

    return res.json({
      filtros:      { fecha_inicio, fecha_fin },
      granularidad,
      data:         rows.map((r) => ({ periodo: r.periodo, total: Number(r.total) })),
    });
  } catch (e) {
    console.error('Error en getNuevosPacientes:', e);
    return res.status(500).json({ error: 'Error al generar el reporte de nuevos pacientes.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/citas-por-servicio?fecha_inicio=&fecha_fin=
// Distribución de citas por servicio en el periodo (todas las citas
// menos las EXPIRADAS, que no aportan información operativa).
// Devuelve: [{ servicio: 'nombre', total: N }, ...]
// ─────────────────────────────────────────────────────────────────
const getCitasPorServicio = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const err = validarFechas(fecha_inicio, fecha_fin);
  if (err) return res.status(400).json({ error: err });

  try {
    const [rows] = await pool.query(
      `SELECT s.nombre AS servicio,
              COUNT(*) AS total
         FROM CITA c
         INNER JOIN SERVICIO s ON s.servicio_id = c.servicio_id
        WHERE c.estado <> 'EXPIRADA'
          AND c.fecha BETWEEN ? AND ?
        GROUP BY s.servicio_id, s.nombre
        ORDER BY total DESC`,
      [fecha_inicio, fecha_fin],
    );

    return res.json({
      filtros: { fecha_inicio, fecha_fin },
      data:    rows.map((r) => ({ servicio: r.servicio, total: Number(r.total) })),
    });
  } catch (e) {
    console.error('Error en getCitasPorServicio:', e);
    return res.status(500).json({ error: 'Error al generar el reporte de citas por servicio.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/ingresos-mensuales?fecha_inicio=&fecha_fin=
// Evolución mensual de ingresos por pagos completados.
// Devuelve: [{ mes: 'YYYY-MM', total: N }, ...]
// ─────────────────────────────────────────────────────────────────
const getIngresosMensuales = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const err = validarFechas(fecha_inicio, fecha_fin);
  if (err) return res.status(400).json({ error: err });

  const granularidad = elegirGranularidad(fecha_inicio, fecha_fin);
  const formato      = granularidad === 'dia' ? '%Y-%m-%d' : '%Y-%m';

  try {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(${A_PERU('fecha_pago')}, ?) AS periodo,
              COALESCE(SUM(monto_total), 0) AS total
         FROM PAGO
        WHERE estado = 'COMPLETADO'
          AND DATE(${A_PERU('fecha_pago')}) BETWEEN ? AND ?
        GROUP BY periodo
        ORDER BY periodo ASC`,
      [formato, fecha_inicio, fecha_fin],
    );

    return res.json({
      filtros:      { fecha_inicio, fecha_fin },
      granularidad,
      data:         rows.map((r) => ({ periodo: r.periodo, total: Number(r.total) })),
    });
  } catch (e) {
    console.error('Error en getIngresosMensuales:', e);
    return res.status(500).json({ error: 'Error al generar el reporte de ingresos mensuales.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/pacientes-detalle?fecha_inicio=&fecha_fin=
// Tabla detallada de pacientes registrados en el periodo.
// Columnas: fecha_registro, paciente, documento, teléfono, sexo, estado_cuenta.
// ─────────────────────────────────────────────────────────────────
const getPacientesDetalle = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const err = validarFechas(fecha_inicio, fecha_fin);
  if (err) return res.status(400).json({ error: err });

  try {
    const [rows] = await pool.query(
      `SELECT
          p.paciente_id,
          p.fecha_registro,
          CONCAT(p.nombre, ' ', p.apellido) AS paciente,
          p.tipo_documento,
          p.numero_documento,
          p.telefono,
          p.sexo,
          p.estado_cuenta
         FROM PACIENTE p
        WHERE DATE(${A_PERU('p.fecha_registro')}) BETWEEN ? AND ?
        ORDER BY p.fecha_registro DESC`,
      [fecha_inicio, fecha_fin],
    );

    await logAudit({
      usuario_id: req.user?.id ?? null,
      accion:     'CONSULTAR_REPORTE_PACIENTES',
      entidad:    'REPORTE',
      detalles:   JSON.stringify({ fecha_inicio, fecha_fin, total: rows.length }),
      ip_origen:  req.ip,
    });

    return res.json({
      filtros: { fecha_inicio, fecha_fin },
      total:   rows.length,
      data:    rows,
    });
  } catch (e) {
    console.error('Error en getPacientesDetalle:', e);
    return res.status(500).json({ error: 'Error al generar el reporte de pacientes.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/top-rankings?fecha_inicio=&fecha_fin=
// Top doctores y pacientes por citas ATENDIDAS en el periodo.
// Útil para el "Resumen ejecutivo" del dashboard.
// ─────────────────────────────────────────────────────────────────
const getTopRankings = async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  const err = validarFechas(fecha_inicio, fecha_fin);
  if (err) return res.status(400).json({ error: err });

  try {
    const [doctores] = await pool.query(
      `SELECT
          c.doctor_id,
          CONCAT(u.nombre, ' ', u.apellido) AS doctor,
          COUNT(*) AS total
         FROM CITA c
         INNER JOIN USUARIO u ON u.usuario_id = c.doctor_id
        WHERE c.estado = 'ATENDIDA'
          AND c.fecha BETWEEN ? AND ?
        GROUP BY c.doctor_id, doctor
        ORDER BY total DESC
        LIMIT 5`,
      [fecha_inicio, fecha_fin],
    );

    const [pacientes] = await pool.query(
      `SELECT
          c.paciente_id,
          CONCAT(p.nombre, ' ', p.apellido) AS paciente,
          COUNT(*) AS total
         FROM CITA c
         INNER JOIN PACIENTE p ON p.paciente_id = c.paciente_id
        WHERE c.estado = 'ATENDIDA'
          AND c.fecha BETWEEN ? AND ?
        GROUP BY c.paciente_id, paciente
        ORDER BY total DESC
        LIMIT 5`,
      [fecha_inicio, fecha_fin],
    );

    return res.json({
      filtros: { fecha_inicio, fecha_fin },
      top_doctores:  doctores.map((d) => ({ ...d, total: Number(d.total) })),
      top_pacientes: pacientes.map((p) => ({ ...p, total: Number(p.total) })),
    });
  } catch (e) {
    console.error('Error en getTopRankings:', e);
    return res.status(500).json({ error: 'Error al generar el resumen ejecutivo.' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/reportes/citas-detalle?fecha_inicio=&fecha_fin=&servicio=
// Drill-down: lista de citas en el periodo filtradas por servicio.
// Usado por el modal cuando el admin hace clic en un sector del pie.
// ─────────────────────────────────────────────────────────────────
const getCitasDetalle = async (req, res) => {
  const { fecha_inicio, fecha_fin, servicio } = req.query;
  const err = validarFechas(fecha_inicio, fecha_fin);
  if (err) return res.status(400).json({ error: err });
  if (!servicio) return res.status(400).json({ error: 'Servicio requerido.' });

  try {
    const [rows] = await pool.query(
      `SELECT
          c.cita_id,
          c.codigo_cita,
          c.fecha,
          c.hora_inicio,
          CONCAT(p.nombre, ' ', p.apellido) AS paciente,
          CONCAT(u.nombre, ' ', u.apellido) AS doctor,
          s.nombre AS servicio,
          c.estado,
          c.precio_aplicado AS monto
         FROM CITA c
         INNER JOIN PACIENTE p ON p.paciente_id = c.paciente_id
         INNER JOIN USUARIO  u ON u.usuario_id  = c.doctor_id
         INNER JOIN SERVICIO s ON s.servicio_id = c.servicio_id
        WHERE c.fecha BETWEEN ? AND ?
          AND s.nombre = ?
          AND c.estado <> 'EXPIRADA'
        ORDER BY c.fecha DESC, c.hora_inicio DESC`,
      [fecha_inicio, fecha_fin, servicio],
    );

    return res.json({
      filtros: { fecha_inicio, fecha_fin, servicio },
      total:   rows.length,
      data:    rows,
    });
  } catch (e) {
    console.error('Error en getCitasDetalle:', e);
    return res.status(500).json({ error: 'Error al consultar citas del servicio.' });
  }
};

module.exports = {
  getResumen, getPagos, getPerdidas,
  getNuevosPacientes, getCitasPorServicio, getIngresosMensuales,
  getPacientesDetalle,
  getTopRankings, getCitasDetalle,
};
