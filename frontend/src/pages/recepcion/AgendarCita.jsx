import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Search, Check, Pencil, X } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

const DIAS_ES = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado',
};

const PASOS = ['Paciente', 'Servicio', 'Doctor', 'Fecha', 'Confirmar'];

const soloLetras  = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
const soloNumeros = (v, max) => v.replace(/\D/g, '').slice(0, max);

export default function AgendarCita() {
  const navigate = useNavigate();

  // ── Búsqueda de paciente ─────────────────────────────────────
  const [busqueda, setBusqueda]           = useState('');
  const [buscando, setBuscando]           = useState(false);
  const [resultados, setResultados]       = useState([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [paciente, setPaciente]           = useState(null);

  // ── Modal editar paciente ────────────────────────────────────
  const [editModal, setEditModal]             = useState(false);
  const [editForm, setEditForm]               = useState({});
  const [editErrors, setEditErrors]           = useState({});
  const [editLoading, setEditLoading]         = useState(false);
  const [loadingEditData, setLoadingEditData] = useState(false);

  // ── Selecciones ──────────────────────────────────────────────
  const [servicios, setServicios]         = useState([]);
  const [servicio, setServicio]           = useState(null);
  const [doctores, setDoctores]           = useState([]);
  const [doctor, setDoctor]               = useState(null);
  const [diasDoctor, setDiasDoctor]       = useState([]);
  const [fecha, setFecha]                 = useState('');
  const [slots, setSlots]                 = useState([]);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [slot, setSlot]                   = useState(null);

  // ── Submit ───────────────────────────────────────────────────
  const [loading, setLoading]           = useState(false);
  const [serverError, setServerError]   = useState('');

  const today = new Date().toLocaleDateString('en-CA');
  const currentStep = !paciente ? 1 : !servicio ? 2 : !doctor ? 3 : !slot ? 4 : 5;

  useEffect(() => {
    api.get('/services')
      .then(({ data }) => setServicios(Array.isArray(data) ? data : []))
      .catch(() => toast.error('No se pudieron cargar los servicios'));
  }, []);

  // ── Temporizador de Reserva (10 minutos) ─────────────────────
  useEffect(() => {
    if (!slot) return;

    const timer = setTimeout(() => {
      setSlot(null); // Libera el horario y regresa a la vista del calendario
      toast.error('Tiempo de reserva expirado, seleccione otro horario.');
    }, 10 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [slot]);

  // ── Buscar paciente ──────────────────────────────────────────
  const handleSearch = async () => {
    if (busqueda.trim().length < 2) return;
    setBuscando(true); setSinResultados(false); setResultados([]);
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
    setResultados([]); setBusqueda(''); setSinResultados(false);
    setServicio(null); setDoctor(null); setDiasDoctor([]);
    setFecha(''); setSlots([]); setSlot(null); setServerError('');
  };

  const cambiarPaciente = () => {
    setPaciente(null);
    setServicio(null); setDoctor(null); setDiasDoctor([]);
    setFecha(''); setSlots([]); setSlot(null); setServerError('');
  };

  // ── Editar datos del paciente ────────────────────────────────
  const abrirEdicion = async () => {
    setLoadingEditData(true);
    try {
      const { data } = await api.get(`/patients/${paciente.paciente_id}`);
      setEditForm({
        telefono:            data.telefono,
        email:               data.email               ?? '',
        direccion:           data.direccion            ?? '',
        ocupacion:           data.ocupacion            ?? '',
        contacto_emergencia: data.contacto_emergencia  ?? '',
        // Solo para mostrar como referencia en el modal (no editables)
        _nombre:             data.nombre,
        _apellido:           data.apellido,
        _sexo:               data.sexo,
        _fecha_nacimiento:   data.fecha_nacimiento ?? '',
        _tipo_documento:     data.tipo_documento,
        _numero_documento:   data.numero_documento,
      });
      setEditErrors({});
      setEditModal(true);
    } catch {
      toast.error('No se pudieron cargar los datos del paciente');
    } finally {
      setLoadingEditData(false);
    }
  };

  const handleEditChange = (e) => {
    let { name, value } = e.target;
    if (name === 'telefono' || name === 'contacto_emergencia')
      value = soloNumeros(value, 9);
    setEditForm(p => ({ ...p, [name]: value }));
    setEditErrors(p => ({ ...p, [name]: '' }));
  };

  const validateEdit = () => {
    const e = {};
    if (!/^\d{9}$/.test(editForm.telefono))
      e.telefono = 'El teléfono debe tener 9 dígitos';
    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim()))
      e.email = 'Correo electrónico inválido';
    if (editForm.contacto_emergencia && !/^\d{9}$/.test(editForm.contacto_emergencia))
      e.contacto_emergencia = 'Debe tener 9 dígitos';
    return e;
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    const errs = validateEdit();
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setEditLoading(true);
    try {
      await api.put(`/patients/${paciente.paciente_id}`, {
        telefono:            editForm.telefono,
        email:               editForm.email.trim()               || undefined,
        direccion:           editForm.direccion.trim()            || undefined,
        ocupacion:           editForm.ocupacion.trim()            || undefined,
        contacto_emergencia: editForm.contacto_emergencia.trim()  || undefined,
      });
      // Reflejar el teléfono actualizado en la tarjeta del paciente
      setPaciente(prev => ({ ...prev, telefono: editForm.telefono }));
      toast.success('Datos de contacto actualizados');
      setEditModal(false);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al actualizar los datos';
      toast.error(msg);
    } finally {
      setEditLoading(false);
    }
  };

  // ── Cambiar servicio → cargar doctores ───────────────────────
  const handleServicioChange = async (e) => {
    const id  = Number(e.target.value);
    const svc = servicios.find(s => s.servicio_id === id) ?? null;
    setServicio(svc);
    setDoctor(null); setDiasDoctor([]);
    setFecha(''); setSlots([]); setSlot(null); setServerError('');
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
    setFecha(''); setSlots([]); setSlot(null); setServerError('');
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
    setFecha(f); setSlot(null); setSlots([]); setServerError('');
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

  // ── Submit cita ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!paciente || !servicio || !doctor || !fecha || !slot) return;
    setLoading(true); setServerError('');
    try {
      const { data } = await api.post('/appointments', {
        paciente_id: paciente.paciente_id,
        doctor_id:   doctor.doctor_id,
        servicio_id: servicio.servicio_id,
        fecha,
        hora_inicio: slot.hora_inicio,
      });
      toast.success(`Cita agendada · Código: ${data.codigo_cita}`);
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
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="mb-2">
            <h1 className="text-xl font-bold text-[#0059B3]">Agendar cita</h1>
            <p className="text-sm text-slate-500">Complete los pasos para registrar la cita</p>
          </div>

          {/* Stepper */}
          <Stepper current={currentStep} />

          {/* ── Paso 1: Buscar paciente ── */}
          <StepCard step="1" title="Buscar paciente" active={currentStep === 1} done={currentStep > 1}>
            {paciente ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {paciente.nombre} {paciente.apellido}
                    </p>
                    <p className="text-xs text-slate-500">
                      {paciente.tipo_documento}: {paciente.numero_documento} · Tel: {paciente.telefono}
                    </p>
                  </div>
                  {/* Botones: Editar + Cambiar */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={abrirEdicion}
                      disabled={loadingEditData}
                      className="flex items-center gap-1 text-xs text-[#0059B3] hover:text-[#004a99]
                                 font-medium disabled:opacity-50 transition-colors"
                    >
                      {loadingEditData
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Pencil size={12} />}
                      Editar datos
                    </button>
                    <button
                      onClick={cambiarPaciente}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
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
            <StepCard step="2" title="Servicio" active={currentStep === 2} done={currentStep > 2}>
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
            <StepCard step="3" title="Doctor" active={currentStep === 3} done={currentStep > 3}>
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
                      Dr. {d.apellido}, {d.nombre}
                    </option>
                  ))}
                </select>
              )}
            </StepCard>
          )}

          {/* ── Paso 4: Fecha y hora ── */}
          {doctor && (
            <StepCard step="4" title="Fecha y hora" active={currentStep === 4} done={currentStep > 4}>
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
                      <p className="text-xs font-medium text-slate-600 mb-2">Horarios disponibles</p>
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
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4 border-l-4 border-[#8BC63F]">
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
                <Row label="Hora" value={`${slot.hora_inicio} – ${slot.hora_fin}`} />
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
                  ? <><Loader2 size={16} className="animate-spin" /> Reservando...</>
                  : <><Calendar size={16} /> Reservar cita</>}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Modal: Editar datos del paciente ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative my-auto">

            <button
              onClick={() => setEditModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100
                         text-slate-400 transition-colors"
            >
              <X size={18} />
            </button>

            <h2 className="text-base font-bold text-[#0059B3] mb-0.5">
              Actualizar datos de contacto
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Solo se pueden modificar los datos de contacto. Los datos de identidad
              del paciente no son editables.
            </p>

            {/* Datos de identidad — solo lectura */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
                            grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs mb-2">
              <ReadonlyField label="Nombre completo"
                value={`${editForm._nombre} ${editForm._apellido}`} />
              <ReadonlyField label="Documento"
                value={`${editForm._tipo_documento}: ${editForm._numero_documento}`} />
              <ReadonlyField label="Sexo"
                value={editForm._sexo === 'FEMENINO' ? 'Femenino' : 'Masculino'} />
              <ReadonlyField label="Fecha de nacimiento"
                value={editForm._fecha_nacimiento
                  ? new Date(editForm._fecha_nacimiento + 'T00:00:00')
                      .toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'} />
            </div>

            <form onSubmit={guardarEdicion} noValidate className="space-y-4">

              {/* Teléfono — obligatorio */}
              <EField label="Teléfono *" error={editErrors.telefono} hint="9 dígitos">
                <EInput name="telefono" value={editForm.telefono}
                        onChange={handleEditChange}
                        inputMode="numeric" maxLength={9}
                        placeholder="987654321" error={editErrors.telefono} />
              </EField>

              {/* Email */}
              <EField label="Correo electrónico" error={editErrors.email}>
                <EInput type="email" name="email" value={editForm.email}
                        onChange={handleEditChange}
                        placeholder="correo@ejemplo.com" error={editErrors.email} />
              </EField>

              {/* Dirección */}
              <EField label="Dirección">
                <EInput name="direccion" value={editForm.direccion}
                        onChange={handleEditChange} placeholder="Av. Ejemplo 123, Lima" />
              </EField>

              <div className="grid grid-cols-2 gap-3">
                <EField label="Ocupación">
                  <EInput name="ocupacion" value={editForm.ocupacion}
                          onChange={handleEditChange} placeholder="Ej. Docente" />
                </EField>
                <EField label="Contacto emergencia" error={editErrors.contacto_emergencia}
                        hint="9 dígitos">
                  <EInput name="contacto_emergencia" value={editForm.contacto_emergencia}
                          onChange={handleEditChange}
                          inputMode="numeric" maxLength={9}
                          placeholder="987654321" error={editErrors.contacto_emergencia} />
                </EField>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditModal(false)}
                  className="flex-1 border border-slate-300 rounded-lg py-2 text-sm
                             font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-[#8BC63F] hover:bg-[#78ae35] disabled:opacity-60
                             disabled:cursor-not-allowed text-white font-semibold
                             py-2 rounded-lg text-sm transition-colors"
                >
                  {editLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                    : <><Check size={15} /> Guardar cambios</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </AppLayout>
  );
}

// ── Stepper ──────────────────────────────────────────────────────
function Stepper({ current }) {
  return (
    <div className="flex items-start mb-2">
      {PASOS.map((label, i) => {
        const n = i + 1; const done = n < current; const active = n === current;
        return (
          <Fragment key={label}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center
                              text-xs font-bold transition-all duration-300
                              ${done   ? 'bg-[#8BC63F] text-white'
                              : active ? 'bg-[#0059B3] text-white ring-4 ring-[#0059B3]/20'
                              :          'bg-slate-200 text-slate-400'}`}>
                {done ? <Check size={13} /> : n}
              </div>
              <span className={`text-[10px] mt-1 font-medium text-center hidden sm:block
                               transition-colors duration-300
                               ${done ? 'text-[#8BC63F]' : active ? 'text-[#0059B3]' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-[13px] mx-1 transition-colors duration-300
                              ${done ? 'bg-[#8BC63F]' : 'bg-slate-200'}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Helpers principales ──────────────────────────────────────────
function StepCard({ step, title, active, done, children }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-6 space-y-3 transition-all duration-200
                     ${active ? 'ring-2 ring-[#0059B3]/20' : ''}
                     ${done   ? 'opacity-80' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-6 h-6 rounded-full text-white text-xs font-bold
                          flex items-center justify-center flex-shrink-0 transition-colors
                          ${done ? 'bg-[#8BC63F]' : 'bg-[#0059B3]'}`}>
          {done ? <Check size={12} /> : step}
        </span>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {done && <span className="ml-auto text-[10px] text-[#8BC63F] font-semibold">Completado</span>}
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

// ── Helpers del modal de edición ─────────────────────────────────
function EField({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error
        ? <p className="text-xs text-red-500 mt-1">⚠ {error}</p>
        : hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function EInput({ error, ...props }) {
  return (
    <input
      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                  focus:ring-2 transition-shadow
                  ${error
                    ? 'border-red-400 focus:ring-red-300'
                    : 'border-slate-300 focus:ring-[#0059B3]/40'}`}
      {...props}
    />
  );
}

function ReadonlyField({ label, value }) {
  return (
    <div>
      <span className="text-slate-400 block">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
