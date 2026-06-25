/**
 * HU: INT-HU010: Registrar pacientes por recepcionista
 * Archivo de pruebas para la creación y gestión de historiales de pacientes.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('INT-HU010: Registrar pacientes por recepcionista', () => {
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

  describe('CP-10: Camino Feliz', () => {
    // CP-10: Registrar pacientes por recepcionista - Camino Feliz
    it('Dado un recepcionista en el módulo de pacientes. Cuando ingresa el DNI y datos personales válidos. Entonces el sistema crea el historial clínico, asigna el rol "PACIENTE" y muestra confirmación de éxito.', async () => {
      
      // INSERT en PACIENTE
      mockConnection.query.mockResolvedValueOnce([{ insertId: 100 }]); 
      // AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', recepcionistaToken)
        .send({
          nombre: 'Carlos',
          apellido: 'Ramirez',
          tipo_documento: 'DNI',
          numero_documento: '87654321',
          telefono: '987654321',
          sexo: 'MASCULINO',
          email: 'carlos@mail.com',
          fecha_nacimiento: '1990-05-15',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Paciente registrado correctamente');
      expect(response.body.paciente_id).toBe(100);

      const llamadas = mockConnection.query.mock.calls;
      expect(llamadas[0][0]).toContain('INSERT INTO PACIENTE');
      // Validar que se mandan los datos correctos
      expect(llamadas[0][1]).toContain('Carlos');
      expect(llamadas[0][1]).toContain('87654321');
    });
  });

  describe('Validación de errores (DNI duplicado)', () => {
    it('Debe retornar 409 si el DNI ya existe', async () => {
      const dupError = new Error('Duplicate entry');
      dupError.code = 'ER_DUP_ENTRY';
      mockConnection.query.mockRejectedValueOnce(dupError);

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', recepcionistaToken)
        .send({
          nombre: 'Carlos',
          apellido: 'Ramirez',
          tipo_documento: 'DNI',
          numero_documento: '87654321',
          telefono: '987654321',
          sexo: 'MASCULINO'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Ya existe un paciente registrado con ese DNI');
    });
  });

});
