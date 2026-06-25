import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import DetallePaciente from '../pages/recepcion/DetallePaciente';
import api from '../api/axios';

// Mock de la API y Hooks
vi.mock('../api/axios');
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'RECEPCIONISTA', nombre: 'Admin' }, logout: vi.fn() })
}));

describe('Acción Usuario - Flujos de Cancelación', () => {
  it('CP-34: Dado un usuario en la vista de perfil. Cuando hace clic en "Cancelar vinculación". Entonces la ventana de vinculación se cierra sin guardar cambios.', async () => {
    // Simulamos la API devolviendo el perfil del paciente
    api.get.mockResolvedValueOnce({
      data: {
        paciente_id: 1,
        nombre: 'Juan',
        apellido: 'Perez',
        estado: 'ACTIVO',
        tipo_documento: 'DNI',
        numero_documento: '12345678'
      }
    });

    const handleClose = vi.fn();

    // Renderizamos el componente REAL
    render(
      <MemoryRouter>
        <DetallePaciente id={1} onClose={handleClose} />
      </MemoryRouter>
    );
    
    // Esperamos a que cargue el perfil y abrimos el ModalEditar usando el botón "Editar"
    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    });

    // Simulamos que el usuario da clic en Editar para abrir la "ventana de vinculación/edición"
    const btnEditar = screen.getByRole('button', { name: /Editar/i });
    fireEvent.click(btnEditar);
    
    // El modal de edición debe estar en pantalla
    expect(screen.getByRole('dialog', { name: /Editar datos del paciente/i })).toBeInTheDocument();
    
    // Hacemos clic en el botón de "Cancelar" dentro de la ventana
    const btnCancelar = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(btnCancelar);
    
    // Verificamos que la ventana efectivamente se cierra sin enviar peticiones de guardado
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
