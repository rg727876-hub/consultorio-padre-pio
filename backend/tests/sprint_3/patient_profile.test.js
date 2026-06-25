/**
 * HU: WEB-HU007: Perfil de Usuario
 */
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Portal del Paciente - Perfil (WEB-HU007)', () => {
  let mockConnection;
  const patientToken = 'Bearer patienttoken';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      query: jest.fn(),
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

  it('CP-51: Camino Feliz - Actualiza información válida', async () => {
    mockConnection.query.mockResolvedValueOnce([[{ paciente_id: 10 }]]); // SELECT
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
    mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA

    const response = await request(app)
      .put('/api/portal/profile')
      .set('Authorization', patientToken)
      .send({
        telefono: '987654321',
        direccion: 'Av. Siempre Viva 123'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('actualizada exitosamente');
  });

  it('CP-52: Identidad - Evita editar campos críticos', async () => {
    mockConnection.query.mockResolvedValueOnce([[{ paciente_id: 10 }]]); // SELECT
    mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

    const response = await request(app)
      .put('/api/portal/profile')
      .set('Authorization', patientToken)
      .send({
        telefono: '987654321',
        nombre: 'Malicioso', // Intenta cambiar nombre
        numero_documento: '00000000' // Intenta cambiar DNI
      });

    expect(response.status).toBe(200);
    
    // Verificamos que el QUERY de actualización NO incluye los campos prohibidos
    const llamadas = mockConnection.query.mock.calls;
    const updateCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE PACIENTE'));
    
    expect(updateCall[0]).not.toContain('nombre =');
    expect(updateCall[0]).not.toContain('numero_documento =');
    expect(updateCall[0]).toContain('telefono =');
  });

  it('CP-53: Validación - Teléfono inválido', async () => {
    const response = await request(app)
      .put('/api/portal/profile')
      .set('Authorization', patientToken)
      .send({
        telefono: '98765ABC' // Formato incorrecto
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('9 dígitos');
  });
});
