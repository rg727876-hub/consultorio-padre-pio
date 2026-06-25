/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import GestionCitas from '../../pages/recepcion/GestionCitas';
import api from '../../api/axios';

// Mocks
vi.mock('../../api/axios');
vi.mock('react-hot-toast', () => ({
  default: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'RECEPCIONISTA', nombre: 'Admin' }, logout: vi.fn() })
}));

describe('INT-HU013: Listar y buscar citas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CP-15: Dado un recepcionista revisando la agenda del día. Cuando carga la pantalla principal. Entonces el sistema lista máximo 20 citas diferenciadas visualmente por colores según su estado.', async () => {
    // Simulamos la respuesta de la API con diferentes estados
    const mockCitas = [
      { cita_id: 1, codigo_cita: 'CIT-001', estado: 'CONFIRMADA', fecha: '2023-10-10', hora_inicio: '10:00', hora_fin: '10:30', paciente_nombre: 'Juan Perez', doctor_nombre: 'Dr. House', servicio_nombre: 'Consulta General' },
      { cita_id: 2, codigo_cita: 'CIT-002', estado: 'RESERVADA', fecha: '2023-10-10', hora_inicio: '11:00', hora_fin: '11:30', paciente_nombre: 'Ana Gomez', doctor_nombre: 'Dra. Grey', servicio_nombre: 'Cardiologia' },
      { cita_id: 3, codigo_cita: 'CIT-003', estado: 'CANCELADA', fecha: '2023-10-10', hora_inicio: '12:00', hora_fin: '12:30', paciente_nombre: 'Luis Suarez', doctor_nombre: 'Dr. Strange', servicio_nombre: 'Neurologia' }
    ];

    api.get.mockImplementation((url) => {
      if (url === '/doctors') return Promise.resolve({ data: [] });
      if (url === '/appointments') return Promise.resolve({ data: { data: mockCitas, total: 3, total_global: 3, pages: 1 } });
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <GestionCitas />
      </MemoryRouter>
    );

    // Esperar a que rendericen las citas
    await waitFor(() => {
      expect(screen.getByText('CIT-001')).toBeInTheDocument();
    });

    // Validar visualización (colores de las etiquetas)
    // Confirmada (green)
    const rowConfirmada = screen.getByText('CIT-001').closest('tr');
    const confirmadaSpan = waitFor(() => rowConfirmada.querySelector('span'));
    expect(rowConfirmada.innerHTML).toContain('text-green-700');
    expect(rowConfirmada.innerHTML).toContain('bg-green-100');

    // Reservada (amber)
    const rowReservada = screen.getByText('CIT-002').closest('tr');
    expect(rowReservada.innerHTML).toContain('text-amber-700');
    expect(rowReservada.innerHTML).toContain('bg-amber-100');

    // Cancelada (red)
    const rowCancelada = screen.getByText('CIT-003').closest('tr');
    expect(rowCancelada.innerHTML).toContain('text-red-700');
    expect(rowCancelada.innerHTML).toContain('bg-red-100');
  });

  it('CP-16: Dado un recepcionista filtrando citas. Cuando ocurre una caída de red o error de conexión. Entonces el sistema bloquea el despliegue de información incompleta y alerta: "Error de conexión. Intente más tarde."', async () => {
    
    api.get.mockImplementation((url) => {
      if (url === '/doctors') return Promise.resolve({ data: [] });
      if (url === '/appointments') return Promise.reject(new Error('Network Error'));
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <GestionCitas />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Debe mostrar el error en pantalla en vez de información incompleta
      expect(screen.getByText('Error de conexión. Intente más tarde.')).toBeInTheDocument();
    });
  });
});
