import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import AgendarCita from '../../pages/recepcion/AgendarCita';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// Mock de la API y Hooks
vi.mock('../../api/axios');
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, rol: 'RECEPCIONISTA', nombre: 'Admin' }, logout: vi.fn() })
}));
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() }
}));

describe('INT-HU012: Crear Cita - Flujo Visual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CP-13: Dado un recepcionista con un horario congelado en el paso de confirmación. Cuando demora más de 10 minutos, el bloqueo temporal se vence e intenta confirmar. Entonces el sistema aborta la confirmación, libera el horario, alerta exactamente "Tiempo de reserva expirado, seleccione otro horario." y regresa a la vista del calendario.', async () => {
    
    // 1. Activar relojes virtuales al inicio del test
    vi.useFakeTimers();

    // 2. Configuramos las respuestas de la API
    api.get.mockImplementation(async (url) => {
      if (url === '/services') return { data: [{ servicio_id: 1, nombre: 'Consulta', costo: 50, duracion: 30 }] };
      if (url === '/patients/search') return { data: [{ paciente_id: 1, nombre: 'Juan', apellido: 'Perez', tipo_documento: 'DNI', numero_documento: '123' }] };
      if (url.includes('/doctors')) return { data: [{ doctor_id: 1, nombre: 'Ana', apellido: 'Gomez' }] };
      if (url.includes('/schedules')) return { data: [{ dia_semana: 'LUNES', estado: 'ACTIVO' }] };
      if (url.includes('/appointments/slots')) return { data: { slots: [{ hora_inicio: '10:00', hora_fin: '10:30' }] } };
      return { data: [] };
    });

    // Utilizamos await act para resolver todas las promesas en la cola sin usar findByText (que usa setTimeout y falla con FakeTimers)
    await act(async () => {
      render(
        <MemoryRouter>
          <AgendarCita />
        </MemoryRouter>
      );
    });

    // Paso 1: Buscar y seleccionar paciente
    await act(async () => {
      const inputBusqueda = screen.getByPlaceholderText(/Buscar por nombre o número de documento/i);
      fireEvent.change(inputBusqueda, { target: { value: 'Juan' } });
      fireEvent.keyDown(inputBusqueda, { key: 'Enter', code: 'Enter' });
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Juan Perez/i));
    });

    // Paso 2: Seleccionar servicio
    await act(async () => {
      const selectServicio = screen.getAllByRole('combobox')[0];
      fireEvent.change(selectServicio, { target: { value: '1' } });
    });

    // Paso 3: Seleccionar doctor
    await act(async () => {
      const selectDoctor = screen.getAllByRole('combobox')[1];
      fireEvent.change(selectDoctor, { target: { value: '1' } });
    });

    // Paso 4: Seleccionar Fecha
    await act(async () => {
      const dateInput = document.querySelector('input[type="date"]');
      fireEvent.change(dateInput, { target: { value: '2026-12-01' } });
    });

    // Simula la interacción del usuario que 'congela' el horario
    await act(async () => {
      fireEvent.click(screen.getByText('10:00')); // <--- Inicia el temporizador interno
    });

    // Verificar que estamos en la confirmación
    expect(screen.getByText(/Reservar cita/i)).toBeInTheDocument();

    // Envuelve el avance del tiempo dentro de un act
    act(() => { 
      vi.advanceTimersByTime(10 * 60 * 1000); 
    });

    // Busca la alerta exacta requerida por la regla de negocio
    expect(toast.error).toHaveBeenCalledWith('Tiempo de reserva expirado, seleccione otro horario.');
    
    // Verifica que se aborta y regresa a la vista del calendario (desaparece "Reservar cita")
    expect(screen.queryByText(/Reservar cita/i)).not.toBeInTheDocument();

    // Limpieza de timers pendientes
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
});
