import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, UserPlus, ChevronLeft, ChevronRight, Eye, AlertTriangle, UserX,
} from 'lucide-react';
import api from '../../api/axios';
import AppLayout from '../../components/AppLayout';
import UsuarioModal from './UsuarioModal';

const ROL_LABEL = {
  ADMINISTRADOR: 'Administrador',
  RECEPCIONISTA: 'Recepcionista',
  CAJERO:        'Cajero',
  DOCTOR:        'Doctor',
};

// Badge de estado (CA7: Activo verde, Pendiente resaltado ámbar, Inactivo gris)
function EstadoBadge({ estado }) {
  const map = {
    ACTIVO:    ['bg-emerald-50 text-emerald-700 border-emerald-200', 'bg-emerald-500', 'Activo'],
    PENDIENTE: ['bg-amber-100 text-amber-700 border-amber-300',      'bg-amber-500',   'Pendiente'],
    INACTIVO:  ['bg-slate-50 text-slate-500 border-slate-200',       'bg-slate-400',   'Inactivo'],
  };
  const [cls, dot, label] = map[estado] ?? map.INACTIVO;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label}
    </span>
  );
}

export default function ListaUsuarios() {
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [page,     setPage]     = useState(1);
  const [pages,    setPages]    = useState(1);
  const [total,    setTotal]    = useState(0);

  const [q,      setQ]      = useState('');
  const [rol,    setRol]    = useState('');         // '' = todos los roles
  const [estado, setEstado] = useState('ACTIVO');   // default: solo activos (CA1)
  const [detalleId, setDetalleId] = useState(null); // usuario en ventana flotante

  const fetchUsuarios = useCallback(async (p = 1, overrides = {}) => {
    const f = { q, rol, estado, ...overrides };
    setLoading(true);
    setError('');
    try {
      const params = { page: p };
      if (f.q?.trim()) params.q      = f.q.trim();
      if (f.rol)       params.rol    = f.rol;
      if (f.estado)    params.estado = f.estado;

      const { data } = await api.get('/users', { params });
      setUsuarios(data.data ?? []);
      setPages(data.pages ?? 1);
      setTotal(data.total ?? 0);
      setPage(p);
    } catch {
      setError('Error de conexión. Intente más tarde.');
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rol, estado]);

  useEffect(() => { fetchUsuarios(1); /* eslint-disable-next-line */ }, []);

  const verPerfil = (id) => setDetalleId(id);
  const hayFiltros = q.trim() || rol || estado !== 'ACTIVO';

  const limpiarFiltros = () => {
    setQ(''); setRol(''); setEstado('ACTIVO');
    fetchUsuarios(1, { q: '', rol: '', estado: 'ACTIVO' });
  };

  return (
    <AppLayout>
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-4">

          {/* Encabezado */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-[#0059B3]">Gestión de usuarios</h1>
              <p className="text-sm text-slate-500">Busca, filtra y accede al perfil del personal</p>
            </div>
            <button
              onClick={() => navigate('/admin/usuarios/nuevo')}
              className="flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                         text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
              <UserPlus size={15} /> Nuevo usuario
            </button>
          </div>

          {/* Búsqueda y filtros */}
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                <label className="text-xs font-medium text-slate-600">Buscar (DNI, nombre o apellido)</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchUsuarios(1)}
                    placeholder="Ej. 00000001 o Pérez"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40" />
                </div>
              </div>

              <div className="flex flex-col gap-1 w-40">
                <label className="text-xs font-medium text-slate-600">Rol</label>
                <select value={rol}
                  onChange={e => { setRol(e.target.value); fetchUsuarios(1, { rol: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40">
                  <option value="">Todos</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                  <option value="RECEPCIONISTA">Recepcionista</option>
                  <option value="CAJERO">Cajero</option>
                  <option value="DOCTOR">Doctor</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 w-40">
                <label className="text-xs font-medium text-slate-600">Estado</label>
                <select value={estado}
                  onChange={e => { setEstado(e.target.value); fetchUsuarios(1, { estado: e.target.value }); }}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40">
                  <option value="ACTIVO">Activos</option>
                  <option value="INACTIVO">Inactivos</option>
                  <option value="PENDIENTE">Pendientes</option>
                  <option value="TODOS">Todos</option>
                </select>
              </div>

              <button onClick={() => fetchUsuarios(1)}
                className="flex items-center gap-1.5 bg-[#0059B3] hover:bg-[#004a99]
                           text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                <Search size={14} /> Buscar
              </button>

              {hayFiltros && (
                <button onClick={limpiarFiltros}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium pb-2">
                  Limpiar filtros
                </button>
              )}
            </div>

            {estado === 'TODOS' && (
              <p className="mt-2 text-xs text-slate-400">
                Mostrando todos — activos primero, luego pendientes (ámbar) y al final inactivos (en gris).
              </p>
            )}
          </section>

          {/* Tabla / estados */}
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {error ? (
              <div className="text-center py-16">
                <AlertTriangle size={36} className="mx-auto mb-2 text-amber-400" />
                <p className="text-sm text-slate-600">{error}</p>
                <button onClick={() => fetchUsuarios(page)}
                  className="mt-3 text-[#0059B3] text-sm font-medium hover:underline">Reintentar</button>
              </div>
            ) : loading ? (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4">
                    <div className="skeleton h-4 w-24" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-44" /><div className="skeleton h-3 w-32" />
                    </div>
                    <div className="skeleton h-5 w-20 rounded-full" />
                    <div className="skeleton h-7 w-8 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : usuarios.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <UserX size={42} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-slate-500 mb-4">
                  No se encontraron usuarios con ese criterio
                </p>
                <button onClick={() => navigate('/admin/usuarios/nuevo')}
                  className="inline-flex items-center gap-2 bg-[#0059B3] hover:bg-[#004a99]
                             text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm">
                  <UserPlus size={15} /> Crear usuario nuevo
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['DNI', 'Nombre completo', 'Correo', 'Rol', 'Especialidad', 'Estado', 'Acciones'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold
                                                  text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usuarios.map(u => {
                        const inactivo  = u.estado === 'INACTIVO';
                        const pendiente = u.estado === 'PENDIENTE';
                        const esDoctor  = u.rol === 'DOCTOR';
                        return (
                          <tr key={u.usuario_id}
                            className={`transition-colors
                              ${inactivo ? 'opacity-50 hover:bg-slate-50'
                                : pendiente ? 'bg-amber-50/60 hover:bg-amber-50'
                                : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-500">{u.DNI}</td>
                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                              {u.nombre} {u.apellido}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{u.email}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{ROL_LABEL[u.rol] ?? u.rol ?? '—'}</td>
                            {/* CA4: especialidad real solo para doctores */}
                            <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                              {esDoctor ? (u.especialidad || '—') : '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap"><EstadoBadge estado={u.estado} /></td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <button title="Ver detalles" onClick={() => verPerfil(u.usuario_id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
                                <Eye size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                  <span>{total} usuario{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</span>
                  {pages > 1 && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => fetchUsuarios(page - 1)} disabled={page <= 1}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="font-medium text-slate-700">{page} / {pages}</span>
                      <button onClick={() => fetchUsuarios(page + 1)} disabled={page >= pages}
                        className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

        </div>
      </div>

      {detalleId && (
        <UsuarioModal
          id={detalleId}
          onClose={() => setDetalleId(null)}
          onChanged={() => fetchUsuarios(page)}
        />
      )}
    </AppLayout>
  );
}
