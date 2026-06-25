/**
 * HU: INT-HU004: Listado de personal
 * HU: INT-HU005: Roles administrativos
 * Archivo de pruebas para la gestión integral de usuarios y roles del administrador.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Gestión de Personal y Roles (INT-HU004, INT-HU005)', () => {
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
  describe('INT-HU004: Listado de personal', () => {
    // CP-24: Orden por estado
    it('Dado un administrador visualizando el módulo de Usuarios. Cuando selecciona el filtro "Todos". Entonces el sistema organiza la lista mostrando primero Activos, luego Pendientes y al final Inactivos.', async () => {
      
      mockConnection.query.mockResolvedValueOnce([[{ total: 10 }]]); // COUNT
      // Se devuelven los usuarios ya ordenados por SQL
      mockConnection.query.mockResolvedValueOnce([
        [
          { usuario_id: 1, estado: 'ACTIVO' },
          { usuario_id: 2, estado: 'PENDIENTE' },
          { usuario_id: 3, estado: 'INACTIVO' }
        ]
      ]); 

      const response = await request(app)
        .get('/api/users?estado=TODOS')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      
      const llamadas = mockConnection.query.mock.calls;
      const selectCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('ORDER  BY FIELD(u.estado,\'ACTIVO\',\'PENDIENTE\',\'INACTIVO\')'));
      expect(selectCall).toBeDefined();
      
      // Comprueba que los datos llegaron en el orden devuelto
      expect(response.body.data[0].estado).toBe('ACTIVO');
      expect(response.body.data[1].estado).toBe('PENDIENTE');
      expect(response.body.data[2].estado).toBe('INACTIVO');
    });

  });
  */

  describe('INT-HU005: Roles administrativos', () => {
    /*
    // CP-26: Edición Camino Feliz
    it('Dado un administrador editando un perfil válido. Cuando modifica los datos de contacto y guarda. Entonces el sistema actualiza la información ignorando intentos de cambiar rol o DNI.', async () => {
      
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      // SELECT FOR UPDATE
      mockConnection.query.mockResolvedValueOnce([[{ usuario_id: 2, email: 'viejo@clinica.com', estado: 'ACTIVO' }]]);
      // Validación correo único
      mockConnection.query.mockResolvedValueOnce([[]]);
      // UPDATE
      mockConnection.query.mockResolvedValueOnce([]);
      // AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]);
      // COMMIT
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .put('/api/users/2')
        .set('Authorization', adminToken)
        .send({
          nombre: 'Pedro',
          apellido: 'Sanchez',
          email: 'nuevo@clinica.com',
          telefono: '987654321',
          // Intentos de inyectar campos prohibidos
          rol: 'DOCTOR',
          DNI: '00000000'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Datos actualizados correctamente');
      
      const llamadas = mockConnection.query.mock.calls;
      const updateCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE USUARIO SET'));
      expect(updateCall).toBeDefined();
      // Asegurarse de que en los parámetros de UPDATE no se inyectó ni Rol ni DNI
      expect(updateCall[0]).not.toContain('DNI =');
    });

    // CP-27: Regla Crítica (Admin)
    it('Dado un administrador gestionando perfiles. Cuando intenta desactivar al último usuario Administrador activo. Entonces el sistema deniega la acción.', async () => {
      // SELECT usuario
      mockConnection.query.mockResolvedValueOnce([[{ usuario_id: 5, nombre: 'Admin', apellido: 'Final', estado: 'ACTIVO' }]]);
      // SELECT verificar si es admin -> Sí
      mockConnection.query.mockResolvedValueOnce([[{ esAdmin: 1 }]]);
      // SELECT count activos admins -> 1
      mockConnection.query.mockResolvedValueOnce([[{ activos: 1 }]]);

      const response = await request(app)
        .patch('/api/users/5/deactivate')
        .set('Authorization', adminToken);

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('el único administrador activo');
    });
    */

    // CP-28: Gestión de Invitaciones
    it('CP-28: Dado un perfil de usuario en estado "Pendiente". Cuando el administrador guarda un nuevo correo electrónico o hace clic en Reenviar correo de activación. Entonces el sistema anula automáticamente la invitación anterior y envia un nuevo enlace válido por 24 horas.', async () => {
      // SELECT usuario
      mockConnection.query.mockResolvedValueOnce([[{ usuario_id: 10, nombre: 'Carlos', email: 'carlos@test.com', estado: 'PENDIENTE' }]]);
      // UPDATE TOKEN (anular anterior)
      mockConnection.query.mockResolvedValueOnce([]);
      // INSERT NUEVO TOKEN
      mockConnection.query.mockResolvedValueOnce([]);
      // AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/users/10/resend-activation')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Correo de activación reenviado correctamente');
      
      const llamadas = mockConnection.query.mock.calls;
      const invalidateCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE TOKEN_ACTIVACION SET usado = TRUE'));
      expect(invalidateCall).toBeDefined();
      const insertTokenCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('INSERT INTO TOKEN_ACTIVACION'));
      expect(insertTokenCall).toBeDefined();
    });
  });

});
