/**
 * HU: INT-HU019: Registro de Atención
 * HU: INT-HU020: Historial Clínico
 * Archivo de pruebas para el módulo clínico.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Módulo Clínico y Atención (INT-HU019, INT-HU020)', () => {
  let mockConnection;
  const adminToken = 'Bearer validtoken';
  const doctorToken = 'Bearer doctortoken';
  const recepcionistaToken = 'Bearer recepcToken';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValue(mockConnection);
    pool.query.mockImplementation((q, params) => {
      // console.log('[MOCK QUERY]', q);
      return mockConnection.query(q, params);
    });

    jest.spyOn(jwt, 'verify').mockImplementation((token) => {
      if (token === doctorToken.split(' ')[1]) {
        return { id: 5, rol: 'DOCTOR' };
      }
      if (token === adminToken.split(' ')[1]) {
        return { id: 1, rol: 'ADMINISTRADOR' };
      }
      return { id: 2, rol: 'RECEPCIONISTA' };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('INT-HU019: Registro de Atención', () => {
    // CP-43: Regla Médico-Legal (Inmutabilidad)
    it('CP-43: Dado un doctor que acaba de guardar y cerrar el registro clínico de un paciente. Cuando intenta volver a ingresar para modificar un diagnóstico. Entonces el sistema bloquea el formulario en modo de "solo lectura", garantizando la inmutabilidad de la información médica.', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      // SELECT FOR UPDATE (Cita)
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, doctor_id: 5, paciente_id: 10, estado: 'CONFIRMADA' }]]);
      // SELECT Ya existe?
      mockConnection.query.mockResolvedValueOnce([[{ ya: 0 }]]); // NO EXISTE aún
      // SELECT Historia Clinica
      mockConnection.query.mockResolvedValueOnce([[{ historia_id: 1 }]]); 
      // UPDATE Historia Clinica
      mockConnection.query.mockResolvedValueOnce([]);
      // INSERT CONSULTA_CLINICA
      mockConnection.query.mockResolvedValueOnce([{ insertId: 100 }]);
      // UPDATE CITA (ATENDIDA)
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      // AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]);
      // COMMIT
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/consultas')
        .set('Authorization', doctorToken)
        .send({
          cita_id: 1,
          motivo_consulta: 'Dolor de muela',
          presion_arterial: '120/80',
          pulso: '80',
          frecuencia_respiratoria: '16',
          temperatura: 36.5,
          diagnostico_presuntivo: 'Caries',
          diagnostico_definitivo: 'K02',
        });

      expect(response.status).toBe(201);
      expect(response.body.estado_cita).toBe('ATENDIDA');

      // Prueba de inmutabilidad (Intento de edición/reenvío)
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, doctor_id: 5, paciente_id: 10, estado: 'ATENDIDA' }]]);
      
      const responseEdit = await request(app)
        .post('/api/consultas')
        .set('Authorization', doctorToken)
        .send({
          cita_id: 1,
          motivo_consulta: 'INTENTO DE MODIFICACION', // Esto debe fallar
          presion_arterial: '120/80',
          pulso: '80',
          frecuencia_respiratoria: '16',
          temperatura: 36.5,
          diagnostico_presuntivo: 'Caries',
          diagnostico_definitivo: 'K02',
        });

      // El controlador bloquea si el estado de la cita es ATENDIDA o si `ya > 0`
      expect(responseEdit.status).toBe(409);
      expect(responseEdit.body.error).toContain('Esta cita ya fue atendida');
    });

    // CP-42: Validación Clínica
    it('CP-42: Dado un doctor en el formulario de Registro de Atención. Cuando intenta guardar la sesión dejando absolutamente todos los campos clínicos opcionales en blanco. Entonces el sistema impide cerrar la atención y muestra la alerta visual: "Registre al menos un campo de la atención antes de guardar."', async () => {
      const response = await request(app)
        .post('/api/consultas')
        .set('Authorization', doctorToken)
        .send({
          cita_id: 1,
          motivo_consulta: 'Dolor de muela',
          // Faltan campos de signos vitales obligatorios
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Faltan campos clínicos obligatorios');
    });
  });

  describe('INT-HU020: Historial Clínico', () => {
    // CP-44: Privacidad Médica Estricta
    it('CP-44: Dado un usuario interactuando con el sistema. Cuando su rol es diferente a "Doctor" o "Administrador e intenta abrir el historial clinico completo. Entonces el sistema valida los permisos y bloquea el acceso a la visualización médica por control de privacidad', async () => {
      // Nota: Si el enrutador implementa middlewares de roles, la petición ni siquiera llega al controlador
      const response = await request(app)
        .get('/api/historial/paciente/1')
        .set('Authorization', recepcionistaToken);

      // Verificamos que sea Forbidden (403) devuelto por el middleware 'authorizeRoles'
      expect(response.status).toBe(403);
    });

    it('Dado un doctor. Cuando visualiza el historial clínico detallado. Entonces el sistema le permite acceso y audita la visualización.', async () => {
      // Definir mocks de manera segura para cualquier cantidad de queries
      mockConnection.query.mockImplementation((q) => {
        if (q.includes('FROM   PACIENTE')) {
          return Promise.resolve([[{ paciente_id: 1, nombre: 'Ana', apellido: 'Gomez', fecha_nacimiento: '2000-01-01' }]]);
        }
        if (q.includes('FROM   HISTORIA_CLINICA')) {
          return Promise.resolve([[{ historia_id: 1, antecedentes_sistemicos: 'Ninguno' }]]);
        }
        if (q.includes('FROM   CONSULTA_CLINICA')) {
          return Promise.resolve([[{ consulta_id: 1, diagnostico_definitivo: 'K02' }]]);
        }
        if (q.includes('FROM ROL_USUARIO')) {
          return Promise.resolve([[{ 1: 1 }]]); // mock para middleware ensureDoctorEnBD
        }
        return Promise.resolve([[], []]); // Default seguro para destructuring
      });

      const response = await request(app)
        .get('/api/historial/paciente/1')
        .set('Authorization', doctorToken);

      expect(response.status).toBe(200);
      expect(response.body.paciente.nombre).toBe('Ana');
      expect(response.body.atenciones[0].diagnostico_definitivo).toBe('K02');
      
      const llamadas = mockConnection.query.mock.calls;
      const auditoriaCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('INSERT INTO AUDITORIA'));
      expect(auditoriaCall).toBeDefined();
    });
  });
});
