/**
 * HU: WEB-HU003: Agendamiento de Citas
 * HU: WEB-HU004: Gestión de Mis Citas
 */
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Portal del Paciente - Citas (WEB-HU003, WEB-HU004)', () => {
  let mockConnection;
  const patientToken = 'Bearer patienttoken';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    };
    pool.getConnection.mockResolvedValue(mockConnection);
    pool.query.mockImplementation(mockConnection.query);

    jest.spyOn(jwt, 'verify').mockImplementation((token) => {
      return { id: 10, rol: 'PACIENTE' };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('WEB-HU003: Agendamiento de Citas', () => {
    it('Validación - Servicio sin doctores', async () => {
      // Servicio clínico que no tiene doctores activos
      mockConnection.query.mockResolvedValueOnce([[]]); 

      const response = await request(app)
        .get('/api/portal/appointments/doctors?servicio_id=999')
        .set('Authorization', patientToken);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No hay doctores disponibles');
    });

    it('Camino Feliz - Pago aprobado crea cita', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      mockConnection.query.mockResolvedValueOnce([[]]); // Verifica cruce
      mockConnection.query.mockResolvedValueOnce([{ insertId: 50 }]); // INSERT CITA
      mockConnection.query.mockResolvedValueOnce([{ insertId: 100 }]); // INSERT PAGO
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]); // COMMIT

      const response = await request(app)
        .post('/api/portal/appointments')
        .set('Authorization', patientToken)
        .send({
          doctor_id: 2,
          servicio_id: 3,
          fecha: '2026-10-10',
          hora_inicio: '10:00',
          hora_fin: '10:30',
          pago: {
            metodo: 'TARJETA_ONLINE',
            monto: 150.00,
            transaction_id: 'MP-123456' // Simulación Mercado Pago
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('confirmada');
      expect(response.body.codigo_cita).toBeDefined();
    });

    it('Integración - Pago rechazado', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      // Simula fallo en el guardado del pago o rechazo
      mockConnection.query.mockRejectedValueOnce(new Error('Pago rechazado por pasarela'));
      mockConnection.query.mockResolvedValueOnce([]); // ROLLBACK

      const response = await request(app)
        .post('/api/portal/appointments')
        .set('Authorization', patientToken)
        .send({
          doctor_id: 2,
          servicio_id: 3,
          fecha: '2026-10-10',
          hora_inicio: '10:00',
          hora_fin: '10:30',
          pago: {
            metodo: 'TARJETA_ONLINE',
            monto: 150.00,
            transaction_id: 'FAIL'
          }
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('El pago no se procesó');
    });
  });

  describe('WEB-HU004: Mis Citas', () => {
    it('Visualización Próximas e Historial', async () => {
      // Retorna citas futuras y pasadas
      mockConnection.query.mockResolvedValueOnce([
        { cita_id: 1, fecha: '2026-12-01', estado: 'CONFIRMADA' }, // Futura
        { cita_id: 2, fecha: '2025-01-01', estado: 'ATENDIDA' }    // Pasada
      ]);

      const response = await request(app)
        .get('/api/portal/appointments')
        .set('Authorization', patientToken);

      expect(response.status).toBe(200);
      expect(response.body.proximas.length).toBeGreaterThan(0);
      expect(response.body.historial.length).toBeGreaterThan(0);
    });

    it('Regla Negocio - Anular retiene dinero', async () => {
      // Cita confirmada a más de 24h
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      mockConnection.query.mockResolvedValueOnce([]); // START
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, fecha: futureDate, hora_inicio: '10:00', estado: 'CONFIRMADA', paciente_id: 10 }]]); // SELECT
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]); // COMMIT

      const response = await request(app)
        .patch('/api/portal/appointments/1/cancel')
        .set('Authorization', patientToken);

      expect(response.status).toBe(200);
      // Validamos que NO se devolvió el dinero (no hay UPDATE PAGO)
      const llamadas = mockConnection.query.mock.calls;
      const pagoCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('PAGO'));
      expect(pagoCall).toBeUndefined();
    });

    it('Límite Tiempo - No puede anular con menos de 24h', async () => {
      // Cita para dentro de 2 horas
      const nearDate = new Date();
      nearDate.setHours(nearDate.getHours() + 2);

      mockConnection.query.mockResolvedValueOnce([]); // START
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, fecha: nearDate, hora_inicio: nearDate.toTimeString().split(' ')[0], estado: 'CONFIRMADA', paciente_id: 10 }]]); // SELECT
      mockConnection.query.mockResolvedValueOnce([]); // ROLLBACK

      const response = await request(app)
        .patch('/api/portal/appointments/1/cancel')
        .set('Authorization', patientToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('menos de 24 horas');
    });

    it('Restricción - Prohibido reprogramar', async () => {
      const response = await request(app)
        .patch('/api/portal/appointments/1/reschedule')
        .set('Authorization', patientToken)
        .send({ nueva_fecha: '2026-10-10' });

      // El endpoint ni siquiera debe existir o debe bloquear explícitamente a pacientes
      expect(response.status).toBe(403); 
      expect(response.body.error).toContain('no permitida en el portal');
    });
  });
});
