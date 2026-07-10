import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate }            from 'react-router-dom';
import { createPortal }                      from 'react-dom';
import {
  ArrowLeft, AlertTriangle, Pencil, UserX, UserCheck,
  User, Phone, Mail, MapPin, Briefcase, PhoneCall, IdCard,
  Calendar, Clock, Stethoscope, Loader2, X, ShieldAlert,
  FileLock2,
} from 'lucide-react';
import api       from '../../api/axios';
import toast     from 'react-hot-toast';
import Modal     from '../../components/Modal';
import { estadoInfo, fmtFecha } from './citaEstados';

// ── Helpers ───────────────────────────────────────────────────────
const DOC_LABEL  = { DNI: 'DNI', CE: 'C.E.', PASAPORTE: 'Pasaporte' };
const SEXO_LABEL = { FEMENINO: 'Femenino', MASCULINO: 'Masculino' };

const val = (v, fallback = '—') => v || fallback;

// Fecha de hoy en "YYYY-MM-DD" sin offset de UTC
const hoyISO = () => new Date().toLocaleDateString('en-CA');

// ════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════
export default function DetallePaciente({ id: propId, onClose }) {
  const params   = useParams();
  const navigate = useNavigate();
  const id       = propId ?? params.id;
  const cerrar   = onClose ?? (() => navigate('/recepcion/pacientes'));

  // ── Datos ───────────────────────────────────────────────────
  const [paciente, setPaciente] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // ── UI ──────────────────────────────────────────────────────
  const [tab,            setTab]            = useState('datos');      // 'datos' | 'citas'
  const [modalEditar,    setModalEditar]    = useState(false);
  const [modalEstado,    setModalEstado]    = useState(false);        // desactivar / reactivar

  // ── Fetch del perfil ────────────────────────────────────────
  const fetchPaciente = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/patients/${id}`);
      setPaciente(data);
    } catch (err) {
      if (err.response?.status === 404) setError('El paciente no existe o fue eliminado.');
      else setError('Error de conexión. Intente más tarde.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPaciente(); }, [fetchPaciente]);

  // ── Citas futuras con estado activo (para la advertencia del modal) ──
  const citasFuturasActivas = (paciente?.citas ?? []).filter(c =>
    c.fecha >= hoyISO() && ['RESERVADA', 'CONFIRMADA'].includes(c.estado)
  );

  // ══════════════════════════════════════════════════════════════
  // Loading
  // ══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <Modal onClose={cerrar}>
        <div className="p-6 space-y-4">
          <div className="skeleton h-8 w-52" />
          <div className="skeleton h-10 w-full rounded-2xl" />
          <div className="skeleton h-48 w-full rounded-2xl" />
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      </Modal>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Error
  // ══════════════════════════════════════════════════════════════
  if (error) {
    return (
      <Modal onClose={cerrar}>
        <div className="px-6 py-16 text-center">
          <AlertTriangle size={40} className="text-amber-400 mx-auto mb-3" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={cerrar}
            className="mt-4 text-[#0059B3] text-sm font-medium hover:underline"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    );
  }

  const inactivo = paciente.estado === 'INACTIVO';

  // ══════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════
  return (
    <Modal onClose={cerrar}>
      <div className="p-6">
        <div className="space-y-4">

          {/* ── Encabezado ── */}
          <div className="flex items-start gap-3 pr-8">
            <button
              onClick={cerrar}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors mt-0.5"
            >
              <ArrowLeft size={18} />
            </button>
            
            <div className="flex items-center gap-4 flex-1 flex-wrap">
              <div className="w-20 h-20 rounded-full bg-[#0059B3]/10 flex items-center justify-center
                              text-[#0059B3] text-2xl font-bold flex-shrink-0 select-none overflow-hidden border-2 border-slate-100">
                {paciente.foto ? (
                  <img 
                    src={`${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${paciente.foto}`} 
                    alt="Foto" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (paciente.nombre?.[0] ?? '') + (paciente.apellido?.[0] ?? '')
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-[#0059B3]">
                    {paciente.nombre} {paciente.apellido}
                  </h1>
                  {/* Badge estado */}
                  {inactivo ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                                     px-2.5 py-1 rounded-full border
                                     bg-slate-100 text-slate-500 border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Inactivo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold
                                     px-2.5 py-1 rounded-full border
                                     bg-emerald-50 text-emerald-700 border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Activo
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 font-mono mt-0.5">
                  {DOC_LABEL[paciente.tipo_documento] ?? paciente.tipo_documento}{' '}
                  {paciente.numero_documento}
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                id="pac-btn-editar"
                onClick={() => !inactivo && setModalEditar(true)}
                disabled={inactivo}
                title={inactivo ? 'No se puede editar un paciente inactivo' : 'Editar datos'}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold
                            border-2 transition-colors
                            ${inactivo
                              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                              : 'border-[#0059B3] text-[#0059B3] hover:bg-blue-50'
                            }`}
              >
                <Pencil size={14} /> Editar
              </button>

              {inactivo ? (
                <button
                  id="pac-btn-reactivar"
                  onClick={() => setModalEstado(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold
                             bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                >
                  <UserCheck size={14} /> Reactivar
                </button>
              ) : (
                <button
                  id="pac-btn-desactivar"
                  onClick={() => setModalEstado(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold
                             bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  <UserX size={14} /> Desactivar
                </button>
              )}
            </div>
          </div>

          {/* Aviso de inactividad */}
          {inactivo && (
            <div className="flex items-start gap-3 bg-slate-50 border border-slate-200
                            rounded-xl px-4 py-3">
              <ShieldAlert size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-500">
                Este paciente está <strong>inactivo</strong>. Sus datos son de solo lectura.
                Reactívalo para poder editarlos o agendar nuevas citas.
              </p>
            </div>
          )}

          {/* ── Pestañas ── */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {[
              { key: 'datos', label: 'Datos personales' },
              { key: 'citas', label: `Historial de citas (${paciente.citas?.length ?? 0})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors
                  ${tab === t.key
                    ? 'bg-white text-[#0059B3] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════ */}
          {/* Pestaña: Datos personales                         */}
          {/* ══════════════════════════════════════════════════ */}
          {tab === 'datos' && (
            <>
              <Section title="Identificación">
                <Row icon={IdCard}   label="Tipo de documento" value={DOC_LABEL[paciente.tipo_documento] ?? paciente.tipo_documento} />
                <Row icon={IdCard}   label="Número"            value={<span className="font-mono">{paciente.numero_documento}</span>} />
                <Row icon={User}     label="Nombre completo"   value={`${paciente.nombre} ${paciente.apellido}`} />
                <Row icon={User}     label="Sexo"              value={SEXO_LABEL[paciente.sexo] ?? paciente.sexo} />
                <Row icon={Calendar} label="Fecha de nacimiento"
                  value={paciente.fecha_nacimiento ? fmtFecha(paciente.fecha_nacimiento) : '—'} />
                {paciente.edad != null && (
                  <Row icon={User} label="Edad" value={`${paciente.edad} años`} />
                )}
              </Section>

              <Section title="Contacto">
                <Row icon={Phone}    label="Teléfono"           value={val(paciente.telefono)} />
                <Row icon={Mail}     label="Correo"             value={val(paciente.email)} />
                <Row icon={MapPin}   label="Dirección"          value={val(paciente.direccion)} />
                <Row icon={Briefcase} label="Ocupación"         value={val(paciente.ocupacion)} />
                <Row icon={PhoneCall} label="Contacto emergencia" value={val(paciente.contacto_emergencia)} />
              </Section>

              <Section title="Datos del sistema">
                <Row icon={Calendar} label="Registro"
                  value={paciente.fecha_registro
                    ? new Date(paciente.fecha_registro).toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })
                    : '—'
                  }
                />
              </Section>
            </>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* Pestaña: Historial de citas                       */}
          {/* ══════════════════════════════════════════════════ */}
          {tab === 'citas' && (
            <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Aviso de privacidad */}
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <FileLock2 size={14} className="text-slate-400 flex-shrink-0" />
                <p className="text-xs text-slate-400">
                  Solo se muestran datos administrativos de la cita. La información clínica
                  (diagnósticos, tratamientos) es exclusiva del personal médico.
                </p>
              </div>

              {!paciente.citas?.length ? (
                <div className="text-center py-14 text-slate-400">
                  <Calendar size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Sin citas registradas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Fecha', 'Hora', 'Doctor', 'Servicio', 'Estado'].map(h => (
                          <th key={h}
                            className="px-4 py-3 text-left text-xs font-semibold
                                       text-slate-500 uppercase tracking-wide whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paciente.citas.map(c => {
                        const est = estadoInfo(c.estado);
                        return (
                          <tr key={c.cita_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {fmtFecha(c.fecha)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono text-xs">
                              {c.hora_inicio}–{c.hora_fin}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <p className="font-medium leading-tight">{c.doctor_nombre}</p>
                              {c.especialidad && (
                                <p className="text-xs text-slate-400">{c.especialidad}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">
                              {c.servicio_nombre}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold
                                               px-2.5 py-1 rounded-full border ${est.cls}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />
                                {est.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

        </div>
      </div>

      {/* ── Modal de edición ── */}
      <ModalEditar
        open={modalEditar}
        onClose={() => setModalEditar(false)}
        paciente={paciente}
        onSuccess={(pacienteActualizado) => {
          setPaciente(prev => ({ ...prev, ...pacienteActualizado }));
          setModalEditar(false);
          toast.success('Datos actualizados correctamente.');
        }}
      />

      {/* ── Modal de desactivar / reactivar ── */}
      <ModalEstado
        open={modalEstado}
        onClose={() => setModalEstado(false)}
        paciente={paciente}
        citasFuturas={citasFuturasActivas}
        onSuccess={() => {
          setModalEstado(false);
          fetchPaciente(); // recarga el perfil completo
        }}
      />
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// Modal de edición
// ════════════════════════════════════════════════════════════════
function ModalEditar({ open, onClose, paciente, onSuccess }) {
  const [form,        setForm]        = useState({});
  const [saving,      setSaving]      = useState(false);
  const [netError,    setNetError]    = useState(''); // error de red (datos retenidos)

  // Inicializar / sincronizar formulario cada vez que abre
  useEffect(() => {
    if (open && paciente) {
      setForm({
        nombre:              paciente.nombre              ?? '',
        apellido:            paciente.apellido            ?? '',
        sexo:                paciente.sexo                ?? '',
        fecha_nacimiento:    paciente.fecha_nacimiento    ?? '',
        telefono:            paciente.telefono            ?? '',
        email:               paciente.email               ?? '',
        direccion:           paciente.direccion           ?? '',
        ocupacion:           paciente.ocupacion           ?? '',
        contacto_emergencia: paciente.contacto_emergencia ?? '',
      });
      setNetError('');
    }
  }, [open, paciente]);

  // Bloquear scroll + cerrar con Escape
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleGuardar = async () => {
    setSaving(true);
    setNetError('');
    try {
      await api.put(`/patients/${paciente.paciente_id}`, form);
      onSuccess(form); // pasa los datos actualizados para reflejar sin refetch
    } catch (err) {
      // Resiliencia: si es error de red/timeout se retienen los datos
      const isNetwork = !err.response;
      if (isNetwork) {
        setNetError('Sin conexión. Tus cambios se han retenido. Verifica tu red e intenta de nuevo.');
      } else {
        const msg = err.response?.data?.error ?? 'Error al guardar. Intente nuevamente.';
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-editar-titulo"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!saving ? onClose : undefined}
      />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl
                      animate-[fadeSlideUp_0.2s_ease-out] max-h-[90vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id="modal-editar-titulo" className="text-base font-bold text-slate-800">
            Editar datos del paciente
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600
                       hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">

          {/* Aviso error de red */}
          {netError && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200
                            rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">{netError}</p>
            </div>
          )}

          {/* Documento bloqueado (read-only) */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Documento (no editable)
            </p>
            <p className="text-sm font-mono text-slate-600">
              {DOC_LABEL[paciente.tipo_documento] ?? paciente.tipo_documento}{' '}
              {paciente.numero_documento}
            </p>
          </div>

          {/* Nombre y apellido */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre *">
              <input id="edit-nombre" value={form.nombre} onChange={set('nombre')}
                className={INPUT} placeholder="Nombre" />
            </Field>
            <Field label="Apellido *">
              <input id="edit-apellido" value={form.apellido} onChange={set('apellido')}
                className={INPUT} placeholder="Apellido" />
            </Field>
          </div>

          {/* Sexo y fecha nacimiento */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sexo">
              <select id="edit-sexo" value={form.sexo} onChange={set('sexo')} className={INPUT}>
                <option value="">— selecciona —</option>
                <option value="FEMENINO">Femenino</option>
                <option value="MASCULINO">Masculino</option>
              </select>
            </Field>
            <Field label="Fecha de nacimiento">
              <input id="edit-nacimiento" type="date" value={form.fecha_nacimiento}
                onChange={set('fecha_nacimiento')}
                max={hoyISO()}
                className={INPUT} />
            </Field>
          </div>

          {/* Teléfono */}
          <Field label="Teléfono *">
            <input id="edit-telefono" value={form.telefono} onChange={set('telefono')}
              className={INPUT} placeholder="9 dígitos" maxLength={9} />
          </Field>

          {/* Email */}
          <Field label="Correo electrónico">
            <input id="edit-email" type="email" value={form.email} onChange={set('email')}
              className={INPUT} placeholder="ejemplo@correo.com" />
          </Field>

          {/* Dirección */}
          <Field label="Dirección">
            <input id="edit-direccion" value={form.direccion} onChange={set('direccion')}
              className={INPUT} placeholder="Av. / Jr. / Calle..." />
          </Field>

          {/* Ocupación */}
          <Field label="Ocupación">
            <input id="edit-ocupacion" value={form.ocupacion} onChange={set('ocupacion')}
              className={INPUT} placeholder="Ej. Docente" />
          </Field>

          {/* Contacto emergencia */}
          <Field label="Contacto de emergencia">
            <input id="edit-emergencia" value={form.contacto_emergencia}
              onChange={set('contacto_emergencia')}
              className={INPUT} placeholder="9 dígitos" maxLength={9} />
          </Field>
        </div>

        {/* Pie */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-300
                       text-slate-700 text-sm font-semibold hover:bg-slate-50
                       transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            id="edit-btn-guardar"
            onClick={handleGuardar}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-[#0059B3] hover:bg-[#004a99] text-white text-sm font-semibold
                       transition-colors disabled:opacity-60"
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Guardando…</>
              : 'Guardar cambios'
            }
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ════════════════════════════════════════════════════════════════
// Modal de Desactivar / Reactivar
// ════════════════════════════════════════════════════════════════
function ModalEstado({ open, onClose, paciente, citasFuturas, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const inactivo  = paciente?.estado === 'INACTIVO';
  const nCitas    = citasFuturas?.length ?? 0;

  // Bloquear scroll + cerrar con Escape
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const handler = (e) => { if (e.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleConfirmar = async () => {
    setLoading(true);
    try {
      if (inactivo) {
        // Reactivar
        await api.patch(`/patients/${paciente.paciente_id}/reactivate`);
        toast.success('Paciente reactivado correctamente.');
      } else {
        // Desactivar
        const { data } = await api.patch(`/patients/${paciente.paciente_id}/deactivate`);
        const n = data.citas_canceladas ?? 0;
        toast.success(
          n > 0
            ? `Paciente desactivado correctamente. ${n} cita${n !== 1 ? 's' : ''} cancelada${n !== 1 ? 's' : ''}.`
            : 'Paciente desactivado correctamente.'
        );
      }
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Error al procesar la solicitud. Intente nuevamente.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-estado-titulo"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl
                      animate-[fadeSlideUp_0.2s_ease-out]">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400
                     hover:text-slate-600 hover:bg-slate-100 transition-colors
                     disabled:opacity-40"
        >
          <X size={18} />
        </button>

        {/* Contenido */}
        <div className="p-6 pt-8 text-center">
          <div className={`mx-auto mb-4 flex items-center justify-center
                           w-16 h-16 rounded-full
                           ${inactivo ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {inactivo
              ? <UserCheck size={32} className="text-emerald-500" />
              : <UserX    size={32} className="text-red-500"     />
            }
          </div>

          <h2
            id="modal-estado-titulo"
            className="text-lg font-bold text-slate-800 mb-1"
          >
            {inactivo
              ? '¿Reactivar este paciente?'
              : '¿Desactivar este paciente?'
            }
          </h2>

          <p className="text-sm text-slate-600 font-medium mb-3">
            {paciente.nombre} {paciente.apellido}
          </p>

          {/* Advertencia de citas futuras (solo al desactivar) */}
          {!inactivo && nCitas > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200
                            rounded-xl px-4 py-3 text-left mb-3">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>Atención:</strong> al desactivar este paciente se cancelarán
                automáticamente sus{' '}
                <strong>{nCitas} cita{nCitas !== 1 ? 's' : ''} futuras</strong> programadas.
              </p>
            </div>
          )}

          <p className="text-sm text-slate-500">
            {inactivo
              ? 'El paciente podrá volver a recibir citas normalmente.'
              : 'Esta acción puede revertirse en cualquier momento.'
            }
          </p>
        </div>

        <div className="border-t border-slate-100" />

        {/* Botones */}
        <div className="flex gap-3 p-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-300
                       text-slate-700 text-sm font-semibold hover:bg-slate-50
                       transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            id="modal-btn-confirmar-estado"
            onClick={handleConfirmar}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                        text-white text-sm font-semibold transition-colors
                        disabled:opacity-60 disabled:cursor-not-allowed
                        ${inactivo
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : 'bg-red-500 hover:bg-red-600'
                        }`}
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Procesando…</>
              : inactivo
                ? <><UserCheck size={15} /> Confirmar reactivación</>
                : <><UserX    size={15} /> Confirmar desactivación</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ════════════════════════════════════════════════════════════════
// Sub-componentes de layout
// ════════════════════════════════════════════════════════════════
function Section({ title, children }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        {title}
      </p>
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

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

const INPUT = `w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
               focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 bg-white`;
