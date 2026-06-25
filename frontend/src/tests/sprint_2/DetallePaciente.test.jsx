import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DetallePaciente from '../../pages/recepcion/DetallePaciente';
import api from '../../api/axios';
import { vi } from 'vitest';
import React from 'react';

vi.mock('../../api/axios');

describe('INT-HU011: Gestión de pacientes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CP-34: Dado un usuario con el rol de "Recepcionista". Cuando abre el perfil de un paciente y navega por sus pestañas. Entonces el sistema le bloquea el acceso a la información clinica, limitando su vista solo a datos personales e historial de citas', async () => {
    
    const mockPaciente = {
      paciente_id: 1,
      nombre: 'Ana',
      apellido: 'Gomez',
      tipo_documento: 'DNI',
      numero_documento: '12345678',
      email: 'ana@example.com',
      telefono: '999999999',
      estado: 'ACTIVO',
      citas: [
        { cita_id: 1, doctor_nombre: 'Dr. House', fecha: '2023-10-10', hora_inicio: '10:00', estado: 'CONFIRMADA' }
      ]
    };

    api.get.mockResolvedValueOnce({ data: mockPaciente });

    render(
      <MemoryRouter initialEntries={['/recepcion/pacientes/1']}>
        <Routes>
          <Route path="/recepcion/pacientes/:id" element={<DetallePaciente />} />
        </Routes>
      </MemoryRouter>
    );

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(screen.getByText('12345678')).toBeInTheDocument();
    });

    // Validar que se muestran los datos personales
    expect(screen.getByText('12345678')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();

    // Validar que NO existen pestañas de historial clínico o diagnósticos
    expect(screen.queryByText(/Diagnóstico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Historial Clínico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tratamiento/i)).not.toBeInTheDocument();

    // Validar que la pestaña que existe es "Historial de Citas" (o simplemente "Citas")
    expect(screen.getByRole('button', { name: /Citas/i })).toBeInTheDocument();
  });
});
