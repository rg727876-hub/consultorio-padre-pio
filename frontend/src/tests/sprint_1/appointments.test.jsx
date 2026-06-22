import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import AgendarCita from '../pages/recepcion/AgendarCita';

// Mock de la API y Hooks
vi.mock('../api/axios');
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'RECEPCIONISTA', nombre: 'Admin' }, logout: vi.fn() })
}));

describe('INT-HU012: Crear Cita - Flujo Visual', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('CP-13: Dado un recepcionista con un horario congelado. Cuando demora más de 10 minutos y el bloqueo se vence. Entonces el sistema cierra el modal y alerta: "Tiempo de reserva expirado...".', async () => {
    // Renderizamos el componente REAL de tu código
    render(
      <MemoryRouter>
        <AgendarCita />
      </MemoryRouter>
    );
    
    // Al inicio no debe haber mensaje de expiración
    expect(screen.queryByText(/Tiempo de reserva expirado/i)).not.toBeInTheDocument();
    
    // Avanzamos el tiempo 9 minutos
    act(() => {
      vi.advanceTimersByTime(9 * 60 * 1000);
    });
    expect(screen.queryByText(/Tiempo de reserva expirado/i)).not.toBeInTheDocument();

    // Avanzamos el tiempo hasta pasar los 10 minutos
    act(() => {
      vi.advanceTimersByTime(1 * 60 * 1000);
    });
    
    // Verificamos que el sistema disparó la alerta visual correctamente
    // Nota: Como este es tu componente real, si aún no tiene programado este timeout, 
    // el test fallará indicándote que falta agregar esta validación visual en AgendarCita.jsx
    expect(screen.getByText(/Tiempo de reserva expirado/i)).toBeInTheDocument();
  });
});
