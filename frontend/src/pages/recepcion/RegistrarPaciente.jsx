import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

const TIPOS_DOC = [
  { value: 'DNI',       label: 'DNI' },
  { value: 'CE',        label: 'Carné de extranjería' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
];

const SEXOS = [
  { value: 'FEMENINO',  label: 'Femenino' },
  { value: 'MASCULINO', label: 'Masculino' },
];

const INITIAL = {
  nombre: '', apellido: '', tipo_documento: 'DNI', numero_documento: '',
  telefono: '', sexo: '',
  email: '', fecha_nacimiento: '', direccion: '', ocupacion: '', contacto_emergencia: '',
};

const soloLetras  = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
const soloNumeros = (v, max) => v.replace(/\D/g, '').slice(0, max);

export default function RegistrarPaciente() {
  const [form, setForm]             = useState(INITIAL);
  const [loading, setLoading]       = useState(false);
  const [errors, setErrors]         = useState({});
  const [serverError, setServerError] = useState('');

  const handleField = (name, rawValue) => {
    let value = rawValue;

    if (name === 'nombre' || name === 'apellido')
      value = soloLetras(rawValue);

    if (name === 'telefono' || name === 'contacto_emergencia')
      value = soloNumeros(rawValue, 9);

    if (name === 'numero_documento' && form.tipo_documento === 'DNI')
      value = soloNumeros(rawValue, 8);

    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const handleChange = (e) => handleField(e.target.name, e.target.value);

  const validate = () => {
    const e = {};
    if (!form.nombre.trim())    e.nombre   = 'Nombre requerido';
    if (!form.apellido.trim())  e.apellido = 'Apellido requerido';
    if (!form.tipo_documento)   e.tipo_documento = 'Selecciona un tipo de documento';

    if (!form.numero_documento.trim()) {
      e.numero_documento = 'Número de documento requerido';
    } else if (form.tipo_documento === 'DNI' && !/^\d{8}$/.test(form.numero_documento)) {
      e.numero_documento = 'El DNI debe tener exactamente 8 dígitos';
    }

    if (!/^\d{9}$/.test(form.telefono))
      e.telefono = 'El teléfono debe tener exactamente 9 dígitos';

    if (!form.sexo) e.sexo = 'Selecciona el sexo';

    if (!form.fecha_nacimiento) {
      e.fecha_nacimiento = 'Fecha de nacimiento requerida';
    } else {
      const hoy = new Date().toLocaleDateString('en-CA');
      if (form.fecha_nacimiento >= hoy)
        e.fecha_nacimiento = 'La fecha de nacimiento debe ser anterior al día de hoy';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = 'Correo electrónico inválido';

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError('');
    try {
      const payload = {
        nombre:              form.nombre.trim(),
        apellido:            form.apellido.trim(),
        tipo_documento:      form.tipo_documento,
        numero_documento:    form.numero_documento.trim(),
        telefono:            form.telefono,
        sexo:                form.sexo,
        email:               form.email.trim()               || undefined,
        fecha_nacimiento:    form.fecha_nacimiento,
        direccion:           form.direccion.trim()            || undefined,
        ocupacion:           form.ocupacion.trim()            || undefined,
        contacto_emergencia: form.contacto_emergencia.trim()  || undefined,
      };

      const { data } = await api.post('/patients', payload);
      toast.success(data.message || 'Paciente registrado correctamente');
      setForm(INITIAL);
      setErrors({});
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrar el paciente';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#0059B3]">Registrar nuevo paciente</h1>
          <p className="text-sm text-slate-500">Los campos marcados con * son obligatorios</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

            <SectionTitle>Datos personales</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre *" error={errors.nombre}>
                <Input name="nombre" value={form.nombre} onChange={handleChange}
                       placeholder="Ej. María" error={errors.nombre} />
              </Field>
              <Field label="Apellido *" error={errors.apellido}>
                <Input name="apellido" value={form.apellido} onChange={handleChange}
                       placeholder="Ej. García" error={errors.apellido} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tipo de documento *" error={errors.tipo_documento}>
                <select name="tipo_documento" value={form.tipo_documento}
                        onChange={handleChange} className={selectCls(errors.tipo_documento)}>
                  {TIPOS_DOC.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Número de documento *" error={errors.numero_documento}
                     hint={form.tipo_documento === 'DNI' ? '8 dígitos' : undefined}>
                <Input name="numero_documento" value={form.numero_documento}
                       onChange={handleChange}
                       placeholder={form.tipo_documento === 'DNI' ? '12345678' : ''}
                       inputMode={form.tipo_documento === 'DNI' ? 'numeric' : 'text'}
                       maxLength={form.tipo_documento === 'DNI' ? 8 : 20}
                       error={errors.numero_documento} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teléfono *" error={errors.telefono} hint="9 dígitos">
                <Input name="telefono" value={form.telefono} onChange={handleChange}
                       placeholder="987654321" maxLength={9}
                       inputMode="numeric" error={errors.telefono} />
              </Field>
              <Field label="Sexo *" error={errors.sexo}>
                <select name="sexo" value={form.sexo}
                        onChange={handleChange} className={selectCls(errors.sexo)}>
                  <option value="">Selecciona</option>
                  {SEXOS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fecha de nacimiento *" error={errors.fecha_nacimiento}>
                <Input type="date" name="fecha_nacimiento" value={form.fecha_nacimiento}
                       onChange={handleChange} error={errors.fecha_nacimiento}
                       max={(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('en-CA'); })()} />
              </Field>
              <Field label="Correo electrónico" error={errors.email}>
                <Input type="email" name="email" value={form.email}
                       onChange={handleChange} placeholder="correo@ejemplo.com"
                       error={errors.email} />
              </Field>
            </div>

            <SectionTitle>Información adicional</SectionTitle>

            <Field label="Dirección">
              <Input name="direccion" value={form.direccion} onChange={handleChange}
                     placeholder="Av. Ejemplo 123, Lima" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ocupación">
                <Input name="ocupacion" value={form.ocupacion} onChange={handleChange}
                       placeholder="Ej. Docente" />
              </Field>
              <Field label="Contacto de emergencia" hint="9 dígitos">
                <Input name="contacto_emergencia" value={form.contacto_emergencia}
                       onChange={handleChange}
                       placeholder="987654321" maxLength={9}
                       inputMode="numeric" />
              </Field>
            </div>

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
                : <><UserPlus size={16} /> Registrar paciente</>}
            </button>

          </div>
        </form>
      </div>
    </div>
    </AppLayout>
  );
}

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
