/**
 * HU: INT-HU012: Crear citas a pacientes registrados
 * Archivo de pruebas para el agendamiento y validación de citas médicas.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('INT-HU012: Crear citas a pacientes registrados', () => {
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

    // Mockear JWT para simular recepcionista autenticada
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 2, rol: 'RECEPCIONISTA' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CP-11: Camino Feliz', () => {
    // CP-11: Crear citas a pacientes registrados - Camino Feliz
    it('Dado un recepcionista agendando. Cuando ingresa datos correctos de paciente, doctor, servicio y horario libre. Entonces el sistema registra la cita como "RESERVADA" y genera un código único.', async () => {
      
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      
      // 1. SELECT SERVICIO
      mockConnection.query.mockResolvedValueOnce([[{ duracion: 30, buffer: 10, costo: 100 }]]);
      // 2. SELECT Citas existentes (cruce) -> devuelve vacío
      mockConnection.query.mockResolvedValueOnce([[]]);
      // 3. SELECT para verificar si el código único generado existe -> devuelve 0
      mockConnection.query.mockResolvedValueOnce([[{ c: 0 }]]);
      // 4. INSERT CITA
      mockConnection.query.mockResolvedValueOnce([{ insertId: 500 }]);
      // 5. COMMIT
      mockConnection.query.mockResolvedValueOnce([]);
      // 6. AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', recepcionistaToken)
        .send({
          paciente_id: 1,
          doctor_id: 2,
          servicio_id: 1,
          fecha: '2026-12-01',
          hora_inicio: '10:00'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Cita agendada correctamente');
      expect(response.body.codigo_cita).toBeDefined();

      const llamadas = mockConnection.query.mock.calls;
      const insertCall = llamadas.find(call => call[0].includes('INSERT INTO CITA'));
      expect(insertCall).toBeDefined();
      expect(insertCall[0]).toContain('RESERVADA'); // Estado
      expect(insertCall[1]).toContain('10:30'); // hora_fin calculada (10:00 + 30m)
    });
  });

  describe('CP-12: Error Horario Ocupado', () => {
    // CP-12: Crear citas a pacientes registrados - Error Horario Ocupado
    it('Dado un recepcionista agendando. Cuando intenta agendar en un horario que se solapa con el buffer de limpieza de otra cita. Entonces el sistema aborta la creación alertando del cruce de horarios.', async () => {
      
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      
      // 1. SELECT SERVICIO -> duracion 30, buffer 10
      mockConnection.query.mockResolvedValueOnce([[{ duracion: 30, buffer: 10, costo: 100 }]]);
      
      // 2. SELECT Citas existentes -> Devolvemos una cita que choca
      // La cita existente termina a las 10:00, pero tiene 10 min de buffer (hasta 10:10).
      // Si intentamos agendar a las 10:05, debería chocar.
      mockConnection.query.mockResolvedValueOnce([[{ hi: '09:30', hf: '10:00', buffer: 10 }]]);
      
      // 3. ROLLBACK (automático por nuestro mock o manejado)
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', recepcionistaToken)
        .send({
          paciente_id: 1,
          doctor_id: 2,
          servicio_id: 1,
          fecha: '2026-12-01',
          hora_inicio: '10:05' // Choca con el buffer de la cita anterior
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('se cruza con otra cita o con su tiempo de limpieza');
    });
  });


});
