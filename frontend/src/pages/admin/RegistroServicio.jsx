import { useState, useRef } from 'react';
import { Loader2, Stethoscope, ImagePlus, X } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

const INITIAL = {
  nombre:      '',
  descripcion: '',
  duracion:    '',
  costo:       '',
  buffer:      '5',
};

const soloLetras  = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
const soloEntero  = (v) => v.replace(/\D/g, '');
const soloDecimal = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');

export default function RegistroServicio() {
  const [form, setForm]               = useState(INITIAL);
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState({});
  const [serverError, setServerError] = useState('');
  const fileInputRef                  = useRef(null);

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'nombre')                         value = soloLetras(value);
    if (name === 'duracion')  value = soloEntero(value);
    if (name === 'costo')                          value = soloDecimal(value);
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

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

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        estado:      'ACTIVO',
      });
      
      const servicioId = data.servicio_id;
      
      // Subir imagen si se seleccionó
      if (imageFile && servicioId) {
        const formData = new FormData();
        formData.append('imagen', imageFile);
        await api.post(`/services/${servicioId}/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success(data.message || 'Servicio registrado con éxito');
      setForm(INITIAL);
      clearImage();
      setErrors({});
    } catch (err) {
      setServerError(err.response?.data?.error || 'Error al registrar el servicio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
    <div className="px-4 py-8">
      <div className="max-w-xl mx-auto">

        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#0059B3]">Registrar nuevo servicio</h1>
          <p className="text-sm text-slate-500">Completa los datos del servicio dental</p>
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

            {/* Imagen del Servicio */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Imagen Representativa (Opcional)</label>
              <div className="flex items-start gap-4">
                <div 
                  className={`relative flex items-center justify-center border-2 border-dashed rounded-xl overflow-hidden
                              ${imagePreview ? 'border-transparent bg-slate-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer'} 
                              w-32 h-32 transition-colors flex-shrink-0`}
                  onClick={() => !imagePreview && fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearImage(); }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        title="Quitar imagen"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="text-slate-400 flex flex-col items-center">
                      <ImagePlus size={24} className="mb-1" />
                      <span className="text-xs font-medium">Subir foto</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png, image/webp" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageChange}
                  />
                </div>
                <div className="flex-1 text-sm text-slate-500">
                  <p className="mb-1">Añade una foto para identificar el servicio más fácilmente.</p>
                  <p className="text-xs">Recomendado: formato cuadrado, máximo 5MB (JPG, PNG, WEBP).</p>
                </div>
              </div>
            </div>

            <SectionTitle>Tiempo y precio</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Duración */}
              <Field label="Duración *" error={errors.duracion} hint="minutos">
                <Input name="duracion" value={form.duracion} onChange={handleChange}
                       placeholder="30" inputMode="numeric" error={errors.duracion} />
              </Field>

              {/* Buffer */}
              <Field label="Tiempo de espera" hint="minutos">
                <select name="buffer" value={form.buffer} onChange={handleChange}
                        className={selectCls()}>
                  {[5, 10, 15, 20, 25, 30].map((v) => (
                    <option key={v} value={String(v)}>{v}</option>
                  ))}
                </select>
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
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error
        ? <p className="text-xs text-red-500 mt-1">⚠ {error}</p>
        : hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function selectCls(error) {
  const border = error
    ? 'border-red-400 focus:ring-red-300'
    : 'border-slate-300 focus:ring-[#0059B3]/40';
  return `w-full border ${border} rounded-lg px-3 py-2 text-sm bg-white
          focus:outline-none focus:ring-2 transition-shadow`;
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
