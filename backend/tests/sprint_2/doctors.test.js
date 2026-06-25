/**
 * HU: INT-HU006: Gestión de médicos
 * Archivo de pruebas para la gestión integral de médicos y sus agendas.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Gestión de Médicos (INT-HU006)', () => {
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
    pool.execute = mockConnection.execute;

    // Mockear JWT para simular ADMINISTRADOR autenticado
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1, rol: 'ADMINISTRADOR' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /*
  describe('CP-29: Validación de Duplicados en vivo', () => {
    it('Dado un administrador editando el perfil de un doctor. Cuando ingresa un correo o número de colegiatura que ya le pertenece a otro profesional. Entonces el sistema deniega el guardado de los cambios.', async () => {
      // Validar usuario existente
      mockConnection.query.mockResolvedValueOnce([[{ estado: 'ACTIVO', email: 'doctor1@clinica.com' }]]);
      // Validar correo único (Supongamos que el correo ya está en uso por el id 99)
      mockConnection.query.mockResolvedValueOnce([[{ usuario_id: 99 }]]);

      const response = await request(app)
        .put('/api/doctors/5')
        .set('Authorization', adminToken)
        .send({
          nombre: 'Juan',
          apellido: 'Perez',
          email: 'yaexiste@clinica.com',
          telefono: '987654321',
          nroColegiatura: '12345',
          serviciosIds: [1],
          especialidadesIds: [2]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('El correo ya está en uso');
      
      // Ahora probamos la duplicidad de colegiatura
      mockConnection.query.mockReset();
      // Validar usuario
      mockConnection.query.mockResolvedValueOnce([[{ estado: 'ACTIVO', email: 'doctor1@clinica.com' }]]);
      // Correo único pasa bien
      mockConnection.query.mockResolvedValueOnce([[]]);
      // Colegiatura duplicada falla
      mockConnection.query.mockResolvedValueOnce([[{ doctor_id: 88 }]]);

      const responseCop = await request(app)
        .put('/api/doctors/5')
        .set('Authorization', adminToken)
        .send({
          nombre: 'Juan',
          apellido: 'Perez',
          email: 'nuevo@clinica.com',
          telefono: '987654321',
          nroColegiatura: '99999', // ya existe
          serviciosIds: [1],
          especialidadesIds: [2]
        });

      expect(responseCop.status).toBe(400);
      expect(responseCop.body.error).toContain('Colegiatura ya está registrado');
    });
  });
  */

  describe('CP-30: Regla de Negocio (Citas y Reactivación)', () => {
    it('CP-30: Dado un administrador desactivando a un doctor. Cuando el doctor seleccionado tiene citas futuras ya agendadas. Entonces el sistema advierte, cambia su estado a "Inactivo", cancela automáticamente sus citas futuras y retiene los pagos completados', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      mockConnection.query.mockResolvedValueOnce([]); // UPDATE ESTADO
      // UPDATE CITAS devuelve 3 afectadas
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 3 }]); 
      mockConnection.query.mockResolvedValueOnce([]); // COMMIT
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA

      const response = await request(app)
        .put('/api/doctors/10/status')
        .set('Authorization', adminToken)
        .send({ estado: 'INACTIVO' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Doctor desactivado');
      
      const llamadas = mockConnection.query.mock.calls;
      const cancelCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE CITA \n        SET estado = \'CANCELADA\''));
      expect(cancelCall).toBeDefined();
    });

    /*
    it('CP-31: Dado un doctor en estado "Inactivo". Cuando el administrador presiona el botón "Reactivar". Entonces el sistema lo devuelve a "Activo" sin revertir las citas previamente canceladas.', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      mockConnection.query.mockResolvedValueOnce([]); // UPDATE ESTADO
      // Al reactivar, no se ejecuta la query de UPDATE CITA
      mockConnection.query.mockResolvedValueOnce([]); // COMMIT
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA

      const response = await request(app)
        .put('/api/doctors/10/status')
        .set('Authorization', adminToken)
        .send({ estado: 'ACTIVO' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Doctor reactivado');
      
      const llamadas = mockConnection.query.mock.calls;
      // Comprueba que no se haya llamado a ningún UPDATE CITA
      const cancelCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE CITA'));
      expect(cancelCall).toBeUndefined();
    });
    */
  });

});
