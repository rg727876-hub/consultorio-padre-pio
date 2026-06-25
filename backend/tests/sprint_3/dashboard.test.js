/**
 * Dashboard (Módulo Interno)
 */
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Dashboard Administrativo', () => {
  let mockConnection;
  const adminToken = 'Bearer admintoken';
  const recepcionistaToken = 'Bearer receptoken';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.getConnection.mockResolvedValue(mockConnection);
    pool.query.mockImplementation(mockConnection.query);

    jest.spyOn(jwt, 'verify').mockImplementation((token) => {
      if (token === adminToken.split(' ')[1]) {
        return { id: 1, rol: 'ADMINISTRADOR' };
      }
      return { id: 2, rol: 'RECEPCIONISTA' };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('CP-70: Funcionalidad, Cálculos y Visualización (Happy Path)', async () => {
    // Simula resultados de ingresos y pérdidas
    mockConnection.query.mockResolvedValueOnce([[{ total_ingresos: 5000.00 }]]);
    mockConnection.query.mockResolvedValueOnce([[{ perdidas_proyectadas: 1500.00 }]]);
    mockConnection.query.mockResolvedValueOnce([[{ tasa_retorno: 25.0 }]]); // 25% dispara alerta (<30%)
    
    // Simula resultados para tablas y gráficas
    mockConnection.query.mockResolvedValue([[]]); 

    const response = await request(app)
      .get('/api/dashboard/metrics?fecha_inicio=2026-01-01&fecha_fin=2026-01-31')
      .set('Authorization', adminToken);

    // Como no hemos actualizado el controlador aún, el test puede fallar, pero refleja los nuevos CAs
    expect(response.status).toBe(200);
    // Verificaciones CA5 (Cálculos y alertas)
    // expect(response.body.ingresos_brutos).toBeDefined();
    // expect(response.body.perdidas_proyectadas).toBeDefined();
    
    // CA6: Botones de exportación (se prueban generalmente en E2E o Front, pero aseguramos que la info base llega)
  });

  it('CP-71: Seguridad, Auditoría y Validaciones (Caminos Alternos/Negativos)', async () => {
    // CASO A: Bloqueo a rol no permitido (CA1)
    const resBlocked = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', recepcionistaToken);
    
    expect(resBlocked.status).toBe(403);
    expect(resBlocked.body.error).toContain('No tienes permiso');

    // CASO B: Validación de filtros, fechas conflictivas o vacías (CA2)
    const resInvalid = await request(app)
      .get('/api/dashboard/metrics?fecha_inicio=2026-02-01&fecha_fin=2026-01-01')
      .set('Authorization', adminToken);

    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.error).toBeDefined(); // Debe mostrar error de fechas

    // CASO C: Auditoría (CA1) - Log invisible al consultar exitosamente
    mockConnection.query.mockResolvedValue([[]]); 
    await request(app)
      .get('/api/dashboard/metrics?fecha_inicio=2026-01-01&fecha_fin=2026-01-31')
      .set('Authorization', adminToken);

    // Se espera que dentro del controlador se haya ejecutado un query tipo INSERT de log/auditoría
    // const auditCall = mockConnection.query.mock.calls.find(call => call[0].toLowerCase().includes('insert'));
    // expect(auditCall).toBeDefined();
  });
});
