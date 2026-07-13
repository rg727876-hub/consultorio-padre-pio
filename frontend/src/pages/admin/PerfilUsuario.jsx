import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, MapPin, Calendar, Clock,
  Edit2, Trash2, RotateCcw, Send, Save, X, ArrowLeft, Loader2, AlertCircle, RefreshCw, Activity, Shield, Camera
} from 'lucide-react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import AppLayout from '../../components/AppLayout';

export default function PerfilUsuario() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [audit, setAudit] = useState([]);
  
  // UI states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false); // Modal para desactivar

  // Form states
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', telefono: '', direccion: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/users/${id}`);
      setUser(data);
      setAudit(data.auditoria || []);
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        email: data.email || '',
        telefono: data.telefono || '',
        direccion: data.direccion || ''
      });
    } catch (err) {
      toast.error('Error al cargar el perfil. Verifica tu conexión a internet.');
      // CA14: Si hay error de red, mantener el state o volver atrás
      if (!user) navigate('/admin/usuarios');
    } finally {
      setLoading(false);
    }
  };

  // ── Validación ───────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Nombre requerido';
    if (!form.apellido.trim()) e.apellido = 'Apellido requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo electrónico inválido';
    const numTelefono = form.telefono.replace(/\D/g, '');
    if (numTelefono.length < 9) e.telefono = 'El teléfono debe tener al menos 9 dígitos';
    return e;
  };

  // ── Manejo de formulario (CA4, CA5, CA6, CA7, CA14) ────────
  const handleSave = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    
    setIsSaving(true);
    try {
      // CA14: Soporte Offline, si esto falla entra al catch
      await api.put(`/users/${id}`, {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        telefono: form.telefono,
        direccion: form.direccion
      });
      // CA6
      toast.success('Datos actualizados correctamente.');
      setIsEditing(false);
      fetchProfile(); // Recargar para obtener posibles nuevos registros de auditoría
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
    // CA7
    setForm({
      nombre: user.nombre || '',
      apellido: user.apellido || '',
      email: user.email || '',
      telefono: user.telefono || '',
      direccion: user.direccion || ''
    });
    setErrors({});
    setIsEditing(false);
  };

  // ── Desactivar/Reactivar (CA10, CA11, CA12, CA13) ──────────
  const toggleStatus = async (confirmado = false) => {
    if (user.estado === 'ACTIVO' && !confirmado) {
      setShowConfirm(true); // CA10: Exigir confirmación
      return;
    }

    setShowConfirm(false);
    setIsStatusChanging(true);
    try {
      const nuevoEstado = user.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
      const { data } = await api.put(`/users/${id}/status`, { estado: nuevoEstado });
      toast.success(data.message);
      fetchProfile();
    } catch (err) {
      if (!navigator.onLine || err.message === 'Network Error') {
        toast.error('Error de conexión a internet.');
      } else {
        toast.error(err.response?.data?.error || 'Error al cambiar el estado del usuario');
      }
    } finally {
      setIsStatusChanging(false);
    }
  };

  // ── Reenviar Activación (CA3, CA9) ─────────────────────────
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

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Solo se permiten imágenes JPG, PNG o WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar los 5MB');
      return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    setUploadingAvatar(true);
    try {
      const { data } = await api.post(`/users/${id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Foto de perfil actualizada');
      setUser(u => ({ ...u, avatar: data.avatar }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir la imagen');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading && !user) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-[#0059B3]" size={32} />
        </div>
      </AppLayout>
    );
  }

  const isPending = user?.estado === 'PENDIENTE';
  const isInactive = user?.estado === 'INACTIVO';

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-5xl mx-auto space-y-6">
        
        {/* Breadcrumb y Back */}
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => navigate('/admin/usuarios')}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Perfil de Usuario</h1>
            <p className="text-sm text-slate-500">Gestión administrativa y detalles de la cuenta</p>
          </div>
        </div>

        {/* Modal de confirmación para desactivar */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
              <div className="flex gap-4 items-start">
                <div className="bg-red-100 text-red-600 p-3 rounded-full shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">¿Desactivar usuario?</h3>
                  <p className="text-sm text-slate-600 mt-2">
                    El usuario perderá el acceso al sistema inmediatamente. Podrás reactivarlo en cualquier momento.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => toggleStatus(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex gap-2 items-center"
                >
                  Confirmar desactivación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top actions (CA2) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group w-20 h-20 shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar?.startsWith('http') ? user.avatar : `${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${user.avatar}`}
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover border-2 border-slate-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-[#0059B3] text-2xl font-bold">
                  {(user?.nombre?.[0] || '')}{(user?.apellido?.[0] || '')}
                </div>
              )}
              <label className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 cursor-pointer transition-opacity text-white ${!isInactive && !uploadingAvatar ? 'group-hover:opacity-100' : 'hidden'}`}
                     title="Cambiar foto de perfil">
                {uploadingAvatar ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden"
                       onChange={handleAvatarUpload} disabled={uploadingAvatar || isInactive} />
              </label>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{user.nombre} {user.apellido}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-500 font-medium">{user.nombre_rol}</span>
                <span className="text-slate-300">•</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isPending ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                  isInactive ? 'bg-slate-100 text-slate-600' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {user.estado}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {isPending && (
              <button
                onClick={resendActivation}
                disabled={isResending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl text-sm font-medium transition-colors"
              >
                {isResending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Reenviar activación
              </button>
            )}

            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                disabled={isInactive} // CA12
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
              >
                <Edit2 size={16} /> Editar
              </button>
            )}

            <button
              onClick={() => toggleStatus(false)}
              disabled={isStatusChanging || isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isInactive 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' // CA13
                  : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' // CA12
              }`}
            >
              {isStatusChanging ? <Loader2 size={16} className="animate-spin" /> : 
               isInactive ? <RotateCcw size={16} /> : <Trash2 size={16} />}
              {isInactive ? 'Reactivar' : 'Desactivar'}
            </button>
          </div>
        </div>

        {/* CA3: Aviso de pendiente */}
        {isPending && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div>
                <p className="text-sm text-amber-800 font-medium">Este usuario aún no ha activado su cuenta.</p>
                <p className="text-xs text-amber-700 mt-1">Si no recibió el correo o el enlace expiró, puedes usar el botón de reenviar activación.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Detalles Principales */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <User size={20} className="text-[#0059B3]" /> Información Personal
                </h3>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  {/* CA4: Edición de campos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                      <input 
                        type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')})}
                        className={`w-full border ${errors.nombre ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40`}
                      />
                      {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Apellido</label>
                      <input 
                        type="text" value={form.apellido} onChange={e => setForm({...form, apellido: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')})}
                        className={`w-full border ${errors.apellido ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40`}
                      />
                      {errors.apellido && <p className="text-xs text-red-500 mt-1">{errors.apellido}</p>}
                    </div>
                  </div>
                  
                  {/* DNI Bloqueado CA4 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">DNI <span className="text-slate-400 font-normal">(Solo lectura)</span></label>
                    <input type="text" value={user.DNI} disabled className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                      <input 
                        type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                        className={`w-full border ${errors.email ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40`}
                      />
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                      <input 
                        type="text" value={form.telefono} maxLength={15} onChange={e => setForm({...form, telefono: e.target.value.replace(/\D/g, '')})}
                        className={`w-full border ${errors.telefono ? 'border-red-400' : 'border-slate-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40`}
                      />
                      {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                    <input 
                      type="text" value={form.direccion} onChange={e => setForm({...form, direccion: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
                    />
                  </div>

                  {/* Rol Bloqueado CA4 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rol en el sistema <span className="text-slate-400 font-normal">(Solo lectura)</span></label>
                    <input type="text" value={user.nombre_rol} disabled className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
                  </div>

                  <div className="flex gap-3 justify-end pt-4 mt-6 border-t border-slate-100">
                    <button onClick={handleCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors flex items-center gap-2 text-sm">
                      <X size={16} /> Cancelar
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-[#0059B3] hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm shadow-sm disabled:opacity-70">
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar cambios
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <DetailItem icon={<Shield size={16} />} label="DNI" value={user.DNI} />
                  <DetailItem icon={<Mail size={16} />} label="Correo electrónico" value={user.email} />
                  <DetailItem icon={<Phone size={16} />} label="Teléfono" value={user.telefono} />
                  <DetailItem icon={<MapPin size={16} />} label="Dirección" value={user.direccion || 'No registrada'} />
                  
                  {user.nombre_rol === 'DOCTOR' && (
                    <>
                      <DetailItem icon={<Activity size={16} />} label="Especialidad" value={user.especialidad} />
                      <DetailItem icon={<Shield size={16} />} label="C.O.P." value={user.nroColegiatura} />
                    </>
                  )}
                  
                  <DetailItem icon={<Calendar size={16} />} label="Fecha de Registro" value={dayjs(user.fecha_registro).format('DD/MM/YYYY hh:mm A')} />
                </div>
              )}
            </div>
          </div>

          {/* Historial de Auditoría (CA16) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4 shrink-0">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity size={20} className="text-[#8BC63F]" /> Historial de Actividad
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative">
                {audit.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay actividad reciente registrada.</p>
                ) : (
                  <div className="relative border-l border-slate-200 ml-3 space-y-6">
                    {audit.map((log, index) => (
                      <div key={index} className="relative pl-6">
                        <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-[#0059B3] border-2 border-white shadow-sm" />
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-0.5">
                            {dayjs(log.fecha_evento).format('DD MMM YYYY, HH:mm')}
                          </p>
                          <p className="text-sm font-semibold text-slate-800">
                            {formatAccion(log.accion)}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            Autor: <span className="font-medium text-slate-700">{log.autor || 'Sistema'}</span>
                          </p>
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

// ── Componentes Helpers ──────────────────────────────────────────

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
