import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ModalCancelarCita from '../components/appointments/ModalCancelarCita';

describe('INT-HU015: Cancelar Cita - Modal de Advertencia', () => {
  it('CP-36: Dado un recepcionista en la ventana emergente de cancelación. Cuando selecciona "Volver" ante la pregunta Estás seguro de cancelar esta cita?" Entonces el sistema cierra la advertencia inmediatamente sin aplicar ningún cambio a la agenda.', async () => {
    // Espiamos la función onClose que simula el cierre
    const handleClose = vi.fn();
    
    // Renderizamos el modal real dentro del Router
    render(
      <MemoryRouter>
        <ModalCancelarCita 
          open={true} 
          onClose={handleClose} 
          citaId={123} 
          codigoCita="XYZ123" 
        />
      </MemoryRouter>
    );
    
    // Verificamos que el modal se renderizó correctamente mostrando la advertencia
    expect(screen.getByText('¿Estás seguro de cancelar esta cita?')).toBeInTheDocument();
    
    // Simulamos el clic del usuario en el botón "Volver"
    const btnVolver = screen.getByRole('button', { name: /Volver/i });
    fireEvent.click(btnVolver);
    
    // Verificamos que la función para cerrar el modal se ejecutó
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
