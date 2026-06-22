import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GestionUsuarios from '../../pages/admin/GestionUsuarios';
import api from '../../api/axios';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../../api/axios');
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'ADMINISTRADOR', nombre: 'Admin' }, logout: vi.fn() })
}));

describe('INT-HU024: Filtros UI y Ordenamiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CP-24: Dado un administrador en la lista de usuarios. Cuando el sistema carga la tabla y el filtro está en "Todos los estados". Entonces el sistema ordena jerárquicamente a los usuarios: primero "ACTIVOS", luego "PENDIENTES" y al final "INACTIVOS".', async () => {
    
    // Devolvemos usuarios desordenados
    const mockUsers = [
      { usuario_id: 1, DNI: '11111111', nombre: 'Carlos', apellido: 'A', estado: 'INACTIVO', nombre_rol: 'RECEPCIONISTA' },
      { usuario_id: 2, DNI: '22222222', nombre: 'Ana', apellido: 'B', estado: 'PENDIENTE', nombre_rol: 'RECEPCIONISTA' },
      { usuario_id: 3, DNI: '33333333', nombre: 'Zoe', apellido: 'C', estado: 'ACTIVO', nombre_rol: 'CAJERO' },
      { usuario_id: 4, DNI: '44444444', nombre: 'Bruno', apellido: 'D', estado: 'ACTIVO', nombre_rol: 'CAJERO' },
    ];
    
    api.get.mockResolvedValueOnce({ data: mockUsers });

    render(
      <BrowserRouter>
        <GestionUsuarios />
      </BrowserRouter>
    );

    // Esperar a que la tabla se renderice
    await waitFor(() => {
      expect(screen.queryByText('Cargando personal...')).not.toBeInTheDocument();
    });

    // Encontrar todas las filas (tr) dentro de tbody
    const rows = screen.getAllByRole('row');
    // El primer row es el thead, por lo que las filas de datos empiezan en el índice 1
    const dataRows = rows.slice(1);
    
    expect(dataRows.length).toBe(4);

    // El orden esperado es ACTIVO, ACTIVO, PENDIENTE, INACTIVO
    // Y dentro del mismo estado (ACTIVO), deben estar por orden alfabético de apellido: 'C' (Zoe) y 'D' (Bruno)
    // Entonces:
    // 1. Zoe C (ACTIVO)
    // 2. Bruno D (ACTIVO)
    // 3. Ana B (PENDIENTE)
    // 4. Carlos A (INACTIVO)
    
    expect(dataRows[0]).toHaveTextContent('Zoe C');
    expect(dataRows[1]).toHaveTextContent('Bruno D');
    expect(dataRows[2]).toHaveTextContent('Ana B');
    expect(dataRows[3]).toHaveTextContent('Carlos A');
  });
});
