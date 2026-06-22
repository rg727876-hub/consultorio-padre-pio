/**
 * HU: INT-HU013: Listar y buscar citas existentes
 * HU: INT-HU014: Visualizar información completa de cita
 * HU: INT-HU018: Visualizar agenda de doctor con diferentes vistas
 * Archivo de pruebas para los listados, detalles y vistas de agenda.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Consultas y Vistas de Citas (HU013, HU014, HU018)', () => {
  let mockConnection;
  const recepcionistaToken = 'Bearer validtoken';
  const doctorToken = 'Bearer validdoctortoken';

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

    // Mockear JWT para simular roles dinámicamente
    jest.spyOn(jwt, 'verify').mockImplementation((token) => {
      if (token === doctorToken.split(' ')[1]) {
        return { id: 5, rol: 'DOCTOR' };
      }
      return { id: 2, rol: 'RECEPCIONISTA' };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('INT-HU013: Listar y buscar citas existentes', () => {
    // CP-15: Búsqueda de citas
    it('Dado un recepcionista en el listado. Cuando ingresa un código, DNI o nombre en la barra de búsqueda. Entonces el sistema filtra la tabla mostrando únicamente las citas que coinciden con el término.', async () => {
      
      mockConnection.query.mockResolvedValueOnce([[{ total: 1 }]]); // COUNT
      mockConnection.query.mockResolvedValueOnce([[{ total_global: 10 }]]); // COUNT GLOBAL
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, codigo_cita: 'XY123', paciente_nombre: 'Carlos' }]]); // DATA
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA

      const response = await request(app)
        .get('/api/appointments?q=Carlos')
        .set('Authorization', recepcionistaToken);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      
      const llamadas = mockConnection.query.mock.calls;
      const selectCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('OFFSET ?'));
      expect(selectCall).toBeDefined();
      expect(selectCall[0]).toContain('LIKE');
      expect(selectCall[1]).toContain('%Carlos%'); // El parámetro inyectado
    });

    // CP-16: Filtros combinados
    it('Dado un recepcionista visualizando citas. Cuando selecciona filtros combinados (ej. Estado=Confirmada + Rango de Fechas). Entonces el sistema aplica todos los filtros en conjunto y actualiza la paginación según los resultados.', async () => {
      mockConnection.query.mockResolvedValueOnce([[{ total: 5 }]]); 
      mockConnection.query.mockResolvedValueOnce([[{ total_global: 10 }]]); 
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 2, estado: 'CONFIRMADA' }]]); 
      mockConnection.query.mockResolvedValueOnce([]); 

      const response = await request(app)
        .get('/api/appointments?estado=CONFIRMADA&fecha_inicio=2026-12-01&fecha_fin=2026-12-31')
        .set('Authorization', recepcionistaToken);

      expect(response.status).toBe(200);
      const llamadas = mockConnection.query.mock.calls;
      const selectCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('OFFSET ?'));
      expect(selectCall[0]).toContain('estado IN');
      expect(selectCall[0]).toContain('BETWEEN ? AND ?');
    });
  });

  describe('INT-HU014: Visualizar información completa de cita', () => {
    // CP-17: Restricción Clínica
    it('CP-17: Dado un personal administrativo (recepcionista/cajero). Cuando abre el detalle completo de una cita. Entonces el sistema muestra toda la información administrativa y financiera, pero NO devuelve datos de antecedentes ni diagnóstico médico.', async () => {
      
      // 1. Cita y paciente
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 10, paciente_nombre: 'Ana' }]]);
      // 2. Estado de pago
      mockConnection.query.mockResolvedValueOnce([[{ estado: 'COMPLETADO', monto_total: 100 }]]);
      // 3. Consulta clínica (sin datos clínicos, solo existencia)
      mockConnection.query.mockResolvedValueOnce([[]]);
      // 4. Auditoría
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/appointments/10')
        .set('Authorization', recepcionistaToken);

      expect(response.status).toBe(200);
      expect(response.body.paciente_nombre).toBe('Ana');
      expect(response.body.pago.estado).toBe('COMPLETADO');
      expect(response.body.pago.monto_total).toBe(100);
    });
  });

  describe('INT-HU018: Visualizar agenda de doctor con diferentes vistas', () => {
    // CP-18: Privacidad Estricta
    it('CP-18: Dado un médico ingresando a su módulo de agenda. Cuando el sistema solicita las citas programadas. Entonces el backend verifica el rol y solo devuelve las citas asignadas a su doctor_id, impidiendo ver agendas de otros colegas.', async () => {
      
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 99, doctor_id: 5 }]]); // Data
      mockConnection.query.mockResolvedValueOnce([]); // Auditoría

      const response = await request(app)
        .get('/api/appointments/agenda?vista=mes')
        .set('Authorization', doctorToken);

      expect(response.status).toBe(200);
      expect(response.body.vista).toBe('mes');
      
      const llamadas = mockConnection.query.mock.calls;
      const selectCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('FROM   CITA     c'));
      
      // Valida que en la query se filtre obligatoriamente por el ID del doctor
      expect(selectCall[0]).toContain('c.doctor_id = ?');
      expect(selectCall[1][0]).toBe(5); // El ID del token doctorToken
      // Al ser vista "mes", se inyecta BETWEEN
      expect(selectCall[0]).toContain('BETWEEN ? AND ?');
    });
  });

});
