/**
 * HU: WEB-HU005: Historial Clínico Web
 */
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Portal del Paciente - Historial Clínico (WEB-HU005)', () => {
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
      return { id: 10, rol: 'PACIENTE' }; // Token para Paciente ID 10
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('CP-47: Camino Feliz - Visualizar detalle de atención previa', async () => {
    const mockConsulta = {
      consulta_id: 1,
      motivo_consulta: 'Dolor de muela',
      diagnostico_definitivo: 'Caries dentinaria',
      odontograma_url: '/uploads/odontograma.png',
      paciente_id: 10
    };

    // La consulta asegura que el paciente_id coincida (mediante JOIN con CITA)
    mockConnection.query.mockResolvedValueOnce([[mockConsulta]]);

    const response = await request(app)
      .get('/api/portal/history/1')
      .set('Authorization', patientToken);

    expect(response.status).toBe(200);
    expect(response.body.motivo_consulta).toBe('Dolor de muela');
    expect(response.body.odontograma_url).toBeDefined();
  });

  it('CP-48: Estado Vacío - Paciente sin antecedentes', async () => {
    // No hay registros en HISTORIA_CLINICA
    mockConnection.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get('/api/portal/history')
      .set('Authorization', patientToken);

    expect(response.status).toBe(200);
    expect(response.body.historia).toBeNull();
    expect(response.body.atenciones.length).toBe(0);
    expect(response.body.message).toContain('Aún no tienes antecedentes');
  });

  it('CP-49: Privacidad - Intento de acceso a historia de otro usuario', async () => {
    // El paciente solicita la consulta 99, pero esa consulta pertenece al paciente 50
    // El backend debe filtrar automáticamente WHERE paciente_id = req.user.id
    mockConnection.query.mockResolvedValueOnce([[]]); // No retorna nada porque el ID no coincide

    const response = await request(app)
      .get('/api/portal/history/99')
      .set('Authorization', patientToken);

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('No encontrado');
  });

  it('CP-50: Inmutabilidad - Rechaza cualquier intento de edición', async () => {
    const response = await request(app)
      .put('/api/portal/history/1')
      .set('Authorization', patientToken)
      .send({ diagnostico_definitivo: 'Sano' });

    // El portal web NO tiene endpoints PUT/POST/PATCH para la historia clínica
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('solo lectura');
  });
});
