import { useState, useEffect, useCallback, useRef } from 'react';
import { LayoutGrid, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import AppLayout from '../../components/AppLayout';
import FiltrosAgenda from '../../components/agenda/FiltrosAgenda';
import GrillaDisponibilidad from '../../components/agenda/GrillaDisponibilidad';
import GrillaMensual from '../../components/agenda/GrillaMensual';

// ── Fecha de hoy en formato YYYY-MM-DD ───────────────────────────
const hoy = () => new Date().toLocaleDateString('en-CA');

// ── Intervalo de refresco automático en vivo (CA6) ───────────────
const POLL_MS = 15000; // 15 s

// ── Registro de auditoría — fire-and-forget ──────────────────────
// Persiste la acción de UI en la tabla AUDITORIA vía POST /api/audit.
// No bloquea la UI si falla (el catch es silencioso).
const auditLog = (accion, detalles) => {
  api.post('/audit', { accion, detalles }).catch(() => {});
};

// ══════════════════════════════════════════════════════════════════
// AgendaMedica — Módulo principal de Agenda Médica para Recepcionista
//
// Estructura:
//   AppLayout
//   └─ Encabezado
//   └─ FiltrosAgenda   (selección de doctor/especialidad/vista)
//   └─ Panel de info del doctor seleccionado
//   └─ GrillaDisponibilidad (diaria/semanal) | GrillaMensual (mensual)
// ══════════════════════════════════════════════════════════════════
export default function AgendaMedica() {
  // ── Filtros ────────────────────────────────────────────────────
  const [doctores,   setDoctores]   = useState([]);
  const [doctorId,   setDoctorId]   = useState('');
  const [servicios,  setServicios]  = useState([]);
  const [servicioId, setServicioId] = useState('');
  const [vista,      setVista]      = useState('diaria');   // 'diaria' | 'semanal' | 'mensual'
  const [fecha,      setFecha]      = useState(hoy());

  // ── Doctor seleccionado (objeto completo) ──────────────────────
  const [doctorInfo, setDoctorInfo] = useState(null);

  // ── Datos de disponibilidad ────────────────────────────────────
  const [grilla,   setGrilla]   = useState({});    // { [fecha]: slots[] }  (diaria/semanal)
  const [mesDias,  setMesDias]  = useState([]);     // [{ fecha, dia, ... }] (mensual)
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [ultimaAct, setUltimaAct] = useState(null); // marca de tiempo del último refresco

  // Ref para cancelar fetches si el componente se desmonta
  const abortRef = useRef(null);

  // ── Carga inicial del catálogo de servicios ───────────────────
  useEffect(() => {
    api.get('/services')
      .then(({ data }) => setServicios(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // ── Doctores según el servicio elegido (o todos si no hay filtro) ──
  useEffect(() => {
    const url = servicioId ? `/doctors/by-service/${servicioId}` : '/doctors';
    api.get(url)
      .then(({ data }) => setDoctores(Array.isArray(data) ? data : []))
      .catch(() => setDoctores([]));
  }, [servicioId]);

  // ── Actualizar doctorInfo cuando cambia doctorId ───────────────
  useEffect(() => {
    if (!doctorId) { setDoctorInfo(null); return; }
    const doc = doctores.find(d => String(d.doctor_id) === String(doctorId));
    setDoctorInfo(doc ?? null);
  }, [doctorId, doctores]);

  // ── Fechas a mostrar según la vista (diaria/semanal) ───────────
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

  // ── Fetch de datos según la vista ──────────────────────────────
  // `silent` = true → refresco en vivo: no limpia la grilla ni muestra
  //   el spinner, para que la actualización no provoque parpadeos.
  const fetchData = useCallback(async (silent = false) => {
    if (!doctorId) return;

    // Cancelar fetch anterior si existe
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (!silent) {
      setLoading(true);
      setError('');
      if (vista === 'mensual') setMesDias([]);
      else                     setGrilla({});
    }

    // Auditoría — solo en cargas explícitas (no en cada poll, para no
    // inundar el log de auditoría).
    if (!silent) {
      auditLog('CONSULTAR_DISPONIBILIDAD_UI', { doctor_id: doctorId, vista, fecha });
    }

    try {
      if (vista === 'mensual') {
        const [anio, mes] = fecha.split('-').map(Number);
        const { data } = await api.get(`/agenda/resumen-mes/${doctorId}`, {
          params: { anio, mes }, signal,
        });
        setMesDias(data.dias ?? []);
        if (data.doctor && !doctorInfo) setDoctorInfo(prev => prev ?? data.doctor);
      } else {
        const fechas = fechasVista();
        const resultados = await Promise.all(
          fechas.map(f =>
            api.get(`/agenda/disponibilidad/${doctorId}`, { params: { fecha: f }, signal })
              .then(({ data }) => ({ fecha: f, slots: data.slots ?? [], doctor: data.doctor }))
              .catch(() => ({ fecha: f, slots: [] }))
          )
        );
        const nueva = {};
        resultados.forEach(({ fecha: f, slots }) => { nueva[f] = slots; });
        setGrilla(nueva);
        const primerConDoctor = resultados.find(r => r.doctor);
        if (primerConDoctor?.doctor && !doctorInfo) {
          setDoctorInfo(prev => prev ?? primerConDoctor.doctor);
        }
      }
      setUltimaAct(new Date());
      if (silent) setError('');
    } catch (err) {
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED' && !silent) {
        setError('No se pudo cargar la disponibilidad. Intente nuevamente.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, vista, fecha]);

  // ── Manejadores de filtros ─────────────────────────────────────
  const handleVistaChange = (nuevaVista) => {
    if (nuevaVista === vista) return;
    auditLog('CAMBIO_VISTA_AGENDA', { vista_anterior: vista, vista_nueva: nuevaVista, doctor_id: doctorId });
    setVista(nuevaVista);
  };

  const handleFechaChange = (nuevaFecha) => setFecha(nuevaFecha);

  // Navegación de mes (vista mensual)
  const handleNavegarMes = (delta) => {
    const [y, m] = fecha.split('-').map(Number);
    const nd = new Date(y, m - 1 + delta, 1);
    setFecha(nd.toLocaleDateString('en-CA'));
  };

  // Al hacer clic en un día del calendario mensual → vista diaria de ese día
  const handleSelectDia = (fechaDia) => {
    auditLog('CAMBIO_VISTA_AGENDA', { vista_anterior: 'mensual', vista_nueva: 'diaria', doctor_id: doctorId });
    setFecha(fechaDia);
    setVista('diaria');
  };

  // Auto-cargar cuando cambia vista, fecha o doctor
  useEffect(() => {
    if (doctorId) fetchData(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, fecha, doctorId]);

  // ── Sincronización en tiempo real (CA6) ────────────────────────
  // Refresca en silencio cada POLL_MS para reflejar cancelaciones,
  // reprogramaciones o nuevas reservas hechas desde el portal público,
  // sin que la recepcionista tenga que recargar la página.
  // Se pausa cuando la pestaña no está visible para no malgastar red.
  useEffect(() => {
    if (!doctorId) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData(true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [doctorId, fetchData]);

  // ── Render ─────────────────────────────────────────────────────
  const [anioSel, mesSel] = fecha.split('-').map(Number);

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
              Visualiza la disponibilidad de los doctores por día, semana o mes
            </p>
          </div>

          {/* ── Filtros ── */}
          <FiltrosAgenda
            doctores={doctores}
            doctorId={doctorId}
            servicios={servicios}
            servicioId={servicioId}
            vista={vista}
            onDoctorChange={setDoctorId}
            onServicioChange={setServicioId}
            onVistaChange={handleVistaChange}
            onBuscar={() => fetchData(false)}
            loading={loading}
          />

          {/* ── Banner de doctor seleccionado ── */}
          {doctorInfo && (
            <div className="bg-[#0059B3]/5 border border-[#0059B3]/20 rounded-2xl
                            px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                {doctorInfo.avatar ? (
                  <img
                    src={doctorInfo.avatar?.startsWith('http') ? doctorInfo.avatar : `${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${doctorInfo.avatar}`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0059B3]/10 flex items-center
                                  justify-center text-[#0059B3] text-sm font-bold">
                    {(doctorInfo.nombre ?? '?')[0]}{(doctorInfo.apellido ?? '')[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {doctorInfo.nombre} {doctorInfo.apellido}
                </p>
                {doctorInfo.especialidad && (
                  <p className="text-xs text-slate-500">{doctorInfo.especialidad}</p>
                )}
              </div>

              {/* Indicador de actualización en vivo */}
              <div className="ml-auto flex items-center gap-3">
                {ultimaAct && (
                  <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-600">
                    <RefreshCw size={11} className="animate-[spin_3s_linear_infinite]" />
                    En vivo · {ultimaAct.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <span className="text-xs font-medium text-[#0059B3] bg-[#0059B3]/10
                                 px-2.5 py-1 rounded-full capitalize">
                  Vista {vista}
                </span>
              </div>
            </div>
          )}

          {/* ── Error global ── */}
          {error && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200
                            rounded-2xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">{error}</p>
              <button
                onClick={() => fetchData(false)}
                className="ml-auto text-xs font-semibold text-amber-700
                           hover:text-amber-900 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* ── Grilla / Calendario ── */}
          {vista === 'mensual' ? (
            <GrillaMensual
              doctorId={doctorId}
              anio={anioSel}
              mes={mesSel}
              dias={mesDias}
              loading={loading}
              onNavegar={handleNavegarMes}
              onSelectDia={handleSelectDia}
            />
          ) : (
            <GrillaDisponibilidad
              doctorId={doctorId}
              vista={vista}
              fecha={fecha}
              grilla={grilla}
              loading={loading}
              onFechaChange={handleFechaChange}
            />
          )}

        </div>
      </div>
    </AppLayout>
  );
}
