import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Phone, MapPin, IdCard, BadgeCheck, Stethoscope, Power, RotateCcw,
  Loader2, Calendar, AlertTriangle, Pencil, Save, Send, History, Clock,
  WifiOff, ShieldAlert,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { fmtFechaHora } from '../recepcion/citaEstados';
import { Camera } from 'lucide-react';

const ROL_LABEL = {
  ADMINISTRADOR: 'Administrador', RECEPCIONISTA: 'Recepcionista',
  CAJERO: 'Cajero', DOCTOR: 'Doctor',
};
const ESTADO_STYLE = {
  ACTIVO:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDIENTE: 'bg-amber-100 text-amber-700 border-amber-300',
  INACTIVO:  'bg-slate-100 text-slate-500 border-slate-200',
};
const ESTADO_LABEL = { ACTIVO: 'Activo', PENDIENTE: 'Pendiente', INACTIVO: 'Inactivo' };

const ACCION_LABEL = {
  REGISTRO_USUARIO:          'Usuario registrado',
  EDICION_USUARIO:           'Datos editados',
  DESACTIVAR_USUARIO:        'Usuario desactivado',
  REACTIVAR_USUARIO:         'Usuario reactivado',
  REENVIO_ACTIVACION:        'Correo de activación reenviado',
  ACTIVACION_EXITOSA:        'Cuenta activada',
  ACTIVACION_DNI_FALLIDO:    'Intento fallido de activación (DNI)',
  ACTIVACION_BLOQUEADO_TEMP: 'Bloqueo temporal por intentos',
};

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDIT_INIT = { nombre: '', apellido: '', email: '', telefono: '', direccion: '' };

