import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Pencil, ToggleLeft, ToggleRight,
  Search, Loader2, Stethoscope, X, Check,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import PageLoader from '../../components/PageLoader';

const soloLetras  = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
const soloEntero  = (v) => v.replace(/\D/g, '');
const soloDecimal = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');

const ESTADO_BADGE = {
  ACTIVO:   'bg-green-100 text-green-700',
  INACTIVO: 'bg-slate-100 text-slate-500',
};

export default function GestionarServicios() {
  const navigate = useNavigate();

  const [servicios, setServicios]     = useState([]);
  const [filtered, setFiltered]       = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [toggling, setToggling]       = useState(null); // servicio_id en proceso
  const [editTarget, setEditTarget]   = useState(null); // servicio a editar
  const [editForm, setEditForm]       = useState({});
  const [editErrors, setEditErrors]   = useState({});
  const [saving, setSaving]           = useState(false);
  const [serverError, setServerError] = useState('');

  const [loadError, setLoadError] = useState(false);

  const fetchServicios = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get('/services/all');
      const list = Array.isArray(data) ? data : [];
      setServicios(list);
      setFiltered(list);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServicios(); }, [fetchServicios]);

  // Filtro por búsqueda
  useEffect(() => {
    const q = search.toLowerCase().trim();
    setFiltered(
      q ? servicios.filter((s) => s.nombre.toLowerCase().includes(q)) : servicios
    );
  }, [search, servicios]);

  // ── Toggle estado ──────────────────────────────────────────────
  const toggleEstado = async (servicio) => {
    const nuevoEstado = servicio.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    setToggling(servicio.servicio_id);
    try {
      await api.put(`/services/${servicio.servicio_id}`, {
        ...servicio,
        estado: nuevoEstado,
      });
      toast.success(`Servicio ${nuevoEstado === 'ACTIVO' ? 'activado' : 'desactivado'}`);
      setServicios((prev) =>
        prev.map((s) =>
          s.servicio_id === servicio.servicio_id ? { ...s, estado: nuevoEstado } : s
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cambiar el estado');
    } finally {
      setToggling(null);
    }
  };

  // ── Abrir modal de edición ─────────────────────────────────────
  const openEdit = (servicio) => {
    setEditTarget(servicio);
    setEditForm({
      nombre:      servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      duracion:    String(servicio.duracion),
      costo:       String(servicio.costo),
      buffer:      String(servicio.buffer ?? 0),
      imagen:      servicio.imagen ?? '',
      estado:      servicio.estado,
    });
    setEditErrors({});
    setServerError('');
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditForm({});
    setEditErrors({});
    setServerError('');
  };

  const handleEditChange = (e) => {
    let { name, value } = e.target;
    if (name === 'nombre')                         value = soloLetras(value);
    if (name === 'duracion' || name === 'buffer')  value = soloEntero(value);
    if (name === 'costo')                          value = soloDecimal(value);
    setEditForm((p) => ({ ...p, [name]: value }));
    setEditErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const validateEdit = () => {
    const e = {};
    if (!editForm.nombre.trim())
      e.nombre = 'El nombre es requerido';
    else if (editForm.nombre.trim().length > 50)
      e.nombre = 'Máximo 50 caracteres';

    const dur = Number(editForm.duracion);
    if (!editForm.duracion || dur <= 0 || !Number.isInteger(dur))
      e.duracion = 'Entero mayor a 0';

    const cos = Number(editForm.costo);
    if (!editForm.costo || cos <= 0)
      e.costo = 'Precio mayor a 0';

    const buf = Number(editForm.buffer);
    if (editForm.buffer === '' || buf < 0 || !Number.isInteger(buf))
      e.buffer = '0 o entero positivo';

    return e;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errs = validateEdit();
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setSaving(true);
    setServerError('');
    try {
      await api.put(`/services/${editTarget.servicio_id}`, {
        nombre:      editForm.nombre.trim(),
        descripcion: editForm.descripcion.trim() || undefined,
        duracion:    Number(editForm.duracion),
        costo:       Number(editForm.costo),
        buffer:      Number(editForm.buffer),
        imagen:      editForm.imagen.trim() || undefined,
        estado:      editForm.estado,
      });
      toast.success('Servicio actualizado');
      setServicios((prev) =>
        prev.map((s) =>
          s.servicio_id === editTarget.servicio_id
            ? {
                ...s,
                nombre:      editForm.nombre.trim(),
                descripcion: editForm.descripcion.trim() || null,
                duracion:    Number(editForm.duracion),
                costo:       Number(editForm.costo),
                buffer:      Number(editForm.buffer),
                imagen:      editForm.imagen.trim() || null,
                estado:      editForm.estado,
              }
            : s
        )
      );
      closeEdit();
    } catch (err) {
      setServerError(err.response?.data?.error || 'Error al actualizar el servicio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLoader loading={loading} error={loadError} onRetry={fetchServicios}>
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/dashboard')}
                  className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#0059B3]">Gestionar servicios</h1>
            <p className="text-sm text-slate-500">Edita o cambia el estado de los servicios dentales</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-4 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
          />
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
              <Loader2 size={18} className="animate-spin" /> Cargando servicios…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400 text-sm gap-2">
              <Stethoscope size={28} className="opacity-30" />
              {search ? 'Sin resultados para tu búsqueda' : 'No hay servicios registrados'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs
                                  font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Duración</th>
                    <th className="px-4 py-3 hidden md:table-cell">Buffer</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Precio</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.servicio_id}
                        className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {s.nombre}
                        {s.descripcion && (
                          <p className="text-xs text-slate-400 font-normal truncate max-w-[180px]">
                            {s.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                        {s.duracion} min
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell whitespace-nowrap">
                        {s.buffer} min
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                        S/ {Number(s.costo).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px]
                                         font-semibold ${ESTADO_BADGE[s.estado]}`}>
                          {s.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Editar */}
                          <button
                            onClick={() => openEdit(s)}
                            title="Editar servicio"
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-[#0059B3]
                                       transition-colors"
                          >
                            <Pencil size={15} />
                          </button>

                          {/* Toggle estado */}
                          <button
                            onClick={() => toggleEstado(s)}
                            disabled={toggling === s.servicio_id}
                            title={s.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                            className={`p-1.5 rounded-lg transition-colors
                                        ${s.estado === 'ACTIVO'
                                          ? 'hover:bg-red-50 text-red-500'
                                          : 'hover:bg-green-50 text-green-600'}`}
                          >
                            {toggling === s.servicio_id
                              ? <Loader2 size={15} className="animate-spin" />
                              : s.estado === 'ACTIVO'
                                ? <ToggleRight size={18} />
                                : <ToggleLeft size={18} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Contador */}
        {!loading && (
          <p className="text-xs text-slate-400 mt-3 text-right">
            {filtered.length} de {servicios.length} servicio(s)
          </p>
        )}
      </div>

      {/* ── Modal edición ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        bg-black/40 px-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative">

            <button onClick={closeEdit}
                    className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100
                               text-slate-400 transition-colors">
              <X size={18} />
            </button>

            <h2 className="text-base font-bold text-[#0059B3] mb-4">
              Editar servicio
            </h2>

            <form onSubmit={handleEditSubmit} noValidate className="space-y-4">

              {/* Nombre */}
              <EField label="Nombre *" error={editErrors.nombre}>
                <input
                  name="nombre"
                  value={editForm.nombre}
                  onChange={handleEditChange}
                  maxLength={50}
                  className={inputCls(editErrors.nombre)}
                />
                <p className="text-xs text-slate-400 mt-1 text-right">
                  {editForm.nombre?.length ?? 0}/50
                </p>
              </EField>

              {/* Descripción */}
              <EField label="Descripción">
                <textarea
                  name="descripcion"
                  value={editForm.descripcion}
                  onChange={handleEditChange}
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 resize-none"
                />
              </EField>

              <div className="grid grid-cols-3 gap-3">
                {/* Duración */}
                <EField label="Duración *" error={editErrors.duracion} hint="min">
                  <input
                    name="duracion"
                    value={editForm.duracion}
                    onChange={handleEditChange}
                    inputMode="numeric"
                    className={inputCls(editErrors.duracion)}
                  />
                </EField>

                {/* Buffer */}
                <EField label="Buffer" error={editErrors.buffer} hint="min">
                  <input
                    name="buffer"
                    value={editForm.buffer}
                    onChange={handleEditChange}
                    inputMode="numeric"
                    className={inputCls(editErrors.buffer)}
                  />
                </EField>

                {/* Costo */}
                <EField label="Precio *" error={editErrors.costo} hint="S/">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2
                                     text-slate-400 text-sm">S/</span>
                    <input
                      name="costo"
                      value={editForm.costo}
                      onChange={handleEditChange}
                      inputMode="decimal"
                      className={`${inputCls(editErrors.costo)} pl-8`}
                    />
                  </div>
                </EField>
              </div>

              {/* Imagen */}
              <EField label="URL de imagen" hint="opcional">
                <input
                  name="imagen"
                  value={editForm.imagen}
                  onChange={handleEditChange}
                  placeholder="https://..."
                  className={inputCls()}
                />
              </EField>

              {/* Estado */}
              <EField label="Estado">
                <div className="flex gap-4">
                  {['ACTIVO', 'INACTIVO'].map((op) => (
                    <label key={op}
                           className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                      <input
                        type="radio"
                        name="estado"
                        value={op}
                        checked={editForm.estado === op}
                        onChange={handleEditChange}
                        className="accent-[#0059B3] w-4 h-4"
                      />
                      {op === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                    </label>
                  ))}
                </div>
              </EField>

              {/* Error servidor */}
              {serverError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200
                                text-red-700 text-sm rounded-lg px-3 py-2.5">
                  <span className="shrink-0 mt-0.5">✕</span>
                  <span>{serverError}</span>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 border border-slate-300 rounded-lg py-2 text-sm
                             font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2
                             bg-[#8BC63F] hover:bg-[#78ae35] disabled:opacity-60
                             disabled:cursor-not-allowed text-white font-semibold
                             py-2 rounded-lg text-sm transition-colors"
                >
                  {saving
                    ? <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                    : <><Check size={15} /> Guardar cambios</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PageLoader>
  );
}

// ── Helpers ──────────────────────────────────────────────────────
function EField({ label, error, hint, children }) {
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

function inputCls(error) {
  return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
          focus:ring-2 transition-shadow
          ${error
            ? 'border-red-400 focus:ring-red-300'
            : 'border-slate-300 focus:ring-[#0059B3]/40'}`;
}
