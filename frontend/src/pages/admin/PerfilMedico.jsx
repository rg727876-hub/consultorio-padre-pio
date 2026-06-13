import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, MapPin, Calendar, Clock,
  Edit2, Trash2, RotateCcw, Send, Save, X, ArrowLeft, Loader2, AlertCircle, Activity, Shield, Stethoscope
} from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import AppLayout from '../../components/AppLayout';

export default function PerfilMedico() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [doctor, setDoctor] = useState(null);
  const [audit, setAudit] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [allEspecialidades, setAllEspecialidades] = useState([]);
  
  // UI states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form states
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', telefono: '', direccion: '', especialidadesIds: [], nroColegiatura: '', serviciosIds: []
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchProfile();
    fetchServices();
    fetchEspecialidades();
  }, [id]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await api.get(`/users/${id}`);
      setDoctor({
        ...data,
        servicios: data.servicios || [],
        horarios: data.horarios || [],
        citasFuturas: data.citasFuturas || 0,
      });
      setAudit(data.auditoria || []);
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        email: data.email || '',
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        especialidadesIds: data.especialidadesIds || [],
        nroColegiatura: data.nroColegiatura || '',
        serviciosIds: data.servicios?.map(s => s.servicio_id) || []
      });
      return true;
    } catch (err) {
      console.error('[PerfilMedico.fetchUserProfile]', err.response?.data || err.message);
      return false;
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/doctors/${id}/profile`);
      setDoctor(data);
      setAudit(data.auditoria || []);
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        email: data.email || '',
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        especialidadesIds: data.especialidadesIds || [],
        nroColegiatura: data.nroColegiatura || '',
        serviciosIds: data.servicios?.map(s => s.servicio_id) || []
      });
    } catch (err) {
      const loaded = await fetchUserProfile();
      if (loaded) {
        console.warn('[PerfilMedico.fetchProfile] doctor profile failed, fallback loaded user profile', err.response?.data || err.message);
        return;
      }

      const serverMessage = err.response?.data?.error;
      const status = err.response?.status;
      if (status === 404 || status === 400) {
        toast.error(serverMessage || 'Doctor no encontrado.');
      } else if (serverMessage) {
        toast.error(serverMessage);
      } else if (!navigator.onLine || err.message === 'Network Error') {
        toast.error('Error de conexión al cargar el perfil del médico.');
      } else {
        toast.error(err.message || 'Error al cargar el perfil del médico.');
      }

      if (!doctor) navigate('/admin/doctores');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data } = await api.get('/services'); // servicios activos
      setAllServices(data);
    } catch (err) {
      console.error('Error al cargar servicios', err);
    }
  };

  const fetchEspecialidades = async () => {
    try {
      const { data } = await api.get('/especialidades');
      setAllEspecialidades(data);
    } catch (err) {
      console.error('Error al cargar especialidades', err);
    }
  };

  // ── Validación ───────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Requerido';
    if (!form.apellido.trim()) e.apellido = 'Requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo inválido';
    const numTelefono = form.telefono.replace(/\D/g, '');
    if (numTelefono.length < 9) e.telefono = 'Al menos 9 dígitos';
    if (!form.nroColegiatura.trim()) e.nroColegiatura = 'C.O.P. requerido';
    if (form.serviciosIds.length === 0) e.serviciosIds = 'Selecciona al menos un servicio';
    return e;
  };

  // ── Manejo de formulario ─────────────────────────────────────
  const handleSave = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    
    setIsSaving(true);
    try {
      await api.put(`/doctors/${id}`, {
        ...form
      });
      toast.success('Datos actualizados correctamente.');
      setIsEditing(false);
      fetchProfile();
    } catch (err) {
      if (!navigator.onLine || err.message === 'Network Error') {
        toast.error('Error de conexión a internet. Los datos no se perdieron, intenta de nuevo.');
      } else {
        toast.error(err.response?.data?.error || 'Error al actualizar el perfil');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      nombre: doctor.nombre || '',
      apellido: doctor.apellido || '',
      email: doctor.email || '',
      telefono: doctor.telefono || '',
      direccion: doctor.direccion || '',
      especialidadesIds: doctor.especialidadesIds || [],
      nroColegiatura: doctor.nroColegiatura || '',
      serviciosIds: doctor.servicios?.map(s => s.servicio_id) || []
    });
    setErrors({});
    setIsEditing(false);
  };

  // ── Desactivar/Reactivar ───────────────────────────────────
  const toggleStatus = async (confirmado = false) => {
    if (doctor.estado === 'ACTIVO' && !confirmado) {
      setShowConfirm(true);
      return;
    }

    setShowConfirm(false);
    setIsStatusChanging(true);
    try {
      const nuevoEstado = doctor.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      const { data } = await api.put(`/doctors/${id}/status`, { estado: nuevoEstado });
      toast.success(data.message);
      fetchProfile();
    } catch (err) {
      if (!navigator.onLine || err.message === 'Network Error') {
        toast.error('Error de conexión a internet.');
      } else {
        toast.error(err.response?.data?.error || 'Error al cambiar el estado del doctor');
      }
    } finally {
      setIsStatusChanging(false);
    }
  };

  // ── Reenviar Activación ────────────────────────────────────
  const resendActivation = async () => {
    setIsResending(true);
    try {
      const { data } = await api.post(`/users/${id}/resend-activation`);
      toast.success(data.message || 'Correo de activación reenviado correctamente.');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reenviar activación');
    } finally {
      setIsResending(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading && !doctor) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-[#0059B3]" size={32} />
        </div>
      </AppLayout>
    );
  }

  const isPending = doctor?.estado === 'PENDIENTE';
  const isInactive = doctor?.estado === 'INACTIVO';

  // Helper para agrupar horarios por día
  const groupedSchedule = (doctor?.horarios || []).reduce((acc, h) => {
    if (!acc[h.dia_semana]) acc[h.dia_semana] = [];
    acc[h.dia_semana].push(h);
    return acc;
  }, {});
  const diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-6xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => navigate('/admin/doctores')}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Perfil de Doctor</h1>
            <p className="text-sm text-slate-500">Gestión clínica y agenda profesional</p>
          </div>
        </div>

        {/* Modal Confirmación Desactivar */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
              <div className="flex gap-4 items-start">
                <div className="bg-red-100 text-red-600 p-3 rounded-full shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">¿Desactivar doctor?</h3>
                  <p className="text-sm text-slate-600 mt-2">
                    El doctor no podrá ingresar al sistema ni recibir nuevas reservas.
                  </p>
                  {/* CA10: Advertencia de citas futuras */}
                  {doctor.citasFuturas > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-semibold text-red-700">
                        ¡Alerta! Al desactivar este doctor, se cancelarán automáticamente sus {doctor.citasFuturas} citas futuras agendadas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg">
                  Cancelar
                </button>
                <button onClick={() => toggleStatus(true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg flex gap-2 items-center">
                  Confirmar desactivación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top actions (CA4) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#0059B3]/10 flex items-center justify-center text-[#0059B3] text-xl font-bold shrink-0">
              {(doctor?.nombre?.[0] || '')}{(doctor?.apellido?.[0] || '')}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Dr. {doctor.nombre} {doctor.apellido}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-500 font-medium">{doctor.especialidad || 'Médico General'}</span>
                <span className="text-slate-300">•</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isPending ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                  isInactive ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {doctor.estado}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {isPending && (
              <button
                onClick={resendActivation}
                disabled={isResending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl text-sm font-medium"
              >
                {isResending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Reenviar activación
              </button>
            )}

            {/* CA3: Gestionar horarios */}
            <button
              onClick={() => navigate(`/admin/horarios?doctor_id=${doctor.usuario_id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0059B3]/10 text-[#0059B3] hover:bg-[#0059B3]/20 rounded-xl text-sm font-medium"
            >
              <Calendar size={16} /> Gestionar horarios
            </button>

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                disabled={isInactive}
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium"
              >
                <Edit2 size={16} /> Editar
              </button>
            )}

            <button
              onClick={() => toggleStatus(false)}
              disabled={isStatusChanging || isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                isInactive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
              }`}
            >
              {isStatusChanging ? <Loader2 size={16} className="animate-spin" /> : isInactive ? <RotateCcw size={16} /> : <Trash2 size={16} />}
              {isInactive ? 'Reactivar' : 'Desactivar'}
            </button>
          </div>
        </div>

        {isPending && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div>
                <p className="text-sm text-amber-800 font-medium">Este doctor aún no ha activado su cuenta.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <User size={20} className="text-[#0059B3]" /> Información Profesional y Personal
              </h3>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                      <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-[#0059B3]/40" />
                      {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                      <input type="text" value={form.apellido} onChange={e => setForm({...form, apellido: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-[#0059B3]/40" />
                      {errors.apellido && <p className="text-xs text-red-500 mt-1">{errors.apellido}</p>}
                    </div>
                  </div>
                  
                  {/* CA5: DNI bloqueado */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">DNI <span className="text-slate-400 font-normal">(Solo lectura)</span></label>
                    <input type="text" value={doctor.DNI} disabled className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Especialidades</label>
                      <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-slate-50">
                        {allEspecialidades.map(esp => (
                          <label key={esp.especialidad_id} className="flex items-center gap-2 mb-2 last:mb-0 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="rounded text-[#0059B3] focus:ring-[#0059B3]"
                              checked={form.especialidadesIds.includes(esp.especialidad_id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setForm(prev => ({
                                  ...prev,
                                  especialidadesIds: checked ? [...prev.especialidadesIds, esp.especialidad_id] : prev.especialidadesIds.filter(id => id !== esp.especialidad_id)
                                }));
                              }}
                            />
                            <span className="text-sm text-slate-700">{esp.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">C.O.P.</label>
                      <input type="text" value={form.nroColegiatura} onChange={e => setForm({...form, nroColegiatura: e.target.value})} className={`w-full border ${errors.nroColegiatura ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:ring-[#0059B3]/40`} />
                      {errors.nroColegiatura && <p className="text-xs text-red-500 mt-1">{errors.nroColegiatura}</p>}
                    </div>
                  </div>

                  {/* Servicios Selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Servicios médicos que realiza</label>
                    <div className="border border-slate-300 rounded-lg p-3 max-h-48 overflow-y-auto bg-slate-50">
                      {allServices.map(srv => (
                        <label key={srv.servicio_id} className="flex items-center gap-2 mb-2 last:mb-0 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded text-[#0059B3] focus:ring-[#0059B3]"
                            checked={form.serviciosIds.includes(srv.servicio_id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setForm(prev => ({
                                ...prev,
                                serviciosIds: checked ? [...prev.serviciosIds, srv.servicio_id] : prev.serviciosIds.filter(id => id !== srv.servicio_id)
                              }));
                            }}
                          />
                          <span className="text-sm text-slate-700">{srv.nombre}</span>
                        </label>
                      ))}
                    </div>
                    {errors.serviciosIds && <p className="text-xs text-red-500 mt-1">{errors.serviciosIds}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={`w-full border ${errors.email ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:ring-[#0059B3]/40`} />
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                      <input type="text" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value.replace(/\D/g, '')})} className={`w-full border ${errors.telefono ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:ring-[#0059B3]/40`} />
                      {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                    <input type="text" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-[#0059B3]/40" />
                  </div>

                  <div className="flex gap-3 justify-end pt-4 mt-6 border-t border-slate-100">
                    <button onClick={handleCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg text-sm flex items-center gap-2"><X size={16} /> Cancelar</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-[#0059B3] hover:bg-blue-700 text-white font-medium rounded-lg text-sm flex items-center gap-2 disabled:opacity-70">
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar cambios
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <DetailItem icon={<Shield size={16} />} label="DNI" value={doctor.DNI} />
                  <DetailItem icon={<Stethoscope size={16} />} label="Especialidad" value={doctor.especialidad} />
                  <DetailItem icon={<Shield size={16} />} label="C.O.P." value={doctor.nroColegiatura} />
                  <DetailItem icon={<Mail size={16} />} label="Correo electrónico" value={doctor.email} />
                  <DetailItem icon={<Phone size={16} />} label="Teléfono" value={doctor.telefono} />
                  <DetailItem icon={<MapPin size={16} />} label="Dirección" value={doctor.direccion || 'No registrada'} />
                  <DetailItem icon={<Calendar size={16} />} label="Fecha de Registro" value={dayjs(doctor.fecha_registro).format('DD/MM/YYYY hh:mm A')} />
                  
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Stethoscope size={16} className="text-slate-400" /> Servicios Médicos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {doctor.servicios?.length > 0 ? doctor.servicios.map(s => (
                        <span key={s.servicio_id} className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full text-xs font-medium">
                          {s.nombre_servicio}
                        </span>
                      )) : <span className="text-sm text-slate-400">Sin servicios asignados</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CA2: Calendario Semanal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <Calendar size={20} className="text-[#8BC63F]" /> Horario Semanal (Solo Lectura)
              </h3>
              
              {doctor.horarios?.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar size={48} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-500 font-medium">Sin horarios registrados aún</p>
                  <p className="text-sm text-slate-400 mt-1">Usa el botón "Gestionar horarios" para asignar la agenda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {diasSemana.map(dia => {
                    const turns = groupedSchedule[dia];
                    if (!turns) return null;
                    return (
                      <div key={dia} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h4 className="font-semibold text-slate-700 text-sm mb-2">{dia}</h4>
                        <div className="space-y-2">
                          {turns.map((t, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs font-medium bg-white px-3 py-2 rounded border border-slate-100 text-[#0059B3]">
                              <Clock size={14} className="text-[#8BC63F]" />
                              {t.hora_inicio.substring(0, 5)} - {t.hora_fin.substring(0, 5)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Historial Auditoría (CA16) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-[800px] flex flex-col">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity size={20} className="text-amber-500" /> Historial de Actividad
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 relative">
                {audit.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay actividad reciente registrada.</p>
                ) : (
                  <div className="relative border-l border-slate-200 ml-3 space-y-6">
                    {audit.map((log, index) => (
                      <div key={index} className="relative pl-6">
                        <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-[#0059B3] border-2 border-white" />
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">{dayjs(log.fecha_evento).format('DD MMM YYYY, HH:mm')}</p>
                          <p className="text-sm font-semibold text-slate-800">{formatAccion(log.accion)}</p>
                          <p className="text-sm text-slate-600 mt-1">Autor: <span className="font-medium text-slate-700">{log.autor || 'Sistema'}</span></p>
                          {log.detalles && (
                            <div className="mt-2 bg-slate-50 rounded-lg p-2 text-xs text-slate-500 font-mono">
                              {log.detalles.length > 100 ? log.detalles.substring(0, 100) + '...' : log.detalles}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
        <span className="text-slate-400">{icon}</span> {label}
      </p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function formatAccion(accion) {
  const map = {
    'REGISTRO_USUARIO': 'Usuario registrado',
    'EDICION_PERFIL_USUARIO': 'Perfil editado',
    'DESACTIVACION_USUARIO': 'Usuario desactivado',
    'REACTIVACION_USUARIO': 'Usuario reactivado',
    'REENVIO_ACTIVACION': 'Activación reenviada',
    'ACTIVACION_EXITOSA': 'Cuenta activada'
  };
  return map[accion] || accion;
}
