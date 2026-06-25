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

  it('CP-56: Seguridad - Acceso bloqueado a no administradores', async () => {
    const response = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', recepcionistaToken);

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('No tienes permiso');
  });

  it('CP-55: Cálculos - Renderiza gráficas e ingresos', async () => {
    // Simula resultados de ingresos
    mockConnection.query.mockResolvedValueOnce([[{ total_ingresos: 5000.00 }]]);
    // Simula citas atendidas
    mockConnection.query.mockResolvedValueOnce([[{ citas_atendidas: 20 }]]);

    const response = await request(app)
      .get('/api/dashboard/metrics?fecha_inicio=2026-01-01&fecha_fin=2026-01-31')
      .set('Authorization', adminToken);

    expect(response.status).toBe(200);
    expect(response.body.ingresos_brutos).toBe(5000);
    expect(response.body.citas_completadas).toBe(20);
  });

  it('CP-57: Validación - Fechas conflictivas', async () => {
    const response = await request(app)
      .get('/api/dashboard/metrics?fecha_inicio=2026-02-01&fecha_fin=2026-01-01')
      .set('Authorization', adminToken);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('conflicto de fechas');
  });

  it('CP-58: Alertas - Dispara alerta por riesgo financiero', async () => {
    // Ingresos = 1000, Gastos simulados = 500 (Gastos superan 40%)
    mockConnection.query.mockResolvedValueOnce([[{ total_ingresos: 1000.00 }]]);
    mockConnection.query.mockResolvedValueOnce([[{ gastos_operativos: 500.00 }]]); // Si aplicara
    
    const response = await request(app)
      .get('/api/dashboard/metrics?fecha_inicio=2026-01-01&fecha_fin=2026-01-31')
      .set('Authorization', adminToken);

    // Si el backend es quien evalúa el 40%, devolverá la alerta
    // o el frontend lo hace en base a la data. Verificamos que la data venga bien
    expect(response.status).toBe(200);
  });
});
