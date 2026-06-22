import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, Plus, Eye, UserX, UserCheck, Clock, Loader2,
  ChevronLeft, ChevronRight, AlertCircle, FileX
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppLayout from '../../components/AppLayout';

export default function GestionUsuarios() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para filtros y búsqueda
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  // Mostrar por defecto todos los estados para no ocultar usuarios
  const [statusFilter, setStatusFilter] = useState('TODOS');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        // Traer TODOS los usuarios
        const { data } = await api.get('/users', { params: { estado: 'TODOS' } });
        // Filtrar en el cliente: excluir doctores
        const personal = (data.data ?? []).filter(u => u.rol !== 'DOCTOR');
        setUsers(personal);
      } catch (err) {
        console.error('fetchUsers error', err);
        toast.error('Error al cargar la lista de usuarios');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Filtrado y Ordenamiento
  const filteredAndSortedUsers = useMemo(() => {
    // 1. Filtrado
    let result = users.filter((u) => {
      // CA5: Búsqueda ágil (DNI, nombre, apellido)
      const term = search.toLowerCase();
      const matchesSearch = 
        u.DNI?.includes(term) ||
        u.nombre?.toLowerCase().includes(term) ||
        u.apellido?.toLowerCase().includes(term);
      
      // Filtro de Rol
      const matchesRole = roleFilter === 'TODOS' || u.rol === roleFilter;
      
      // Filtro de Estado
      const matchesStatus = statusFilter === 'TODOS' || u.estado === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });

    // 2. Ordenamiento
    result.sort((a, b) => {
      // CA7: Si filtro es "Todos", orden jerárquico por estado
      if (statusFilter === 'TODOS') {
        const orderStatus = { 'ACTIVO': 1, 'PENDIENTE': 2, 'INACTIVO': 3 };
        const statusDiff = orderStatus[a.estado] - orderStatus[b.estado];
        if (statusDiff !== 0) return statusDiff;
      }
      
      // Orden alfabético por apellido (CA2)
      return (a.apellido || '').localeCompare(b.apellido || '');
    });

    return result;
  }, [users, search, roleFilter, statusFilter]);

  // Paginación
  const totalItems = filteredAndSortedUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'ACTIVO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <UserCheck size={14} /> Activo
          </span>
        );
      case 'PENDIENTE':
        // CA7: Pendientes resaltados con un indicador visual distintivo
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300">
            <Clock size={14} /> Pendiente
          </span>
        );
      case 'INACTIVO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
            <UserX size={14} /> Inactivo
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
            {estado}
          </span>
        );
    }
  };

  const getRowClass = (estado) => {
    // CA7: Inactivos con diseño opaco
    if (estado === 'INACTIVO') return 'opacity-60 bg-slate-50';
    if (estado === 'PENDIENTE') return 'bg-amber-50/30';
    return 'hover:bg-blue-50/30';
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
        
        {/* Encabezado */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Gestion de Personal
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Control centralizado de los usuarios y roles del sistema.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => navigate('/admin/usuarios/nuevo')}
              className="flex items-center gap-2 bg-[#0059B3] hover:bg-[#004494] text-white px-5 py-2.5 rounded-full font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
            >
              <Plus size={18} /> Registrar usuario
            </button>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por DNI, nombres o apellidos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0059B3]/40 appearance-none text-slate-700"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="INACTIVO">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Tabla principal */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">DNI</th>
                  <th className="px-6 py-4">Nombre Completo</th>
                  <th className="px-6 py-4">Correo</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[#0059B3]" />
                      Cargando personal...
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  // Si no hay coincidencias, mostrar mensaje y botón
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <FileX size={48} className="text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-800 mb-1">
                          No se encontraron usuarios con ese criterio
                        </h3>
                        <p className="text-slate-500 mb-6 text-sm">
                          Intenta ajustar los filtros de búsqueda o registra un nuevo usuario.
                        </p>
                        <button
                          onClick={() => navigate('/admin/usuarios/nuevo')}
                          className="flex items-center gap-2 bg-[#0059B3] hover:bg-[#004494] text-white px-5 py-2.5 rounded-full font-medium transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 text-sm"
                        >
                          <Plus size={16} /> Registrar usuario
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => (
                    <tr key={u.usuario_id} className={`transition-colors ${getRowClass(u.estado)}`}>
                      <td className="px-6 py-4 font-medium text-slate-700">{u.DNI}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {u.nombre} {u.apellido}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                          {u.rol || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(u.estado)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {/* Ver detalles (ícono de ojo) */}
                        <button
                          onClick={() => navigate(`/admin/usuarios/${u.usuario_id}`)}
                          className="p-1.5 text-slate-400 hover:text-[#0059B3] hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                          title="Ver detalles"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Paginación */}
          {!loading && paginatedUsers.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Mostrando <span className="font-medium text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-slate-800">{Math.min(currentPage * itemsPerPage, totalItems)}</span> de <span className="font-medium text-slate-800">{totalItems}</span> usuarios
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center px-3 text-sm font-medium text-slate-700">
                  Página {currentPage} de {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
