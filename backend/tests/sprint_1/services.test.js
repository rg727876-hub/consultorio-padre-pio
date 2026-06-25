/**
 * HU: INT-HU008: Registrar servicio
 * Archivo de pruebas para la creación y gestión del catálogo de servicios clínicos.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('INT-HU008: Registrar servicio', () => {
  let mockConnection;
  const adminToken = 'Bearer validtoken';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValue(mockConnection);
    pool.query.mockImplementation(mockConnection.query);

    // Mockear JWT para simular admin autenticado
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1, rol: 'ADMINISTRADOR' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CP-08: Camino Feliz', () => {
    // CP-08: Registrar servicio - Camino Feliz
    it('Dado un administrador en el catálogo de servicios. Cuando ingresa un nombre único, costo > 0 y duración > 0. Entonces el sistema activa el servicio inmediatamente y lo deja habilitado.', async () => {
      mockConnection.query.mockResolvedValueOnce([{ insertId: 50 }]); // INSERT
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', adminToken)
        .send({
          nombre: 'Limpieza Dental Profunda',
          descripcion: 'Limpieza con ultrasonido',
          duracion: 45,
          costo: 120.00,
          buffer: 10
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Servicio registrado correctamente');
      expect(response.body.servicio_id).toBe(50);

      const llamadas = mockConnection.query.mock.calls;
      expect(llamadas[0][0]).toContain('INSERT INTO SERVICIO');
      // Validar que se mandó el estado por defecto ACTIVO en la query
      expect(llamadas[0][1]).toContain('ACTIVO');
    });
  });

  describe('CP-09: Validación (Case-insensitive)', () => {
    // CP-09: Registrar servicio - Validación (Case-insensitive)
    it('Dado un administrador registrando un servicio. Cuando ingresa un nombre que ya existe (ignorando mayúsculas/minúsculas). Entonces el sistema impide el registro mostrando: "El nombre del servicio ya se encuentra registrado."', async () => {
      
      const dupError = new Error('Duplicate entry nombre');
      dupError.code = 'ER_DUP_ENTRY';
      mockConnection.query.mockRejectedValueOnce(dupError);

      const response = await request(app)
        .post('/api/services')
        .set('Authorization', adminToken)
        .send({
          nombre: 'limpieza dental profunda', // Nombre duplicado en minúsculas
          duracion: 45,
          costo: 120.00
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('El nombre del servicio ya se encuentra registrado.');
    });
  });

});
