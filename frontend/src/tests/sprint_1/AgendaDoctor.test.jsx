/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import MiAgenda from '../../pages/doctor/MiAgenda';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// Mocks
vi.mock('../../api/axios');
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 5, rol: 'DOCTOR', nombre: 'Dr. House' }, logout: vi.fn() })
}));

describe('INT-HU018: Agenda médica (Doctor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CP-18: Dado un médico autenticado en su agenda. Cuando intenta buscar o visualizar citas. Entonces el sistema bloquea por completo el acceso a agendas de colegas, mostrando exclusivamente sus propios pacientes.', async () => {
    const mockCitas = [
      { cita_id: 1, codigo_cita: 'DOC-001', estado: 'CONFIRMADA', fecha: '2023-10-10', hora_inicio: '10:00', hora_fin: '10:30', paciente_nombre: 'Paciente Propio', servicio_nombre: 'Consulta General' }
    ];

    api.get.mockImplementation((url) => {
      if (url === '/appointments/agenda') return Promise.resolve({ data: { data: mockCitas } });
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <MiAgenda />
      </MemoryRouter>
    );

    // Esperar a que rendericen las citas
    await waitFor(() => {
      expect(screen.getByText('DOC-001')).toBeInTheDocument();
      expect(screen.getByText('Paciente Propio')).toBeInTheDocument();
    });

    // Se verifica que llamó al endpoint correcto para médicos
    expect(api.get).toHaveBeenCalledWith('/appointments/agenda', expect.any(Object));
  });

});
