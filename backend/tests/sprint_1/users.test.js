/**
 * HU: INT-HU003: Registrar nuevos usuarios
 * Archivo de pruebas para la gestión y creación de nuevo personal administrativo y médico.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

// Mockear mailer para evitar errores
jest.mock('../../src/utils/mailer.util', () => ({
  sendActivationEmail: jest.fn().mockResolvedValue(true),
}));

describe('INT-HU003: Registrar nuevos usuarios', () => {
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
    pool.execute.mockImplementation(mockConnection.execute);

    // Mockear JWT para simular admin autenticado
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1, rol: 'ADMINISTRADOR' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CP-03: Camino Feliz (Doctor)', () => {
    // CP-03: Registrar nuevos usuarios - Camino Feliz (Doctor)
    it('Dado un administrador llenando el formulario. Cuando selecciona el rol "Doctor" y completa especialidad, colegiatura y servicios. Entonces el sistema crea la cuenta "Pendiente", envía la invitación válida por 24h y notifica el éxito.', async () => {
      // Mock Transacción
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      // 1. Insert USUARIO
      mockConnection.query.mockResolvedValueOnce([{ insertId: 10 }]); 
      // 2. Buscar ROL
      mockConnection.query.mockResolvedValueOnce([[{ rol_id: 4 }]]);
      // 3. Insert ROL_USUARIO
      mockConnection.query.mockResolvedValueOnce([]);
      // 4. Insert DOCTOR
      mockConnection.query.mockResolvedValueOnce([]);
      // 4.1 Insert DOCTOR_ESPECIALIDAD
      mockConnection.query.mockResolvedValueOnce([]);
      // 4.2 Insert SERVICIO_DOCTOR
      mockConnection.query.mockResolvedValueOnce([]);
      // 5. Insert TOKEN_ACTIVACION
      mockConnection.query.mockResolvedValueOnce([]);
      // 6. COMMIT
      mockConnection.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', adminToken)
        .send({
          nombre: 'Ana',
          apellido: 'Lopez',
          DNI: '12345678',
          email: 'ana@clinica.com',
          telefono: '987654321',
          rol: 'DOCTOR',
          nroColegiatura: '998877',
          especialidades: [1],
          servicios: [1]
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Se envió un correo de activación');
      
      // Validaciones en BD
      const llamadas = mockConnection.query.mock.calls;
      expect(llamadas[1][0]).toContain('INSERT INTO USUARIO');
      expect(llamadas[1][0]).toContain("'PENDIENTE'"); // estado en SQL
      
      // Verificar que se insertó en tabla DOCTOR con la colegiatura
      const insertDoctor = llamadas.find(call => call[0].includes('INSERT INTO DOCTOR'));
      expect(insertDoctor).toBeDefined();
      expect(insertDoctor[1]).toEqual([10, 998877]);
    });
  });

  describe('CP-04: Validación (Duplicado)', () => {
    // CP-04: Registrar nuevos usuarios - Validación (Duplicado)
    it('Dado un administrador registrando personal. Cuando ingresa un DNI, correo o colegiatura que ya existe. Entonces el sistema detiene el registro y muestra una alerta específica de duplicidad.', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      
      // Simular error de duplicidad de MySQL al insertar USUARIO
      const dupError = new Error('Duplicate entry email');
      dupError.code = 'ER_DUP_ENTRY';
      dupError.message = 'Duplicate entry email';
      mockConnection.query.mockRejectedValueOnce(dupError);
      mockConnection.query.mockResolvedValueOnce([]); // ROLLBACK

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', adminToken)
        .send({
          nombre: 'Ana',
          apellido: 'Lopez',
          DNI: '12345678',
          email: 'ana@clinica.com', // Supongamos que ya existe
          telefono: '987654321',
          rol: 'RECEPCIONISTA'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('correo electrónico ya está registrado');
      
      const llamadas = mockConnection.query.mock.calls;
      expect(llamadas[llamadas.length - 1][0]).toBe('ROLLBACK');
    });
  });

  describe('CP-05: Seguridad (Activación)', () => {
    // CP-05: Registrar nuevos usuarios - Seguridad (Activación)
    it('Dado un nuevo usuario en el enlace de activación. Cuando falla al ingresar su DNI verificador 3 veces consecutivas. Entonces el sistema invalida el token de forma definitiva y muestra la alerta: "Demasiados intentos fallidos. Solicita al administrador un nuevo enlace de activación."', async () => {
      // Endpoint: POST /api/auth/activate/verify-dni
      
      const mockTokenUser = {
        token_id: 1,
        usuario_id: 5,
        fecha_expira: new Date(Date.now() + 10000), // Válido
        usado: false,
        dni_registrado: '12345678',
        intentos_fallidos: 2, // El siguiente será el tercero
        bloqueado_hasta: null
      };

      pool.query.mockResolvedValueOnce([[mockTokenUser]]);
      pool.execute.mockResolvedValueOnce([]); // UPDATE TOKEN_ACTIVACION fecha_expira = NOW()
      pool.execute.mockResolvedValueOnce([]); // UPDATE USUARIO intentos_fallidos = 0
      pool.query.mockResolvedValueOnce([]); // AUDITORIA (si la hay) o solo execute

      const response = await request(app)
        .post('/api/auth/activate/verify-dni')
        .send({
          token: 'some_random_token',
          DNI: '00000000' // DNI incorrecto
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Demasiados intentos fallidos. Solicita al administrador un nuevo enlace de activación.');

      const executeCalls = pool.execute.mock.calls;
      expect(executeCalls[0][0]).toContain('UPDATE TOKEN_ACTIVACION');
      expect(executeCalls[0][0]).toContain('fecha_expira = NOW()');
      
      expect(executeCalls[1][0]).toContain('UPDATE USUARIO');
      expect(executeCalls[1][0]).toContain('intentos_fallidos = 0');
    });
  });

});
