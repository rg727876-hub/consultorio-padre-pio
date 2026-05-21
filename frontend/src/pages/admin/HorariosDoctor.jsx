import { useState, useEffect, useCallback, startTransition } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Pencil, Trash2, X, Check,
  Loader2, CalendarDays, UserRound, AlertCircle,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import PageLoader from '../../components/PageLoader';

const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DIAS_LABEL = {
  LUNES:     'Lunes',
  MARTES:    'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES:    'Jueves',
  VIERNES:   'Viernes',
  SABADO:    'Sábado',
};

const EMPTY_FORM = { dia_semana: 'LUNES', hora_inicio: '', hora_fin: '', estado: 'ACTIVO' };

export default function HorariosDoctor() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();

  const [doctors, setDoctors]         = useState([]);
  const [doctorId, setDoctorId]       = useState('');
  const [doctor, setDoctor]           = useState(null);
  const [horarios, setHorarios]       = useState([]);
  const [loadingDoc, setLoadingDoc]   = useState(true);
  const [errorDoc, setErrorDoc]       = useState(false);
  const [loadingHor, setLoadingHor]   = useState(false);

  // modal: null | 'create' | 'edit' | 'delete'
  const [modal, setModal]             = useState(null);
  const [target, setTarget]           = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formErr, setFormErr]         = useState('');
  const [saving, setSaving]           = useState(false);

  // ── Cargar doctores ──────────────────────────────────────────────
  const loadDoctors = useCallback(() => {
    setLoadingDoc(true);
    setErrorDoc(false);
    api.get('/doctors')
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setDoctors(list);
        const pre = searchParams.get('doctor_id');
        if (pre) {
          const found = list.find((d) => String(d.doctor_id) === pre);
          if (found) {
            setDoctorId(String(found.doctor_id));
            setDoctor(found);
          }
        }
      })
      .catch(() => setErrorDoc(true))
      .finally(() => setLoadingDoc(false));
  }, []);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  // ── Cargar horarios cuando cambia el doctor ──────────────────────
  useEffect(() => {
    if (!doctorId) { setHorarios([]); setDoctor(null); return; }
    const found = doctors.find((d) => String(d.doctor_id) === doctorId);
    setDoctor(found ?? null);
    setLoadingHor(true);
    api.get(`/schedules?doctor_id=${doctorId}`)
      .then(({ data }) => setHorarios(Array.isArray(data) ? data : []))
      .catch(() => toast.error('No se pudo cargar los horarios'))
      .finally(() => setLoadingHor(false));
  }, [doctorId]);

  const refetchHorarios = async () => {
    const { data } = await api.get(`/schedules?doctor_id=${doctorId}`);
    setHorarios(Array.isArray(data) ? data : []);
  };

  // ── Abrir modales ────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErr('');
    setModal('create');
  };

  const openEdit = (h) => {
    setTarget(h);
    setForm({
      dia_semana:  h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fin:    h.hora_fin,
      estado:      h.estado,
    });
    setFormErr('');
    setModal('edit');
  };

  const openDelete = (h) => {
    setTarget(h);
    setFormErr('');
    setModal('delete');
  };

  const closeModal = () => { setModal(null); setFormErr(''); };

  // ── Cambios en form ──────────────────────────────────────────────
  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setFormErr('');
  };

  const validate = () => {
    if (!form.hora_inicio || !form.hora_fin) return 'Completa la hora de inicio y fin.';
    if (form.hora_inicio >= form.hora_fin) return 'La hora de fin debe ser mayor a la hora de inicio.';
    return null;
  };

  // ── Crear ────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setFormErr(err); return; }
    setSaving(true);
    try {
      await api.post('/schedules', {
        doctor_id:   Number(doctorId),
        dia_semana:  form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fin:    form.hora_fin,
      });
      await refetchHorarios();
      toast.success('Horario registrado');
      closeModal();
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Error al registrar el horario.');
    } finally {
      setSaving(false);
    }
  };

  // ── Editar ───────────────────────────────────────────────────────
  const handleEdit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setFormErr(err); return; }
    setSaving(true);
    try {
      await api.put(`/schedules/${target.horario_id}`, {
        dia_semana:  form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fin:    form.hora_fin,
        estado:      form.estado,
      });
      await refetchHorarios();
      toast.success('Horario actualizado');
      closeModal();
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Error al actualizar el horario.');
    } finally {
      setSaving(false);
    }
  };

  // ── Eliminar ─────────────────────────────────────────────────────
  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/schedules/${target.horario_id}`);
      setHorarios((prev) => prev.filter((h) => h.horario_id !== target.horario_id));
      toast.success('Horario eliminado');
      closeModal();
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Error al eliminar el horario.');
    } finally {
      setSaving(false);
    }
  };

  // ── Agrupar horarios por día ─────────────────────────────────────
  const byDia = DIAS.reduce((acc, d) => {
    acc[d] = horarios
      .filter((h) => h.dia_semana === d)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    return acc;
  }, {});

  const totalActivos = horarios.filter((h) => h.estado === 'ACTIVO').length;

  return (
    <PageLoader loading={loadingDoc} error={errorDoc} onRetry={loadDoctors}>
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-6xl mx-auto">

        {/* ── Encabezado ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#0059B3]">Horarios y disponibilidad</h1>
            <p className="text-sm text-slate-500">
              Define los bloques horarios semanales de cada doctor
            </p>
          </div>
        </div>

        {/* ── Selector de doctor ── */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Seleccionar doctor
          </label>
          {loadingDoc ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin" /> Cargando doctores…
            </div>
          ) : doctors.length === 0 ? (
            <p className="text-sm text-slate-400">No hay doctores activos registrados.</p>
          ) : (
            <select
              value={doctorId}
              onChange={(e) => { const v = e.target.value; startTransition(() => setDoctorId(v)); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40
                         min-w-[260px]"
            >
              <option value="">— Selecciona un doctor —</option>
              {doctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  {d.apellido}, {d.nombre} — {d.especialidad}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Panel del doctor ── */}
        {doctor && (
          <>
            {/* Info + botón agregar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between
                            gap-4 bg-white rounded-2xl shadow-sm p-5 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0059B3]
                                flex items-center justify-center shrink-0">
                  <UserRound size={20} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    Dr. {doctor.nombre} {doctor.apellido}
                  </p>
                  <p className="text-xs text-slate-500">
                    DNI {doctor.DNI} · {doctor.especialidad}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {totalActivos} bloque{totalActivos !== 1 ? 's' : ''} activo{totalActivos !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 bg-[#8BC63F] hover:bg-[#78ae35]
                             text-white text-sm font-semibold px-4 py-2 rounded-lg
                             transition-colors"
                >
                  <Plus size={16} /> Agregar horario
                </button>
              </div>
            </div>

            {/* Calendario semanal */}
            {loadingHor ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
                <Loader2 size={18} className="animate-spin" /> Cargando horarios…
              </div>
            ) : horarios.length === 0 ? (
              <div className="flex flex-col items-center py-16 bg-white rounded-2xl shadow-sm
                              text-slate-400 text-sm gap-3">
                <CalendarDays size={32} className="opacity-30" />
                <p>Sin horarios registrados aún</p>
                <button
                  onClick={openCreate}
                  className="text-[#0059B3] text-xs font-medium hover:underline"
                >
                  + Agregar primer horario
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {DIAS.map((dia) => (
                  <div key={dia} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-[#0059B3] text-white text-center text-xs
                                    font-semibold py-2 px-1">
                      {DIAS_LABEL[dia]}
                    </div>
                    <div className="p-2 space-y-2 min-h-[80px]">
                      {byDia[dia].length === 0 ? (
                        <p className="text-center text-slate-300 text-[10px] pt-4">—</p>
                      ) : (
                        byDia[dia].map((h) => (
                          <HorarioBlock
                            key={h.horario_id}
                            horario={h}
                            onEdit={() => openEdit(h)}
                            onDelete={() => openDelete(h)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal crear ── */}
      {modal === 'create' && (
        <Modal title="Agregar horario" onClose={closeModal}>
          <form onSubmit={handleCreate} className="space-y-4">
            <HorarioForm form={form} onChange={handleChange} showEstado={false} />
            {formErr && <ErrorBanner msg={formErr} />}
            <ModalBtns
              onCancel={closeModal}
              saving={saving}
              label="Registrar"
            />
          </form>
        </Modal>
      )}

      {/* ── Modal editar ── */}
      {modal === 'edit' && (
        <Modal title="Editar horario" onClose={closeModal}>
          <form onSubmit={handleEdit} className="space-y-4">
            <HorarioForm form={form} onChange={handleChange} showEstado />
            {formErr && <ErrorBanner msg={formErr} />}
            <ModalBtns
              onCancel={closeModal}
              saving={saving}
              label="Guardar cambios"
            />
          </form>
        </Modal>
      )}

      {/* ── Modal eliminar ── */}
      {modal === 'delete' && (
        <Modal title="Eliminar horario" onClose={closeModal}>
          <p className="text-sm text-slate-600 mb-1">
            ¿Confirmas la eliminación del siguiente bloque horario?
          </p>
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700 mb-4">
            <span className="font-semibold">{DIAS_LABEL[target.dia_semana]}</span>
            {' '}·{' '}
            {target.hora_inicio} – {target.hora_fin}
          </div>
          {formErr && <ErrorBanner msg={formErr} />}
          <ModalBtns
            onCancel={closeModal}
            saving={saving}
            label="Eliminar"
            danger
            onConfirm={handleDelete}
          />
        </Modal>
      )}
    </div>
    </PageLoader>
  );
}

// ── Bloque de horario en el calendario ──────────────────────────────
function HorarioBlock({ horario, onEdit, onDelete }) {
  const activo = horario.estado === 'ACTIVO';
  return (
    <div
      className={`rounded-lg px-2 py-1.5 text-[11px] leading-tight
                  ${activo
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-slate-100 border border-slate-200 opacity-60'}`}
    >
      <p className={`font-semibold mb-1 ${activo ? 'text-[#0059B3]' : 'text-slate-400'}`}>
        {horario.hora_inicio} – {horario.hora_fin}
      </p>
      {!activo && (
        <span className="inline-block bg-slate-200 text-slate-500 text-[9px]
                         font-semibold px-1.5 py-0.5 rounded-full mb-1">
          Inactivo
        </span>
      )}
      <div className="flex gap-1 mt-1">
        <button
          onClick={onEdit}
          title="Editar"
          className="p-0.5 rounded hover:bg-blue-100 text-[#0059B3] transition-colors"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={onDelete}
          title="Eliminar"
          className="p-0.5 rounded hover:bg-red-100 text-red-500 transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Formulario compartido crear/editar ───────────────────────────────
function HorarioForm({ form, onChange, showEstado }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Día de la semana *</label>
        <select
          name="dia_semana"
          value={form.dia_semana}
          onChange={onChange}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
        >
          {Object.entries({
            LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
            JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado',
          }).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hora inicio *</label>
          <input
            type="time"
            name="hora_inicio"
            value={form.hora_inicio}
            onChange={onChange}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hora fin *</label>
          <input
            type="time"
            name="hora_fin"
            value={form.hora_fin}
            onChange={onChange}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
          />
        </div>
      </div>

      {showEstado && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
          <div className="flex gap-4">
            {['ACTIVO', 'INACTIVO'].map((op) => (
              <label key={op} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="radio"
                  name="estado"
                  value={op}
                  checked={form.estado === op}
                  onChange={onChange}
                  className="accent-[#0059B3] w-4 h-4"
                />
                {op === 'ACTIVO' ? 'Activo' : 'Inactivo'}
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Helpers de UI ───────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100
                     text-slate-400 transition-colors"
        >
          <X size={18} />
        </button>
        <h2 className="text-base font-bold text-[#0059B3] mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200
                    text-red-700 text-sm rounded-lg px-3 py-2.5">
      <AlertCircle size={15} className="shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
}

function ModalBtns({ onCancel, saving, label, danger = false, onConfirm }) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 border border-slate-300 rounded-lg py-2 text-sm
                   font-medium text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Cancelar
      </button>
      <button
        type={onConfirm ? 'button' : 'submit'}
        onClick={onConfirm}
        disabled={saving}
        className={`flex-1 flex items-center justify-center gap-2
                    text-white font-semibold py-2 rounded-lg text-sm transition-colors
                    disabled:opacity-60 disabled:cursor-not-allowed
                    ${danger
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-[#8BC63F] hover:bg-[#78ae35]'}`}
      >
        {saving
          ? <><Loader2 size={15} className="animate-spin" /> Procesando…</>
          : <><Check size={15} /> {label}</>}
      </button>
    </div>
  );
}
