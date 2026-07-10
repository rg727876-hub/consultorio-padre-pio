import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider }       from '../context/AuthContext';
import PrivateRoute           from './PrivateRoute';
import ErrorBoundary          from '../components/ErrorBoundary';
import StaffLoginPage         from '../pages/auth/StaffLoginPage';
import ActivateAccountPage    from '../pages/auth/ActivateAccountPage';
import DashboardPage          from '../pages/DashboardPage';
import RegistroUsuario        from '../pages/admin/RegistroUsuario';
import GestionDoctores        from '../pages/admin/GestionDoctores';
import ListaUsuarios          from '../pages/admin/ListaUsuarios';
import PerfilUsuario          from '../pages/admin/PerfilUsuario';
import PerfilMedico           from '../pages/admin/PerfilMedico';
import RegistroServicio       from '../pages/admin/RegistroServicio';
import GestionarServicios     from '../pages/admin/GestionarServicios';
import HorariosDoctor         from '../pages/admin/HorariosDoctor';
import RegistrarPaciente      from '../pages/recepcion/RegistrarPaciente';
import ListaPacientes         from '../pages/recepcion/ListaPacientes';
import AgendarCita            from '../pages/recepcion/AgendarCita';
import GestionCitas           from '../pages/recepcion/GestionCitas';
import DetalleCita            from '../pages/recepcion/DetalleCita';
import AgendaMedica           from '../pages/agenda/AgendaMedica';
import MiAgenda               from '../pages/doctor/MiAgenda';
import RegistrarAtencion      from '../pages/doctor/RegistrarAtencion';
import HistorialClinico       from '../pages/doctor/HistorialClinico';
import HistorialPaciente      from '../pages/doctor/HistorialPaciente';
import RegistrarPago          from '../pages/caja/RegistrarPago';
import ListaPagos             from '../pages/caja/ListaPagos';
import GenerarComprobante     from '../pages/caja/GenerarComprobante';
import DashboardReportes      from '../pages/admin/reportes/DashboardReportes';
import ReportesAuthGuard      from '../pages/admin/reportes/ReportesAuthGuard';

// Wrapper inside BrowserRouter so we can use useLocation to reset ErrorBoundary on navigation
function RouterContent() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Routes>
        {/* ── Públicas ── */}
        <Route path="/login"              element={<StaffLoginPage />} />
        <Route path="/activate/:token"    element={<ActivateAccountPage />} />

        {/* ── Protegidas (cualquier staff autenticado) ── */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        } />

        {/* ── Solo Administrador ── */}
        <Route path="/admin/usuarios" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <ListaUsuarios />
          </PrivateRoute>
        } />

        <Route path="/admin/usuarios/nuevo" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <RegistroUsuario />
          </PrivateRoute>
        } />

        <Route path="/admin/usuarios" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <ListaUsuarios />
          </PrivateRoute>
        } />

        <Route path="/admin/doctores" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <GestionDoctores />
          </PrivateRoute>
        } />

        <Route path="/admin/usuarios/:id" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <PerfilUsuario />
          </PrivateRoute>
        } />

        <Route path="/admin/medicos/:id" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <PerfilMedico />
          </PrivateRoute>
        } />

        <Route path="/admin/servicios/nuevo" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <RegistroServicio />
          </PrivateRoute>
        } />

        <Route path="/admin/servicios" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <GestionarServicios />
          </PrivateRoute>
        } />

        <Route path="/admin/horarios" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <HorariosDoctor />
          </PrivateRoute>
        } />

        <Route path="/admin/reportes" element={
          <PrivateRoute roles={['ADMINISTRADOR']}>
            <ReportesAuthGuard>
              <DashboardReportes />
            </ReportesAuthGuard>
          </PrivateRoute>
        } />

        {/* ── Recepcionista y Administrador ── */}
        <Route path="/recepcion/pacientes" element={
          <PrivateRoute roles={['RECEPCIONISTA', 'ADMINISTRADOR']}>
            <ListaPacientes />
          </PrivateRoute>
        } />

        <Route path="/recepcion/pacientes/nuevo" element={
          <PrivateRoute roles={['RECEPCIONISTA', 'ADMINISTRADOR']}>
            <RegistrarPaciente />
          </PrivateRoute>
        } />

        <Route path="/recepcion/citas/nueva" element={
          <PrivateRoute roles={['RECEPCIONISTA', 'ADMINISTRADOR']}>
            <AgendarCita />
          </PrivateRoute>
        } />

        <Route path="/recepcion/citas" element={
          <PrivateRoute roles={['RECEPCIONISTA', 'ADMINISTRADOR']}>
            <GestionCitas />
          </PrivateRoute>
        } />

        <Route path="/recepcion/citas/:id" element={
          <PrivateRoute roles={['RECEPCIONISTA', 'ADMINISTRADOR']}>
            <DetalleCita />
          </PrivateRoute>
        } />

        <Route path="/recepcion/agenda" element={
          <PrivateRoute roles={['RECEPCIONISTA', 'ADMINISTRADOR']}>
            <AgendaMedica />
          </PrivateRoute>
        } />

        {/* ── Doctor ── */}
        <Route path="/doctor/agenda" element={
          <PrivateRoute roles={['DOCTOR']}>
            <MiAgenda />
          </PrivateRoute>
        } />

        <Route path="/doctor/atencion/:citaId" element={
          <PrivateRoute roles={['DOCTOR']}>
            <RegistrarAtencion />
          </PrivateRoute>
        } />

        <Route path="/doctor/historial" element={
          <PrivateRoute roles={['DOCTOR']}>
            <HistorialClinico />
          </PrivateRoute>
        } />

        <Route path="/doctor/historial/:pacienteId" element={
          <PrivateRoute roles={['DOCTOR']}>
            <HistorialPaciente />
          </PrivateRoute>
        } />

        {/* ── Cajero y Administrador ── */}
        <Route path="/caja/pagos/nuevo" element={
          <PrivateRoute roles={['CAJERO']}>
            <RegistrarPago />
          </PrivateRoute>
        } />

        <Route path="/caja/pagos" element={
          <PrivateRoute roles={['CAJERO', 'ADMINISTRADOR']}>
            <ListaPagos />
          </PrivateRoute>
        } />

        <Route path="/caja/comprobantes/nuevo" element={
          <PrivateRoute roles={['CAJERO', 'ADMINISTRADOR']}>
            <GenerarComprobante />
          </PrivateRoute>
        } />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouterContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
