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

  it('CP-21A: Dado un cajero procesando un cobro mediante el método TARJETA_PRESENCIAL. Cuando el paciente paga en el POS físico de la clínica y el cajero ingresa al sistema el número de operación impreso en el voucher generado. Entonces el sistema valida los datos, confirma la cita, registra el pago como COMPLETADO en la base de datos y muestra el mensaje "Transacción exitosa".', async () => {
    
    api.get.mockResolvedValueOnce({ data: [mockCita] }); // Search appointment
    api.post.mockResolvedValueOnce({ 
      data: { pago_id: 55, codigo_cita: 'CIT-001' } 
    }); // Mock para el pago
    api.post.mockResolvedValueOnce({ 
      data: { comprobante_id: 100, serie: 'B001', numero: '000123', tipo_comprobante: 'BOLETA' } 
    }); // Mock para el comprobante

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

    // Seleccionar método Tarjeta
    fireEvent.click(screen.getByText('Tarjeta').closest('button'));

    // Ingresar número de operación, últimos 4 dígitos y marca
    const inputOperacion = screen.getByPlaceholderText('Ej. 12345678');
    fireEvent.change(inputOperacion, { target: { value: '123456' } });

    const inputUltimos4 = screen.getByPlaceholderText('1234');
    fireEvent.change(inputUltimos4, { target: { value: '9876' } });

    const selectMarca = screen.getByRole('combobox');
    fireEvent.change(selectMarca, { target: { value: 'VISA' } });

    // Confirmar pago
    const btnConfirmar = screen.getByText('Confirmar pago y emitir boleta');
    fireEvent.click(btnConfirmar);

    // Validar mensaje de éxito
    await waitFor(() => {
      expect(screen.getByText('¡Pago registrado!')).toBeInTheDocument();
    });
  });

  /*
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
  */
});
