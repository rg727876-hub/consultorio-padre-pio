/**
 * HU: INT-HU021: Registrar pagos de citas
 * Archivo de pruebas para la gestión financiera de citas.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('INT-HU021: Registrar pagos de citas', () => {
  let mockConnection;
  const recepcionistaToken = 'Bearer validtoken';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValue(mockConnection);
    pool.query.mockImplementation(mockConnection.query);
    pool.execute = mockConnection.execute;

    // Mockear JWT para simular cajero autenticado
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 3, rol: 'CAJERO' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CP-21A y CP-21B: Lógica Digital/Efectivo', () => {
    it('CP-21A: Dado un cajero confirmando un cobro. Cuando selecciona Tarjeta/Yape/Plin (exigiendo voucher) o Efectivo (calculando vuelto). Entonces el sistema valida los datos, confirma la cita, registra el cuadre y muestra "Transacción exitosa"', async () => {
      
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      // 1. SELECT cita FOR UPDATE
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 10, estado: 'RESERVADA', precio_aplicado: 150 }]]);
      // 2. SELECT pago existente (para asegurar que no hay duplicados) -> null
      mockConnection.query.mockResolvedValueOnce([[]]);
      // 3. INSERT PAGO
      mockConnection.query.mockResolvedValueOnce([{ insertId: 55 }]);
      // 4. UPDATE CITA
      mockConnection.query.mockResolvedValueOnce([]);
      // 5. COMMIT
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', recepcionistaToken)
        .send({
          cita_id: 10,
          metodo_pago: 'TARJETA_PRESENCIAL',
          monto_total: 150
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Pago registrado');
      
      const llamadas = mockConnection.query.mock.calls;
      const updateCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE CITA SET estado = \'CONFIRMADA\''));
      expect(updateCall).toBeDefined();
    });

    it('CP-21B: Dado un cajero confirmando un cobro. Cuando el cliente paga al QR, el cajero verifica el pago visualmente en su celular e ingresa en el sistema el número de operación generado por la app. Entonces el sistema valida los datos, confirma la cita, registra el pago como COMPLETADO y muestra "Transacción exitosa".', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 11, estado: 'RESERVADA', precio_aplicado: 200 }]]);
      mockConnection.query.mockResolvedValueOnce([[]]);
      mockConnection.query.mockResolvedValueOnce([{ insertId: 56 }]);
      mockConnection.query.mockResolvedValueOnce([]);
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', recepcionistaToken)
        .send({
          cita_id: 11,
          metodo_pago: 'YAPE',
          monto_total: 200,
          numero_operacion: '12345678'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Pago registrado');
    });
  });

  describe('CP-20: Antifraude (Rechazar pago doble)', () => {
    it('CP-20: Dado un cajero procesando cobros. Cuando busca e intenta cobrar una reserva que ya tiene un pago completado. Entonces el sistema bloquea estrictamente la operación mostrando: "La cita seleccionada ya fue cancelada previamente."', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      // SELECT cita
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 10, estado: 'RESERVADA', precio_aplicado: 150 }]]);
      // SELECT pago existente -> Devuelve 1
      mockConnection.query.mockResolvedValueOnce([[{ pago_id: 1 }]]);
      // ROLLBACK
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', recepcionistaToken)
        .send({
          cita_id: 10,
          metodo_pago: 'EFECTIVO',
          monto_total: 150
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('La cita seleccionada ya fue cancelada previamente.');
    });
  });

});
