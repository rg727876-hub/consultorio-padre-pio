import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, Stethoscope } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const INITIAL = {
  nombre:      '',
  descripcion: '',
  duracion:    '',
  costo:       '',
  buffer:      '0',
  imagen:      '',
  estado:      'ACTIVO',
};

const soloLetras  = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
const soloEntero  = (v) => v.replace(/\D/g, '');
const soloDecimal = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');

export default function RegistroServicio() {
  const navigate = useNavigate();

  const [form, setForm]               = useState(INITIAL);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState({});
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'nombre')                         value = soloLetras(value);
    if (name === 'duracion' || name === 'buffer')  value = soloEntero(value);
    if (name === 'costo')                          value = soloDecimal(value);
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const e = {};
    if (!form.nombre.trim())
      e.nombre = 'El nombre es requerido';
    else if (form.nombre.trim().length > 50)
      e.nombre = 'Máximo 50 caracteres';

    const dur = Number(form.duracion);
    if (!form.duracion || dur <= 0 || !Number.isInteger(dur))
      e.duracion = 'Ingresa un número entero mayor a 0';

    const cos = Number(form.costo);
    if (!form.costo || cos <= 0)
      e.costo = 'Ingresa un precio mayor a 0';

    const buf = Number(form.buffer);
    if (form.buffer === '' || buf < 0 || !Number.isInteger(buf))
      e.buffer = 'Ingresa 0 o un número entero positivo';

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError('');
    try {
      const { data } = await api.post('/services', {
        nombre:      form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        duracion:    Number(form.duracion),
        costo:       Number(form.costo),
        buffer:      Number(form.buffer),
        imagen:      form.imagen.trim() || undefined,
        estado:      form.estado,
      });
      toast.success(data.message || 'Servicio registrado');
      setForm(INITIAL);
      setErrors({});
    } catch (err) {
      setServerError(err.response?.data?.error || 'Error al registrar el servicio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-xl mx-auto">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/dashboard')}
                  className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#0059B3]">Registrar nuevo servicio</h1>
            <p className="text-sm text-slate-500">Completa los datos del servicio dental</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">

            <SectionTitle>Información del servicio</SectionTitle>

            {/* Nombre */}
            <Field label="Nombre del servicio *" error={errors.nombre}>
              <Input name="nombre" value={form.nombre} onChange={handleChange}
                     placeholder="Ej. Limpieza Dental" maxLength={50} error={errors.nombre} />
              <p className="text-xs text-slate-400 mt-1 text-right">
                {form.nombre.length}/50
              </p>
            </Field>

            {/* Descripción */}
            <Field label="Descripción">
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                rows={3}
                placeholder="Describe brevemente el servicio (opcional)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40
                           resize-none transition-shadow"
              />
            </Field>

            <SectionTitle>Tiempo y precio</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Duración */}
              <Field label="Duración *" error={errors.duracion} hint="minutos">
                <Input name="duracion" value={form.duracion} onChange={handleChange}
                       placeholder="30" inputMode="numeric" error={errors.duracion} />
              </Field>

              {/* Buffer */}
              <Field label="Tiempo de espera" error={errors.buffer} hint="minutos">
                <Input name="buffer" value={form.buffer} onChange={handleChange}
                       placeholder="0" inputMode="numeric" error={errors.buffer} />
              </Field>

              {/* Costo */}
              <Field label="Precio *" error={errors.costo} hint="soles (S/)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2
                                   text-slate-400 text-sm font-medium">S/</span>
                  <input
                    name="costo"
                    value={form.costo}
                    onChange={handleChange}
                    placeholder="0.00"
                    inputMode="decimal"
                    className={`w-full border rounded-lg pl-8 pr-3 py-2 text-sm
                                focus:outline-none focus:ring-2 transition-shadow
                                ${errors.costo
                                  ? 'border-red-400 focus:ring-red-300'
                                  : 'border-slate-300 focus:ring-[#0059B3]/40'}`}
                  />
                </div>
              </Field>
            </div>

            <SectionTitle>Opciones adicionales</SectionTitle>

            {/* Imagen */}
            <Field label="URL de imagen" hint="opcional">
              <Input name="imagen" value={form.imagen} onChange={handleChange}
                     placeholder="https://..." />
            </Field>

            {/* Estado */}
            <Field label="Estado inicial">
              <div className="flex gap-4">
                {['ACTIVO', 'INACTIVO'].map((op) => (
                  <label key={op}
                         className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="radio"
                      name="estado"
                      value={op}
                      checked={form.estado === op}
                      onChange={handleChange}
                      className="accent-[#0059B3] w-4 h-4"
                    />
                    {op === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                  </label>
                ))}
              </div>
            </Field>

            {/* Error servidor */}
            {serverError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200
                              text-red-700 text-sm rounded-lg px-3 py-2.5">
                <span className="shrink-0 mt-0.5">✕</span>
                <span>{serverError}</span>
              </div>
            )}

            {/* Botón */}
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
                : <><Stethoscope size={16} /> Registrar servicio</>}
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
