import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ListaUsuarios from '../../pages/admin/ListaUsuarios';
import api from '../../api/axios';

// Mockeamos el módulo axios y useAuth
vi.mock('../../api/axios');
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'ADMINISTRADOR', nombre: 'Admin' }, logout: vi.fn() })
}));

describe('INT-HU004: Listado de personal - Renderizado', () => {
  it('CP-25: Dado una tabla con usuarios. Cuando el sistema renderiza la columna de "Especialidad". Entonces muestra el dato real para Doctor y un guion ("—") para el resto.', async () => {
    // Simulamos la respuesta de la base de datos con un Doctor y un Recepcionista
    api.get.mockResolvedValueOnce({
      data: {
        data: [
          { usuario_id: 1, DNI: '123', nombre: 'Dr.', apellido: 'House', email: 'a@a.com', rol: 'DOCTOR', estado: 'ACTIVO', especialidad: 'Cardiología' },
          { usuario_id: 2, DNI: '456', nombre: 'Ana', apellido: 'G.', email: 'b@b.com', rol: 'RECEPCIONISTA', estado: 'ACTIVO', especialidad: null }
        ],
        total: 2,
        pages: 1
      }
    });

    // Renderizamos el componente de la página real
    // Mockeando también el AuthContext para que AppLayout no falle al destruturar `user`
    render(
      <MemoryRouter>
        <ListaUsuarios />
      </MemoryRouter>
    );

    // Esperamos a que la tabla renderice los datos de la API simulada
    await waitFor(() => {
      expect(screen.getByText('Dr. House')).toBeInTheDocument();
      expect(screen.getByText('Ana G.')).toBeInTheDocument();
    });

    // Buscamos que se haya renderizado la especialidad real (Cardiología)
    expect(screen.getByText('Cardiología')).toBeInTheDocument();
    
    // Buscamos el guion para el que no tiene especialidad (Recepcionista)
    // NOTA: Si el componente no tiene la columna Especialidad implementada, el test fallará
    // cumpliendo su objetivo de validar los requerimientos de la historia de usuario.
    const guiones = screen.getAllByText('—');
    expect(guiones.length).toBeGreaterThan(0);
  });
});
