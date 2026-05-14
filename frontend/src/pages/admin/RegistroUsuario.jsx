import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, UserPlus, ChevronLeft } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'ADMINISTRADOR', label: 'Administrador' },
  { value: 'RECEPCIONISTA', label: 'Recepcionista' },
  { value: 'CAJERO',        label: 'Cajero'        },
  { value: 'DOCTOR',        label: 'Doctor'        },
];

const INITIAL = {
  nombre: '', apellido: '', DNI: '', email: '',
  telefono: '', direccion: '', rol: '',
  especialidad: '', nroColegiatura: '',
};

// ── Filtros de input ─────────────────────────────────────────────
const soloLetras   = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
const soloNumeros  = (v, max) => v.replace(/\D/g, '').slice(0, max);

export default function RegistroUsuario() {
  const navigate = useNavigate();

  const [form, setForm]               = useState(INITIAL);
  const [servicios, setServicios]     = useState([]);
  const [selServicios, setSelServicios] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [loadingSvc, setLoadingSvc]   = useState(false);
  const [errors, setErrors]           = useState({});
  const [serverError, setServerError] = useState('');

  const esDoctor = form.rol === 'DOCTOR';

  // Cargar servicios cuando se elige Doctor
  useEffect(() => {
    if (!esDoctor) { setServicios([]); setSelServicios([]); return; }
    setLoadingSvc(true);
    api.get('/services')
      .then(({ data }) => setServicios(data))
      .catch(() => toast.error('No se pudieron cargar los servicios'))
      .finally(() => setLoadingSvc(false));
  }, [esDoctor]);

  // ── Handlers de cambio con filtro por campo ──────────────────
  const handleField = (name, rawValue) => {
    let value = rawValue;

    if (name === 'nombre' || name === 'apellido' || name === 'especialidad')
      value = soloLetras(rawValue);

    if (name === 'DNI')
      value = soloNumeros(rawValue, 8);

    if (name === 'telefono')
      value = soloNumeros(rawValue, 9);

    if (name === 'nroColegiatura')
      value = soloNumeros(rawValue, 10);

    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const handleChange = (e) => handleField(e.target.name, e.target.value);

  const toggleServicio = (id) =>
    setSelServicios((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

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
      if (!form.especialidad.trim())   e.especialidad   = 'Especialidad requerida';
      if (!form.nroColegiatura.trim()) e.nroColegiatura = 'N° de colegiatura requerido';
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
        especialidad:   esDoctor ? form.especialidad.trim() : undefined,
        nroColegiatura: esDoctor ? form.nroColegiatura      : undefined,
        servicios:      esDoctor ? selServicios             : [],
      };

      const { data } = await api.post('/users', payload);
      toast.success(data.message || 'Usuario registrado correctamente');
      setForm(INITIAL);
      setSelServicios([]);
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
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#0059B3]">Registrar nuevo usuario</h1>
            <p className="text-sm text-slate-500">
              Se enviará un correo de activación al correo ingresado
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

            <SectionTitle>Datos personales</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre *" error={errors.nombre}>
                <Input name="nombre" value={form.nombre} onChange={handleChange}
                       placeholder="Ej. Juan" error={errors.nombre} />
              </Field>
              <Field label="Apellido *" error={errors.apellido}>
                <Input name="apellido" value={form.apellido} onChange={handleChange}
                       placeholder="Ej. Pérez" error={errors.apellido} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="DNI *" error={errors.DNI}
                     hint="8 dígitos, solo números">
                <Input name="DNI" value={form.DNI} onChange={handleChange}
                       placeholder="12345678" maxLength={8}
                       inputMode="numeric" error={errors.DNI} />
              </Field>
              <Field label="Teléfono *" error={errors.telefono}
                     hint="9 dígitos, solo números">
                <Input name="telefono" value={form.telefono} onChange={handleChange}
                       placeholder="987654321" maxLength={9}
                       inputMode="numeric" error={errors.telefono} />
              </Field>
            </div>

            <Field label="Correo electrónico *" error={errors.email}>
              <Input type="email" name="email" value={form.email} onChange={handleChange}
                     placeholder="correo@clinica.com" error={errors.email} />
            </Field>

            <Field label="Dirección">
              <Input name="direccion" value={form.direccion} onChange={handleChange}
                     placeholder="Opcional" />
            </Field>

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

            {/* Campos extra para Doctor */}
            {esDoctor && (
              <div className="border border-[#0059B3]/20 rounded-xl p-4 bg-blue-50/40 space-y-4">
                <p className="text-sm font-semibold text-[#0059B3]">Datos del doctor</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Especialidad *" error={errors.especialidad}
                         hint="Solo letras">
                    <Input name="especialidad" value={form.especialidad}
                           onChange={handleChange}
                           placeholder="Ej. Ortodoncia" error={errors.especialidad} />
                  </Field>
                  <Field label="N° Colegiatura *" error={errors.nroColegiatura}
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
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error
        ? <p className="text-xs text-red-500 mt-1">⚠ {error}</p>
        : hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
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
