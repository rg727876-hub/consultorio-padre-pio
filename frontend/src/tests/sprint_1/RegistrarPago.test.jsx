/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import RegistrarPago from '../../pages/caja/RegistrarPago';
import api from '../../api/axios';

// Mocks
vi.mock('../../api/axios');
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 2, rol: 'CAJERO', nombre: 'Admin Caja' }, logout: vi.fn() })
}));

describe('INT-HU021 & INT-HU022: Registrar Pago y Comprobantes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCita = {
    cita_id: 10,
    paciente_nombre: 'Juan Perez',
    tipo_documento: 'DNI',
    numero_documento: '71126808',
    servicio_nombre: 'Consulta General',
    doctor_nombre: 'Dr. House',
    precio_aplicado: '150.00',
    codigo_cita: 'CIT-001',
    estado: 'RESERVADA',
    fecha: '2023-10-10T00:00:00.000Z',
    hora_inicio: '10:00',
    hora_fin: '10:30'
  };

  it('CP-21A: Dado un recepcionista cobrando en efectivo. Cuando ingresa el monto recibido. Entonces el sistema calcula automáticamente el vuelto.', async () => {
    
    api.get.mockResolvedValueOnce({ data: [mockCita] }); // Search appointment

    render(
      <MemoryRouter>
        <RegistrarPago />
      </MemoryRouter>
    );

    // Buscar la cita
    const inputBuscar = screen.getByPlaceholderText('Código de cita, nombre o documento del paciente');
    fireEvent.change(inputBuscar, { target: { value: '71126808' } });
    fireEvent.click(screen.getByText('Buscar'));

    await waitFor(() => {
      expect(screen.getByText('CIT-001')).toBeInTheDocument();
    });

    // Seleccionar la cita
    fireEvent.click(screen.getByText('Juan Perez').closest('button'));

    // Seleccionar método Efectivo
    fireEvent.click(screen.getByText('Efectivo').closest('button'));

    // Ingresar monto 200 (precio es 150)
    const inputMonto = screen.getByPlaceholderText('150.00');
    fireEvent.change(inputMonto, { target: { value: '200' } });

    // Validar el vuelto de 50.00
    await waitFor(() => {
      expect(screen.getByText('Vuelto / Cambio')).toBeInTheDocument();
      expect(screen.getByText('S/ 50.00')).toBeInTheDocument();
    });
  });

  it('CP-21B: Lógica Digital - Exige número de operación para Yape', async () => {
    api.get.mockResolvedValueOnce({ data: [mockCita] }); 

    render(
      <MemoryRouter>
        <RegistrarPago />
      </MemoryRouter>
    );

    const inputBuscar = screen.getByPlaceholderText('Código de cita, nombre o documento del paciente');
    fireEvent.change(inputBuscar, { target: { value: '71126808' } });
    fireEvent.click(screen.getByText('Buscar'));

    await waitFor(() => {
      expect(screen.getByText('CIT-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Juan Perez').closest('button'));

    // Seleccionar método Yape
    fireEvent.click(screen.getByText('Yape').closest('button'));

    // Verificar que aparece el campo de número de operación
    expect(screen.getByText('Número de operación *')).toBeInTheDocument();
    const btnConfirmar = screen.getByText('Confirmar pago y emitir boleta');
    fireEvent.click(btnConfirmar);

    // Debe mostrar error de validación
    await waitFor(() => {
      expect(screen.getByText('⚠ Ingresa el número de operación')).toBeInTheDocument();
    });
  });

  it('CP-22: Dado un recepcionista emitiendo comprobante. Cuando selecciona "Factura". Entonces el sistema exige el ingreso del RUC (11 dígitos) y Razón Social.', async () => {
    api.get.mockResolvedValueOnce({ data: [mockCita] }); 

    render(
      <MemoryRouter>
        <RegistrarPago />
      </MemoryRouter>
    );

    const inputBuscar = screen.getByPlaceholderText('Código de cita, nombre o documento del paciente');
    fireEvent.change(inputBuscar, { target: { value: '71126808' } });
    fireEvent.click(screen.getByText('Buscar'));

    await waitFor(() => {
      expect(screen.getByText('CIT-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Juan Perez').closest('button'));

    // Seleccionar Efectivo
    fireEvent.click(screen.getByText('Efectivo').closest('button'));
    fireEvent.change(screen.getByPlaceholderText('150.00'), { target: { value: '150' } });

    // Cambiar a Factura
    fireEvent.click(screen.getByText('Factura').closest('button'));

    // Verificar que exige RUC y Razón social al tratar de enviar
    const btnConfirmar = screen.getByText('Confirmar pago y emitir factura');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(screen.getByText('⚠ El RUC debe tener exactamente 11 dígitos numéricos')).toBeInTheDocument();
      expect(screen.getByText('⚠ La razón social es requerida')).toBeInTheDocument();
    });
  });
});
