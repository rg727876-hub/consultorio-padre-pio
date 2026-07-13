import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, UserPlus, X, Camera } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

const ROLES = [
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'RECEPCIONISTA', label: 'Recepcionista' },
  { value: 'CAJERO',        label: 'Cajero'        },
];

const INITIAL = {
  nombre: '', apellido: '', DNI: '', email: '',
  telefono: '', direccion: '', rol: '',
  nroColegiatura: '',
};

// ── Filtros de input ─────────────────────────────────────────────
const soloLetras   = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
const soloNumeros  = (v, max) => v.replace(/\D/g, '').slice(0, max);

export default function RegistroUsuario() {
  const [searchParams] = useSearchParams();
  const isSoloDoctor = searchParams.get('tipo') === 'doctor';

  const [form, setForm]               = useState(() => ({ ...INITIAL, rol: isSoloDoctor ? 'DOCTOR' : '' }));
  const [servicios, setServicios]     = useState([]);
  const [selServicios, setSelServicios] = useState([]);
  const [especialidadesCat, setEspecialidadesCat] = useState([]);
  const [selEspecialidades, setSelEspecialidades] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [loadingSvc, setLoadingSvc]   = useState(false);
  const [errors, setErrors]           = useState({});
  const [serverError, setServerError] = useState('');
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [reniecLoading, setReniecLoading] = useState(false);

  const esDoctor = form.rol === 'DOCTOR';

  // ── Auto-fetch RENIEC ──────────────────────────────────────────
  useEffect(() => {
    const fetchReniec = async () => {
      if (form.DNI.length === 8) {
        setReniecLoading(true);
        try {
          const res = await api.get(`/public/reniec/${form.DNI}`);
          setForm((prev) => ({
            ...prev,
            nombre: res.data.first_name || '',
            apellido: `${res.data.first_last_name || ''} ${res.data.second_last_name || ''}`.trim()
          }));
          setErrors((prev) => ({ ...prev, nombre: '', apellido: '', DNI: '' }));
        } catch (error) {
          setForm((prev) => ({ ...prev, nombre: '', apellido: '' }));
          setErrors((prev) => ({ 
            ...prev, 
            DNI: 'El DNI no existe en RENIEC'
          }));
        } finally {
          setReniecLoading(false);
        }
      } else {
        setForm((prev) => ({ ...prev, nombre: '', apellido: '' }));
      }
    };
    fetchReniec();
  }, [form.DNI]);

  // Cargar servicios y especialidades cuando se elige Doctor
  useEffect(() => {
    if (!esDoctor) {
      setServicios([]); setSelServicios([]);
      setEspecialidadesCat([]); setSelEspecialidades([]);
      return;
    }
    setLoadingSvc(true);
    Promise.all([api.get('/services'), api.get('/especialidades')])
      .then(([svc, esp]) => { setServicios(svc.data); setEspecialidadesCat(esp.data); })
      .catch(() => toast.error('No se pudieron cargar servicios o especialidades'))
      .finally(() => setLoadingSvc(false));
  }, [esDoctor]);

  // ── Handlers de cambio con filtro por campo ──────────────────
  const handleField = (name, rawValue) => {
    let value = rawValue;

    if (name === 'nombre' || name === 'apellido')
      value = soloLetras(rawValue);

    // Nombre y apellido siempre en MAYÚSCULAS para uniformar las búsquedas
    if (name === 'nombre' || name === 'apellido')
      value = value.toUpperCase();

    if (name === 'DNI')
      value = soloNumeros(rawValue, 8);

    if (name === 'telefono')
      value = soloNumeros(rawValue, 9);

    if (name === 'nroColegiatura')
      value = soloNumeros(rawValue, 5);

    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const handleChange = (e) => handleField(e.target.name, e.target.value);

  const toggleServicio = (id) =>
    setSelServicios((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  const handleImageChange = (e) => {
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

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // ── Validación ───────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.nombre.trim())      e.nombre   = 'Nombre requerido';
    if (!form.apellido.trim())    e.apellido = 'Apellido requerido';
    if (!/^\d{8}$/.test(form.DNI)) e.DNI    = 'DNI debe tener exactamente 8 dígitos';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo electrónico inválido';
    if (!/^\d{9}$/.test(form.telefono)) e.telefono = 'El teléfono debe tener exactamente 9 dígitos';
    if (!form.rol)                e.rol      = 'Selecciona un rol';
    if (esDoctor) {
      // La especialidad es opcional (puede ser un recién egresado sin especialidad)
      if (!form.nroColegiatura.trim()) e.nroColegiatura = 'C.O.P requerido';
    }
    return e;
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError('');
    try {
      const payload = {
        nombre:         form.nombre.trim(),
        apellido:       form.apellido.trim(),
        DNI:            form.DNI,
        email:          form.email.trim(),
        telefono:       form.telefono,
        direccion:      form.direccion.trim() || undefined,
        rol:            form.rol,
        especialidades: esDoctor ? selEspecialidades : undefined,
        nroColegiatura: esDoctor ? form.nroColegiatura : undefined,
        servicios:      esDoctor ? selServicios        : [],
      };

      const { data } = await api.post('/users', payload);
      
      if (imageFile && data.usuario_id) {
        const formData = new FormData();
        formData.append('avatar', imageFile);
        try {
          await api.post(`/users/${data.usuario_id}/avatar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (imgErr) {
          toast.error('El usuario se creó, pero hubo un error al subir la foto de perfil');
        }
      }

      toast.success(data.message || 'Usuario registrado correctamente');
      setForm({ ...INITIAL, rol: isSoloDoctor ? 'DOCTOR' : '' });
      setSelServicios([]);
      setSelEspecialidades([]);
      setImageFile(null);
      setImagePreview(null);
      setErrors({});
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar el usuario';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── UI ───────────────────────────────────────────────────────
  return (
    <AppLayout>
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto">

        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#0059B3]">
            {isSoloDoctor ? 'Registrar nuevo doctor' : 'Registrar nuevo usuario'}
          </h1>
          <p className="text-sm text-slate-500">
            Se enviará un correo de activación al correo ingresado
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">

            <div>
              <SectionTitle>Datos personales</SectionTitle>
              
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nombre *" error={errors.nombre}>
                    <Input name="nombre" value={form.nombre} onChange={handleChange}
                           placeholder="Ej. Juan" error={errors.nombre} disabled={true} />
                  </Field>
                  <Field label="Apellido *" error={errors.apellido}>
                    <Input name="apellido" value={form.apellido} onChange={handleChange}
                           placeholder="Ej. Pérez" error={errors.apellido} disabled={true} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="DNI *" error={errors.DNI} hint="8 dígitos, solo números">
                    <div className="relative">
                      <Input name="DNI" value={form.DNI} onChange={handleChange}
                             placeholder="12345678" maxLength={8}
                             inputMode="numeric" error={errors.DNI} disabled={reniecLoading} />
                      {reniecLoading && (
                        <div className="absolute right-3 top-2.5">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </div>
                      )}
                    </div>
                  </Field>
                  <Field label="Teléfono *" error={errors.telefono} hint="9 dígitos, solo números">
                    <Input name="telefono" value={form.telefono} onChange={handleChange}
                           placeholder="987654321" maxLength={9}
                           inputMode="numeric" error={errors.telefono} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Correo electrónico *" error={errors.email}>
                    <Input type="email" name="email" value={form.email} onChange={handleChange}
                           placeholder="correo@clinica.com" error={errors.email} />
                  </Field>

                  <Field label="Dirección">
                    <Input name="direccion" value={form.direccion} onChange={handleChange}
                           placeholder="Opcional" />
                  </Field>
                </div>

                <div className="pt-2">
                  <p className="block text-sm font-medium text-slate-700 mb-3">Foto de perfil (Opcional)</p>
                  <div className="flex items-center gap-4">
                    <div 
                      className="relative w-24 h-24 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex items-center justify-center cursor-pointer overflow-hidden transition-colors shadow-sm flex-shrink-0"
                      onClick={() => document.getElementById('avatarInput')?.click()}
                    >
                      {imagePreview ? (
                        <img src={imagePreview} alt="Avatar preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                          <Camera size={24} className="mb-1" />
                          <span className="text-[10px] font-medium uppercase tracking-widest">Foto</span>
                        </div>
                      )}
                      <input 
                        id="avatarInput"
                        type="file" 
                        accept="image/jpeg, image/png, image/webp" 
                        className="hidden" 
                        onChange={handleImageChange}
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      <p className="font-medium text-slate-700">Subir una imagen</p>
                      <p>Puedes subir una foto en formato JPG, PNG o WEBP.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!isSoloDoctor && (
              <>
                <SectionTitle>Rol en el sistema</SectionTitle>

                <Field label="Rol *" error={errors.rol}>
                  <select name="rol" value={form.rol} onChange={handleChange}
                          className={selectCls(errors.rol)}>
                    <option value="">Selecciona un rol</option>
                    {ROLES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {/* Campos extra para Doctor */}
            {esDoctor && (
              <div className="border border-[#0059B3]/20 rounded-xl p-4 bg-blue-50/40 space-y-4">
                <p className="text-sm font-semibold text-[#0059B3]">Datos del doctor</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Especialidades"
                         hint="Opcional — puedes agregar una o varias">
                    <select
                      value=""
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        if (id) setSelEspecialidades((prev) =>
                          prev.includes(id) ? prev : [...prev, id]);
                      }}
                      className={selectCls()}>
                      <option value="">+ Agregar especialidad…</option>
                      {especialidadesCat
                        .filter((esp) => !selEspecialidades.includes(esp.especialidad_id))
                        .map((esp) => (
                          <option key={esp.especialidad_id} value={esp.especialidad_id}>
                            {esp.nombre}
                          </option>
                        ))}
                    </select>
                    {selEspecialidades.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selEspecialidades.map((id) => {
                          const esp = especialidadesCat.find((e) => e.especialidad_id === id);
                          return (
                            <span key={id}
                                  className="inline-flex items-center gap-1 bg-blue-50 text-[#0059B3]
                                             text-xs font-medium px-2 py-1 rounded-lg border border-blue-200">
                              {esp?.nombre ?? id}
                              <button type="button"
                                onClick={() => setSelEspecialidades((prev) => prev.filter((x) => x !== id))}
                                className="hover:text-red-500" title="Quitar">
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </Field>
                  <Field label="C.O.P *" error={errors.nroColegiatura}
                         hint="Solo números">
                    <Input name="nroColegiatura" value={form.nroColegiatura}
                           onChange={handleChange}
                           placeholder="Ej. 123456" inputMode="numeric"
                           error={errors.nroColegiatura} />
                  </Field>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    Servicios que atiende
                  </p>
                  {loadingSvc ? (
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Cargando...
                    </p>
                  ) : servicios.length === 0 ? (
                    <p className="text-sm text-slate-400">No hay servicios disponibles</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {servicios.map((s) => (
                        <label key={s.servicio_id}
                               className="flex items-center gap-2 cursor-pointer
                                          text-sm text-slate-700 hover:text-[#0059B3]">
                          <input type="checkbox"
                                 checked={selServicios.includes(s.servicio_id)}
                                 onChange={() => toggleServicio(s.servicio_id)}
                                 className="accent-[#8BC63F] w-4 h-4" />
                          {s.nombre}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error del servidor */}
            {serverError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200
                              text-red-700 text-sm rounded-lg px-3 py-2.5">
                <span className="shrink-0 mt-0.5">✕</span>
                <span>{serverError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2
                         bg-[#8BC63F] hover:bg-[#78ae35] active:bg-[#669230]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-semibold py-2.5 rounded-lg text-sm
                         transition-colors duration-200 shadow-sm"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Registrando...</>
                : <><UserPlus size={16} /> Registrar usuario</>}
            </button>

          </div>
        </form>
      </div>
    </div>
    </AppLayout>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <p className="text-xs font-semibold text-[#0059B3] uppercase tracking-wider
                  border-b border-slate-100 pb-1">
      {children}
    </p>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-slate-700">{label}</label>
        {!error && hint && <span className="text-[10px] text-slate-400 font-normal">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">⚠ {error}</p>}
    </div>
  );
}

function Input({ error, ...props }) {
  const border = error
    ? 'border-red-400 focus:ring-red-300'
    : 'border-slate-300 focus:ring-[#0059B3]/40';
  return (
    <input
      className={`w-full border ${border} rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 transition-shadow`}
      {...props}
    />
  );
}

function selectCls(error) {
  const border = error
    ? 'border-red-400 focus:ring-red-300'
    : 'border-slate-300 focus:ring-[#0059B3]/40';
  return `w-full border ${border} rounded-lg px-3 py-2 text-sm bg-white
          focus:outline-none focus:ring-2 transition-shadow`;
}
