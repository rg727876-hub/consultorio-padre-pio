import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutGrid, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import AppLayout from '../../components/AppLayout';
import FiltrosAgenda from '../../components/agenda/FiltrosAgenda';
import GrillaDisponibilidad from '../../components/agenda/GrillaDisponibilidad';

// ── Fecha de hoy en formato YYYY-MM-DD ───────────────────────────
const hoy = () => new Date().toLocaleDateString('en-CA');

// ── Registro de auditoría — fire-and-forget ──────────────────────
// Usa logAudit vía la misma instancia Axios del proyecto.
// No bloquea la UI si falla (el catch es silencioso).
const auditLog = (accion, detalles) => {
  api.post('/audit', { accion, detalles }).catch(() => {});
  // Si el proyecto no tiene endpoint POST /audit propio, usa directamente
  // el helper del backend (logAudit está en el servidor, no en el cliente).
  // En este caso el log queda en consola para trazabilidad local:
  console.info(`[AUDIT] ${accion}`, detalles);
};

// ══════════════════════════════════════════════════════════════════
// AgendaMedica — Módulo principal de Agenda Médica para Recepcionista
//
// Estructura:
//   AppLayout
//   └─ Encabezado
//   └─ FiltrosAgenda   (selección de doctor/especialidad/vista)
//   └─ Panel de info del doctor seleccionado
//   └─ GrillaDisponibilidad (columnas de slots coloreados)
// ══════════════════════════════════════════════════════════════════
export default function AgendaMedica() {
  // ── Filtros ────────────────────────────────────────────────────
  const [doctores,     setDoctores]     = useState([]);
  const [doctorId,     setDoctorId]     = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [vista,        setVista]        = useState('diaria');   // 'diaria' | 'semanal'
  const [fecha,        setFecha]        = useState(hoy());

  // ── Doctor seleccionado (objeto completo) ──────────────────────
  const [doctorInfo, setDoctorInfo] = useState(null);

  // ── Datos de disponibilidad ────────────────────────────────────
  const [grilla,  setGrilla]  = useState({});   // { [fecha]: slots[] }
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Ref para cancelar fetches si el componente se desmonta
  const abortRef = useRef(null);

  // ── Carga inicial de doctores ──────────────────────────────────
  useEffect(() => {
    api.get('/doctors')
      .then(({ data }) => setDoctores(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // ── Actualizar doctorInfo cuando cambia doctorId ───────────────
  useEffect(() => {
    if (!doctorId) { setDoctorInfo(null); return; }
    const doc = doctores.find(d => String(d.doctor_id) === String(doctorId));
    setDoctorInfo(doc ?? null);
  }, [doctorId, doctores]);

  // ── Fechas a mostrar según la vista ───────────────────────────
  const fechasVista = useCallback(() => {
    if (vista === 'diaria') return [fecha];
    // Semanal: lunes a sábado de la semana que contiene `fecha`
    const [y, m, d] = fecha.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const dow  = base.getDay();
    const lunes = new Date(base);
    lunes.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
    return Array.from({ length: 6 }, (_, i) => {
      const dia = new Date(lunes);
      dia.setDate(lunes.getDate() + i);
      return dia.toLocaleDateString('en-CA');
    });
  }, [vista, fecha]);

  // ── Fetch de disponibilidad ────────────────────────────────────
  const fetchDisponibilidad = useCallback(async () => {
    if (!doctorId) return;

    // Cancelar fetch anterior si existe
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const fechas = fechasVista();
    setLoading(true);
    setError('');
    setGrilla({});

    // Auditoría — se dispara al consultar la disponibilidad
    auditLog('CONSULTAR_DISPONIBILIDAD_UI', {
      doctor_id: doctorId,
      vista,
      fecha,
      fechas_solicitadas: fechas,
    });

    try {
      const resultados = await Promise.all(
        fechas.map(f =>
          api.get(`/agenda/disponibilidad/${doctorId}`, {
            params: { fecha: f },
            signal: abortRef.current.signal,
          })
            .then(({ data }) => ({ fecha: f, slots: data.slots ?? [], doctor: data.doctor }))
            .catch(() => ({ fecha: f, slots: [] }))
        )
      );

      const nueva = {};
      resultados.forEach(({ fecha: f, slots }) => { nueva[f] = slots; });
      setGrilla(nueva);

      // Tomar info del doctor desde la primera respuesta exitosa
      const primerConDoctor = resultados.find(r => r.doctor);
      if (primerConDoctor?.doctor && !doctorInfo) {
        setDoctorInfo(prev => prev ?? primerConDoctor.doctor);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('No se pudo cargar la disponibilidad. Intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, vista, fecha]);

  // ── Manejadores de filtros ─────────────────────────────────────
  const handleVistaChange = (nuevaVista) => {
    setVista(nuevaVista);
    auditLog('CAMBIO_VISTA_AGENDA', { vista_anterior: vista, vista_nueva: nuevaVista, doctor_id: doctorId });
  };

  const handleFechaChange = (nuevaFecha) => {
    setFecha(nuevaFecha);
  };

  // Auto-refrescar cuando cambia vista o fecha (si ya hay doctor seleccionado)
  useEffect(() => {
    if (doctorId) fetchDisponibilidad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, fecha, doctorId]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* ── Encabezado ── */}
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <LayoutGrid size={20} className="text-[#0059B3]" />
              <h1 className="text-xl font-bold text-[#0059B3]">Agenda Médica</h1>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Visualiza la disponibilidad de los doctores por día o semana
            </p>
          </div>

          {/* ── Filtros ── */}
          <FiltrosAgenda
            doctores={doctores}
            doctorId={doctorId}
            especialidad={especialidad}
            vista={vista}
            onDoctorChange={setDoctorId}
            onEspecialidadChange={setEspecialidad}
            onVistaChange={handleVistaChange}
            onBuscar={fetchDisponibilidad}
            loading={loading}
          />

          {/* ── Banner de doctor seleccionado ── */}
          {doctorInfo && (
            <div className="bg-[#0059B3]/5 border border-[#0059B3]/20 rounded-2xl
                            px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#0059B3]/10 flex items-center
                              justify-center text-[#0059B3] text-sm font-bold flex-shrink-0">
                {(doctorInfo.nombre ?? doctorInfo.nombre_doctor ?? '?')[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {doctorInfo.nombre} {doctorInfo.apellido}
                </p>
                {doctorInfo.especialidad && (
                  <p className="text-xs text-slate-500">{doctorInfo.especialidad}</p>
                )}
              </div>
              <span className="ml-auto text-xs font-medium text-[#0059B3] bg-[#0059B3]/10
                               px-2.5 py-1 rounded-full capitalize">
                Vista {vista}
              </span>
            </div>
          )}

          {/* ── Error global ── */}
          {error && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200
                            rounded-2xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">{error}</p>
              <button
                onClick={fetchDisponibilidad}
                className="ml-auto text-xs font-semibold text-amber-700
                           hover:text-amber-900 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* ── Grilla de disponibilidad ── */}
          <GrillaDisponibilidad
            doctorId={doctorId}
            vista={vista}
            fecha={fecha}
            grilla={grilla}
            loading={loading}
            onFechaChange={handleFechaChange}
          />

        </div>
      </div>
    </AppLayout>
  );
}
