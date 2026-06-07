import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Ban, CalendarClock,
  Hash, Calendar, Clock, Timer, User, Phone, Mail, IdCard,
  Stethoscope, DollarSign, CreditCard, UserCircle, CheckCircle2, FileLock2,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';
import { estadoInfo, PAGO_ESTADOS, fmtFecha, fmtFechaHora } from './citaEstados';
import ModalCancelarCita from '../../components/appointments/ModalCancelarCita';

const ACCIONABLES = ['RESERVADA', 'CONFIRMADA'];

export default function DetalleCita() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [cita,          setCita]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [modalCancelar, setModalCancelar] = useState(false);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError('');
    api.get(`/appointments/${id}`)
      .then(({ data }) => { if (activo) setCita(data); })
      .catch((err) => {
        if (!activo) return;
        if (err.response?.status === 404) setError('La cita no existe o fue eliminada.');
        else setError('Error de conexión. Intente más tarde.');
      })
      .finally(() => activo && setLoading(false));
    return () => { activo = false; };
  }, [id]);

  const proximamente = (accion) =>
    toast(`"${accion}" estará disponible en la siguiente actualización.`, { icon: '🔧' });

  // ── Loading ──
  if (loading) {
    return (
      <AppLayout>
        <div className="px-4 py-8 max-w-3xl mx-auto space-y-4">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-40 w-full rounded-2xl" />
          <div className="skeleton h-40 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <AlertTriangle size={40} className="text-amber-400 mx-auto mb-3" />
          <p className="text-slate-600">{error}</p>
          <button onClick={() => navigate('/recepcion/citas')}
            className="mt-4 text-[#0059B3] text-sm font-medium hover:underline">
            ← Volver al listado
          </button>
        </div>
      </AppLayout>
    );
  }

  const est        = estadoInfo(cita.estado);
  const pagoEstado = cita.pago?.estado ?? 'PENDIENTE';
  const pagoInfo   = PAGO_ESTADOS[pagoEstado] ?? PAGO_ESTADOS.PENDIENTE;
  const accionable = ACCIONABLES.includes(cita.estado);

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/recepcion/citas')}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-[#0059B3]">Detalle de la cita</h1>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold
                                  px-2.5 py-1 rounded-full border ${est.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} /> {est.label}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-mono mt-0.5">{cita.codigo_cita}</p>
            </div>
          </div>

          {/* Datos de la cita */}
          <Section title="Datos de la cita">
            <Row icon={Hash}     label="Código"          value={<span className="font-mono">{cita.codigo_cita}</span>} />
            <Row icon={Calendar} label="Fecha"           value={fmtFecha(cita.fecha)} />
            <Row icon={Clock}    label="Hora"            value={`${cita.hora_inicio} – ${cita.hora_fin}`} />
            <Row icon={Timer}    label="Duración"        value={cita.duracion ? `${cita.duracion} min` : '—'} />
            <Row icon={CheckCircle2} label="Estado"      value={est.label} />
            <Row icon={Calendar} label="Fecha de creación" value={fmtFechaHora(cita.fecha_creacion)} />
            <Row icon={UserCircle} label="Creada por"
              value={cita.creado_por === 'PACIENTE_ONLINE'
                ? 'Paciente (online)'
                : (cita.creado_por_nombre || 'Personal')} />
          </Section>

          {/* Datos del paciente */}
          <Section title="Datos del paciente">
            <Row icon={User}   label="Nombre completo" value={cita.paciente_nombre} />
            <Row icon={IdCard} label="Documento"       value={`${cita.tipo_documento}: ${cita.numero_documento}`} />
            <Row icon={Phone}  label="Teléfono"        value={cita.paciente_telefono || '—'} />
            <Row icon={Mail}   label="Correo"          value={cita.paciente_email || 'No registrado'} />
          </Section>

          {/* Datos del servicio */}
          <Section title="Datos del servicio">
            <Row icon={Stethoscope} label="Servicio"   value={cita.servicio_nombre} />
            <Row icon={DollarSign}  label="Costo aplicado" value={`S/ ${Number(cita.precio_aplicado).toFixed(2)}`} />
            <Row icon={UserCircle}  label="Doctor asignado"
              value={cita.doctor_nombre + (cita.especialidad ? ` · ${cita.especialidad}` : '')} />
          </Section>

          {/* Datos del pago (solo visualización) */}
          <Section title="Datos del pago">
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="flex items-center gap-3 text-sm text-slate-500">
                <CreditCard size={16} className="text-slate-400" /> Estado del pago
              </span>
              <span className={`inline-flex items-center text-xs font-semibold
                                px-2.5 py-1 rounded-full border ${pagoInfo.cls}`}>
                {pagoInfo.label}
              </span>
            </div>
            {pagoEstado === 'COMPLETADO' && (
              <Row icon={Calendar} label="Fecha del pago" value={fmtFechaHora(cita.pago?.fecha_pago)} />
            )}
          </Section>

          {/* Atención clínica — solo existencia (sin detalle clínico) */}
          {cita.estado === 'ATENDIDA' && cita.atencion && (
            <Section title="Atención clínica">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <FileLock2 size={18} className="text-[#0059B3] mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-slate-700">
                    Esta cita cuenta con una atención clínica registrada.
                  </p>
                  <p className="text-slate-500 mt-1">
                    Atendida el <strong>{fmtFechaHora(cita.atencion.fecha_atencion)}</strong>
                    {cita.atencion.doctor_nombre ? <> por <strong>{cita.atencion.doctor_nombre}</strong></> : null}.
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    La información clínica detallada solo es visible para el personal médico.
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Acciones según estado */}
          {accionable ? (
            <div className="flex gap-3">
              <button onClick={() => proximamente('Reprogramar cita')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                           border-2 border-[#0059B3] text-[#0059B3] text-sm font-semibold
                           hover:bg-blue-50 transition-colors">
                <CalendarClock size={16} /> Reprogramar cita
              </button>
              <button
                onClick={() => setModalCancelar(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                           bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-semibold
                           transition-colors">
                <Ban size={16} /> Cancelar cita
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400 py-2">
              Esta cita está en estado <strong>{est.label}</strong> — solo visualización.
            </p>
          )}

          {/* Modal de confirmación de cancelación */}
          <ModalCancelarCita
            open={modalCancelar}
            onClose={() => setModalCancelar(false)}
            citaId={cita.cita_id}
            codigoCita={cita.codigo_cita}
          />
        </div>
      </div>
    </AppLayout>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="flex items-center gap-3 text-sm text-slate-500 flex-shrink-0">
        <Icon size={16} className="text-slate-400" /> {label}
      </span>
      <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}