export default function UsuarioModal({ id, onClose, onChanged }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const [tab, setTab] = useState('datos');           // 'datos' | 'historial'

  // Edición (CA4–CA7)
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(EDIT_INIT);
  const [fErrors, setFErrors] = useState({});
  const [saving, setSaving]   = useState(false);
  const [netError, setNetError] = useState('');       // CA14

  // Acciones de estado / activación
  const [confirmDesact, setConfirmDesact] = useState(false); // CA10
  const [acting, setActing] = useState(false);

  // Historial (CA16)
  const [actividad, setActividad] = useState(null);
  const [loadingAct, setLoadingAct] = useState(false);

  // Subida de imagen
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await api.get(`/users/${id}`);
      setUser(data);
    } catch (err) {
      if (err.response?.status === 404) { toast.error('Usuario no encontrado'); onClose?.(); return; }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, onClose]);

  useEffect(() => { cargar(); }, [cargar]);

  // Carga perezosa del historial al abrir la pestaña
  useEffect(() => {
    if (tab !== 'historial' || actividad !== null) return;
    setLoadingAct(true);
    api.get(`/users/${id}/activity`)
      .then(({ data }) => setActividad(data))
      .catch(() => setActividad([]))
      .finally(() => setLoadingAct(false));
  }, [tab, id, actividad]);

  const esDoctor = user?.rol === 'DOCTOR';
  const inactivo = user?.estado === 'INACTIVO';
  const pendiente = user?.estado === 'PENDIENTE';

  // ── Edición ──────────────────────────────────────────────────
  const abrirEdicion = () => {
    setForm({
      nombre: user.nombre ?? '', apellido: user.apellido ?? '',
      email: user.email ?? '', telefono: user.telefono ?? '',
      direccion: user.direccion ?? '',
    });
    setFErrors({}); setNetError(''); setEditing(true);
  };
  const cancelarEdicion = () => { setEditing(false); setFErrors({}); setNetError(''); }; // CA7

  const setCampo = (k, v) => {
    const val = k === 'telefono' ? v.replace(/\D/g, '').slice(0, 9)
      : (k === 'nombre' || k === 'apellido') ? v.toUpperCase() : v;
    setForm(f => ({ ...f, [k]: val }));
    setFErrors(e => ({ ...e, [k]: '' }));
    setNetError('');
  };

  const validar = () => {                              // CA5 (tiempo real al guardar)
    const e = {};
    if (!(form.nombre || '').trim())   e.nombre   = 'Requerido';
    if (!(form.apellido || '').trim()) e.apellido = 'Requerido';
    if (!RE_EMAIL.test((form.email || '').trim())) e.email = 'Correo inválido';
    if (!/^\d{9,}$/.test((form.telefono || '').replace(/\D/g, ''))) e.telefono = 'Mínimo 9 dígitos';
    return e;
  };

  const guardar = async (e) => {
    e?.preventDefault();
    const errs = validar();
    if (Object.keys(errs).length) { setFErrors(errs); return; }
    setSaving(true); setNetError('');
    try {
      const { data } = await api.put(`/users/${id}`, {
        nombre: (form.nombre || '').trim(), 
        apellido: (form.apellido || '').trim(),
        email: (form.email || '').trim(), 
        telefono: form.telefono,
        direccion: (form.direccion || '').trim() || undefined,
      });
      toast.success(data.message || 'Datos actualizados correctamente'); // CA6
      if (data.reinvitado) toast('Se reenvió la activación al nuevo correo', { icon: '✉️' }); // CA8
      setEditing(false);
      await cargar();
      onChanged?.();
    } catch (err) {
      if (!err.response) {                              // CA14: sin conexión → conservar lo escrito
        setNetError('Sin conexión. Tus cambios no se han perdido; reintenta.');
      } else if (err.response.status === 409) {
        setFErrors(e2 => ({ ...e2, email: err.response.data?.error || 'Correo en uso' }));
      } else {
        toast.error(err.response.data?.error || 'No se pudo guardar');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tipo y tamaño
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
      toast.success(data.message);
      // Actualizar la foto localmente para no tener que recargar todo
      setUser(u => ({ ...u, avatar: data.avatar }));
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al subir la imagen');
    } finally {
      setUploadingAvatar(false);
      // Limpiar input
      e.target.value = '';
    }
  };

  // ── Acciones de estado / activación ──────────────────────────
  const accion = async (fn, okMsg) => {
    setActing(true);
    try {
      const { data } = await fn();
      toast.success(data?.message || okMsg);
      await cargar();
      setActividad(null);            // forzar recarga del historial
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo completar la acción');
    } finally {
      setActing(false);
      setConfirmDesact(false);
    }
  };

  const reenviar    = () => accion(() => api.post(`/users/${id}/resend-activation`), 'Correo de activación reenviado correctamente');
  const reactivar   = () => accion(() => api.patch(`/users/${id}/reactivate`), 'Usuario reactivado');
  const desactivar  = () => accion(() => api.patch(`/users/${id}/deactivate`), 'Usuario desactivado correctamente');

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-bold text-[#0059B3] mb-3 pr-8">Perfil del usuario</h2>

        {/* Tabs */}
        {user && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-4">
            {[['datos', 'Datos'], ['historial', 'Historial de actividad']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors
                  ${tab === k ? 'bg-white text-[#0059B3] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="skeleton h-16 w-full rounded-xl" />
            <div className="skeleton h-32 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <AlertTriangle size={32} className="mx-auto mb-2 text-amber-400" />
            <p className="text-sm text-slate-600">No se pudo cargar el usuario.</p>
            <button onClick={cargar} className="mt-3 text-[#0059B3] text-sm font-medium hover:underline">Reintentar</button>
          </div>
        ) : user && tab === 'historial' ? (
          /* ── Historial de actividad (CA16) ── */
          <ActividadLista loading={loadingAct} items={actividad} />
        ) : user && (
          <div className="space-y-5">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="relative group w-14 h-14 flex-shrink-0">
                  {user.avatar ? (
                    <img 
                      src={user.avatar?.startsWith('http') ? user.avatar : `${import.meta.env.VITE_BASE_URL || 'http://localhost:4000'}${user.avatar}`} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover border-2 border-slate-100"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#0059B3]/10 flex items-center justify-center
                                    text-[#0059B3] text-lg font-bold select-none border-2 border-transparent">
                      {(user.nombre?.[0] ?? '') + (user.apellido?.[0] ?? '')}
                    </div>
                  )}
                  
                  <label className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/40 
                                     opacity-0 cursor-pointer transition-opacity text-white
                                     ${!inactivo && !uploadingAvatar ? 'group-hover:opacity-100' : 'hidden'}`}
                         title="Cambiar foto de perfil">
                    {uploadingAvatar ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png, image/webp" 
                      className="hidden" 
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar || inactivo}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800 leading-tight">{user.nombre} {user.apellido}</p>
                  <p className="text-sm text-slate-500 flex items-center gap-1.5">
                    <BadgeCheck size={14} /> {ROL_LABEL[user.rol] ?? user.rol ?? 'Sin rol'}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full border
                                ${ESTADO_STYLE[user.estado] ?? ESTADO_STYLE.INACTIVO}`}>
                {ESTADO_LABEL[user.estado] ?? user.estado}
              </span>
            </div>

            {/* CA3: aviso pendiente + reenviar activación */}
            {pendiente && !editing && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
                <ShieldAlert size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-amber-800 font-medium">Cuenta pendiente de activación</p>
                  <p className="text-xs text-amber-700">El usuario aún no ha creado su contraseña.</p>
                </div>
                <button onClick={reenviar} disabled={acting}
                  className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60
                             text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex-shrink-0">
                  {acting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Reenviar activación
                </button>
              </div>
            )}

            {/* CA12: aviso inactivo */}
            {inactivo && !editing && (
              <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <ShieldAlert size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-500">
                  Usuario <strong>inactivo</strong>: datos de solo lectura. Reactívalo para editar.
                </p>
              </div>
            )}

            {/* ── Modo edición (CA4) ── */}
            {editing ? (
              <form onSubmit={guardar} className="space-y-4">
                {netError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700
                                  text-sm rounded-lg px-3 py-2.5">
                    <WifiOff size={16} className="flex-shrink-0" /> {netError}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo label="Nombres *" value={form.nombre} onChange={v => setCampo('nombre', v)} error={fErrors.nombre} />
                  <Campo label="Apellidos *" value={form.apellido} onChange={v => setCampo('apellido', v)} error={fErrors.apellido} />
                  <Campo label="Correo *" value={form.email} onChange={v => setCampo('email', v)} error={fErrors.email} type="email" />
                  <Campo label="Teléfono *" value={form.telefono} onChange={v => setCampo('telefono', v)} error={fErrors.telefono} inputMode="numeric" hint="9 dígitos" />
                  <Campo label="Dirección" value={form.direccion} onChange={v => setCampo('direccion', v)} className="sm:col-span-2" />
                  {/* CA4: solo lectura */}
                  <CampoRO label="DNI" value={user.DNI} />
                  <CampoRO label="Rol" value={ROL_LABEL[user.rol] ?? user.rol} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={cancelarEdicion} disabled={saving}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium
                               text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99] disabled:opacity-60
                               text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* ── Botones de acción (CA2) ── */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={abrirEdicion} disabled={inactivo}        /* CA12 */
                    title={inactivo ? 'No se puede editar un usuario inactivo' : 'Editar datos'}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-colors
                      ${inactivo ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                                 : 'border-[#0059B3] text-[#0059B3] hover:bg-blue-50'}`}>
                    <Pencil size={14} /> Editar
                  </button>
                  {inactivo ? (
                    <button onClick={reactivar} disabled={acting}
                      className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60
                                 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                      {acting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Reactivar
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDesact(true)} disabled={acting || pendiente}
                      title={pendiente ? 'No se puede desactivar un usuario pendiente' : 'Desactivar usuario'}
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg transition-colors
                        ${pendiente 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                          : 'bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white'}`}>
                      <Power size={14} /> Desactivar
                    </button>
                  )}
                </div>

                {/* CA10: confirmación de desactivación */}
                {confirmDesact && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-3">
                    <p className="text-sm text-red-700 font-medium">
                      ¿Seguro que deseas desactivar a {user.nombre} {user.apellido}? Perderá el acceso al sistema.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmDesact(false)} disabled={acting}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-white transition-colors">
                        Cancelar
                      </button>
                      <button onClick={desactivar} disabled={acting}
                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60
                                   text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
                        {acting ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />} Sí, desactivar
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Datos (CA1) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-4">
                  <Dato icon={IdCard} label="DNI" value={user.DNI} mono />
                  <Dato icon={Mail}   label="Correo" value={user.email} />
                  <Dato icon={Phone}  label="Teléfono" value={user.telefono} />
                  <Dato icon={MapPin} label="Dirección" value={user.direccion} />
                  <Dato icon={BadgeCheck} label="Rol" value={ROL_LABEL[user.rol] ?? user.rol} />
                  <Dato icon={Calendar} label="Registrado" value={fmtFechaHora(user.fecha_registro)} />
                </div>

                {esDoctor && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-[#0059B3] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Stethoscope size={14} /> Datos del doctor
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                      <Dato label="C.O.P" value={user.nroColegiatura} mono />
                      <Dato label="Especialidades" value={user.especialidad || 'Sin especialidad'} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Historial de actividad ───────────────────────────────────────
function ActividadLista({ loading, items }) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-lg" />)}</div>;
  }
  if (!items?.length) {
    return (
      <div className="text-center py-12 text-slate-400">
        <History size={36} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">Sin actividad registrada.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map(a => (
        <li key={a.auditoria_id} className="flex items-start gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
          <Clock size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700">{ACCION_LABEL[a.accion] ?? a.accion}</p>
            <p className="text-xs text-slate-400">
              {fmtFechaHora(a.fecha_evento)}{a.actor ? ` · por ${a.actor}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Campos ────────────────────────────────────────────────────────
function Dato({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon size={15} className="text-slate-400 mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-sm text-slate-800 font-medium break-words ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, error, type = 'text', inputMode, hint, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type} value={value} inputMode={inputMode}
        onChange={e => onChange(e.target.value)}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-shadow
          ${error ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-[#0059B3]/40'}`}
      />
      {error
        ? <p className="text-xs text-red-500 mt-1">⚠ {error}</p>
        : hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function CampoRO({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-400 mb-1">{label} <span className="text-[10px]">(no editable)</span></label>
      <input value={value || '—'} disabled
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-400 cursor-not-allowed" />
    </div>
  );
}
