import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import RegistrarAtencion from '../../pages/doctor/RegistrarAtencion';
import api from '../../api/axios';
import { vi } from 'vitest';
import React from 'react';

vi.mock('../../api/axios');
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'DOCTOR', nombre: 'Doctor' }, logout: vi.fn() })
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}));

describe('INT-HU018: Atención Médica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CP-42: Dado un doctor en el formulario de Registro de Atención. Cuando intenta guardar la sesión dejando absolutamente todos los campos clínicos opcionales en blanco. Entonces el sistema impide cerrar la atención y muestra la alerta visual: "Registre al menos un campo de la atención antes de guardar."', async () => {
    
    // Mock the initial fetch
    api.get.mockResolvedValueOnce({
      data: {
        cita: {
          cita_id: 10,
          paciente_nombre: 'Ana',
          paciente_apellido: 'Gomez',
          codigo_cita: 'CIT-001',
          estado: 'CONFIRMADA'
        },
        consulta: null // Nueva consulta, campos vacíos
      }
    });

    render(
      <MemoryRouter initialEntries={['/doctor/atencion/10']}>
        <Routes>
          <Route path="/doctor/atencion/:citaId" element={<RegistrarAtencion />} />
        </Routes>
      </MemoryRouter>
    );

    // Esperar a que cargue la información de la cita
    await waitFor(() => {
      expect(screen.getByText('Ana Gomez')).toBeInTheDocument();
    });

    // Intentar guardar inmediatamente sin llenar campos
    const btnGuardar = screen.getByRole('button', { name: /Guardar atención/i });
    fireEvent.click(btnGuardar);

    // Validar que se muestran las advertencias
    await waitFor(() => {
      // Debe haber un texto de error general específico para campos en blanco
      expect(screen.getByText(/Registre al menos un campo de la atención antes de guardar./i)).toBeInTheDocument();
    });

    // Validar que el API no fue llamado para hacer el POST
    expect(api.post).not.toHaveBeenCalled();
  });
});
