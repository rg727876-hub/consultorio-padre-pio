import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, ChevronLeft, Search } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const DIAS_ES = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado',
};

export default function AgendarCita() {
  const navigate = useNavigate();

  // ── Búsqueda de paciente ─────────────────────────────────────
  const [busqueda, setBusqueda]       = useState('');
  const [buscando, setBuscando]       = useState(false);
  const [resultados, setResultados]   = useState([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [paciente, setPaciente]       = useState(null);

  // ── Selecciones ──────────────────────────────────────────────
  const [servicios, setServicios]     = useState([]);
  const [servicio, setServicio]       = useState(null);
  const [doctores, setDoctores]       = useState([]);
  const [doctor, setDoctor]           = useState(null);
  const [diasDoctor, setDiasDoctor]   = useState([]);
  const [fecha, setFecha]             = useState('');
  const [slots, setSlots]             = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot]               = useState(null);

  // ── Submit ───────────────────────────────────────────────────
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');

  const today = new Date().toLocaleDateString('en-CA');

  // Cargar servicios activos al montar
  useEffect(() => {
    api.get('/services')
      .then(({ data }) => setServicios(Array.isArray(data) ? data : []))
      .catch(() => toast.error('No se pudieron cargar los servicios'));
  }, []);

  // ── Buscar paciente ──────────────────────────────────────────
  const handleSearch = async () => {
    if (busqueda.trim().length < 2) return;
    setBuscando(true);
    setSinResultados(false);
    setResultados([]);
    try {
      const { data } = await api.get('/patients/search', { params: { q: busqueda.trim() } });
      if (data.length === 0) setSinResultados(true);
      setResultados(data);
    } catch {
      toast.error('Error al buscar paciente');
    } finally {
      setBuscando(false);
    }
  };

  const selectPaciente = (p) => {
    setPaciente(p);
    setResultados([]);
    setBusqueda('');
    setSinResultados(false);
    // Resetear pasos siguientes
    setServicio(null); setDoctor(null); setDiasDoctor([]);
    setFecha(''); setSlots([]); setSlot(null);
    setServerError('');
  };

  const cambiarPaciente = () => {
    setPaciente(null);
    setServicio(null); setDoctor(null); setDiasDoctor([]);
    setFecha(''); setSlots([]); setSlot(null);
    setServerError('');
  };

  // ── Cambiar servicio → cargar doctores ───────────────────────
  const handleServicioChange = async (e) => {
    const id  = Number(e.target.value);
    const svc = servicios.find(s => s.servicio_id === id) ?? null;
    setServicio(svc);
    setDoctor(null); setDiasDoctor([]);
    setFecha(''); setSlots([]); setSlot(null);
    setServerError('');
    if (!svc) { setDoctores([]); return; }
    try {
      const { data } = await api.get(`/doctors/by-service/${id}`);
      setDoctores(Array.isArray(data) ? data : []);
    } catch {
      toast.error('No se pudieron cargar los doctores');
      setDoctores([]);
    }
  };

  // ── Cambiar doctor → cargar días de atención ─────────────────
  const handleDoctorChange = async (e) => {
    const id  = Number(e.target.value);
    const doc = doctores.find(d => d.doctor_id === id) ?? null;
    setDoctor(doc);
    setFecha(''); setSlots([]); setSlot(null);
    setServerError('');
    if (!doc) { setDiasDoctor([]); return; }
    try {
      const { data } = await api.get('/schedules', { params: { doctor_id: id } });
      const dias = [...new Set(
        (Array.isArray(data) ? data : [])
          .filter(h => h.estado === 'ACTIVO')
          .map(h => h.dia_semana)
      )];
      setDiasDoctor(dias);
    } catch {
      setDiasDoctor([]);
    }
  };

  // ── Cambiar fecha → cargar slots disponibles ─────────────────
  const handleFechaChange = async (e) => {
    const f = e.target.value;
    setFecha(f);
    setSlot(null); setSlots([]);
    setServerError('');
    if (!f || !doctor || !servicio) return;
    setLoadingSlots(true);
    try {
      const { data } = await api.get('/appointments/slots', {
        params: { doctor_id: doctor.doctor_id, servicio_id: servicio.servicio_id, fecha: f },
      });
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      toast.error('Error al cargar horarios disponibles');
    } finally {
      setLoadingSlots(false);
    }
  };

  // ── Recargar slots (tras conflicto) ─────────────────────────
  const recargarSlots = async () => {
    if (!doctor || !servicio || !fecha) return;
    try {
      const { data } = await api.get('/appointments/slots', {
        params: { doctor_id: doctor.doctor_id, servicio_id: servicio.servicio_id, fecha },
      });
      setSlots(Array.isArray(data.slots) ? data.slots : []);
      setSlot(null);
    } catch {}
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!paciente || !servicio || !doctor || !fecha || !slot) return;
    setLoading(true);
    setServerError('');
    try {
      const { data } = await api.post('/appointments', {
        paciente_id: paciente.paciente_id,
        doctor_id:   doctor.doctor_id,
        servicio_id: servicio.servicio_id,
        fecha,
        hora_inicio: slot.hora_inicio,
      });
      toast.success(`Cita agendada · Código: ${data.codigo_cita}`);
      // Resetear formulario conservando servicios cargados
      setPaciente(null); setServicio(null); setDoctor(null);
      setDiasDoctor([]); setFecha(''); setSlots([]); setSlot(null);
      setDoctores([]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al agendar la cita';
      setServerError(msg);
      if (err.response?.status === 409) recargarSlots();
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = paciente && servicio && doctor && fecha && slot;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/dashboard')}
                  className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#0059B3]">Agendar cita</h1>
            <p className="text-sm text-slate-500">Complete los pasos para registrar la cita</p>
          </div>
        </div>

        {/* ── Paso 1: Buscar paciente ── */}
        <StepCard step="1" title="Buscar paciente">
          {paciente ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200
                            rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  {paciente.nombre} {paciente.apellido}
                </p>
                <p className="text-xs text-slate-500">
                  {paciente.tipo_documento}: {paciente.numero_documento} · Tel: {paciente.telefono}
                </p>
              </div>
              <button onClick={cambiarPaciente}
                      className="text-xs text-red-500 hover:text-red-700 font-medium ml-4">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setSinResultados(false); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar por nombre o número de documento"
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                />
                <button
                  onClick={handleSearch}
                  disabled={buscando || busqueda.trim().length < 2}
                  className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99]
                             disabled:opacity-50 text-white text-sm font-medium
                             px-3 py-2 rounded-lg transition-colors"
                >
                  {buscando
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Search size={14} />}
                  Buscar
                </button>
              </div>

              {resultados.length > 0 && (
                <ul className="mt-2 border border-slate-200 rounded-xl divide-y overflow-hidden">
                  {resultados.map(p => (
                    <li key={p.paciente_id}>
                      <button onClick={() => selectPaciente(p)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors">
                        <p className="text-sm font-medium text-slate-800">
                          {p.nombre} {p.apellido}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.tipo_documento}: {p.numero_documento}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sinResultados && (
                <p className="text-sm text-slate-500 mt-1">
                  No se encontró el paciente.{' '}
                  <button onClick={() => navigate('/recepcion/pacientes/nuevo')}
                          className="text-[#0059B3] underline">
                    Registrar nuevo paciente
                  </button>
                </p>
              )}
            </>
          )}
        </StepCard>

        {/* ── Paso 2: Servicio ── */}
        {paciente && (
          <StepCard step="2" title="Servicio">
            <select value={servicio?.servicio_id ?? ''} onChange={handleServicioChange}
                    className={selectCls()}>
              <option value="">Selecciona un servicio</option>
              {servicios.map(s => (
                <option key={s.servicio_id} value={s.servicio_id}>
                  {s.nombre} · S/ {Number(s.costo).toFixed(2)} · {s.duracion} min
                </option>
              ))}
            </select>
          </StepCard>
        )}

        {/* ── Paso 3: Doctor ── */}
        {servicio && (
          <StepCard step="3" title="Doctor">
            {doctores.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay doctores asignados a este servicio.
              </p>
            ) : (
              <select value={doctor?.doctor_id ?? ''} onChange={handleDoctorChange}
                      className={selectCls()}>
                <option value="">Selecciona un doctor</option>
                {doctores.map(d => (
                  <option key={d.doctor_id} value={d.doctor_id}>
                    Dr. {d.apellido}, {d.nombre} · {d.especialidad}
                  </option>
                ))}
              </select>
            )}
          </StepCard>
        )}

        {/* ── Paso 4: Fecha y hora ── */}
        {doctor && (
          <StepCard step="4" title="Fecha y hora">
            {diasDoctor.length > 0 && (
              <p className="text-xs text-slate-500 mb-2">
                Atiende: {diasDoctor.map(d => DIAS_ES[d] ?? d).join(', ')}
              </p>
            )}
            <input
              type="date"
              min={today}
              value={fecha}
              onChange={handleFechaChange}
              className="w-full sm:w-52 border border-slate-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
            />

            {fecha && (
              <div className="mt-3">
                {loadingSlots ? (
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Cargando horarios...
                  </p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No hay horarios disponibles para este día. Prueba con otra fecha.
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      Horarios disponibles
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map(s => (
                        <button
                          key={s.hora_inicio}
                          type="button"
                          onClick={() => { setSlot(s); setServerError(''); }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                            ${slot?.hora_inicio === s.hora_inicio
                              ? 'bg-[#0059B3] text-white shadow-sm'
                              : 'bg-white border border-slate-300 text-slate-700 hover:border-[#0059B3] hover:text-[#0059B3]'
                            }`}
                        >
                          {s.hora_inicio}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </StepCard>
        )}

        {/* ── Resumen y confirmar ── */}
        {canSubmit && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <p className="text-xs font-semibold text-[#0059B3] uppercase tracking-wider
                          border-b border-slate-100 pb-1">
              Resumen de la cita
            </p>
            <div className="space-y-2 text-sm">
              <Row label="Paciente"  value={`${paciente.nombre} ${paciente.apellido}`} />
              <Row label="Servicio"  value={`${servicio.nombre} · S/ ${Number(servicio.costo).toFixed(2)}`} />
              <Row label="Doctor"    value={`Dr. ${doctor.apellido}, ${doctor.nombre}`} />
              <Row label="Fecha"
                   value={new Date(fecha + 'T00:00:00').toLocaleDateString('es-PE', {
                     weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                   })} />
              <Row label="Hora"      value={`${slot.hora_inicio} – ${slot.hora_fin}`} />
            </div>

            {serverError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200
                              text-red-700 text-sm rounded-lg px-3 py-2.5">
                <span className="shrink-0 mt-0.5">✕</span>
                <span>{serverError}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2
                         bg-[#8BC63F] hover:bg-[#78ae35] active:bg-[#669230]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-semibold py-2.5 rounded-lg text-sm
                         transition-colors duration-200 shadow-sm"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Agendando...</>
                : <><Calendar size={16} /> Confirmar cita</>}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
function StepCard({ step, title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-full bg-[#0059B3] text-white text-xs font-bold
                         flex items-center justify-center flex-shrink-0">
          {step}
        </span>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 w-20 flex-shrink-0 text-xs pt-0.5">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function selectCls() {
  return `w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
          focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 transition-shadow`;
}
