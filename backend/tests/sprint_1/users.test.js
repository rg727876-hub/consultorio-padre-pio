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
    it('Dado un nuevo usuario en el enlace de activación. Cuando falla al ingresar su DNI verificador 3 veces consecutivas. Entonces el sistema muestra el mensaje: "Demasiados intentos fallidos. Espere 15 minutos" y aplica un bloqueo temporal, preservando el token.', async () => {
      // Endpoint: POST /api/auth/activate/verify-dni
      
      const mockTokenUser = {
        token_id: 1,
        usuario_id: 5,
        fecha_expira: new Date(Date.now() + 86400000), // Válido por 24 horas
        usado: false,
        dni_registrado: '12345678',
        intentos_fallidos: 2, // El siguiente será el tercero y causará el bloqueo
        bloqueado_hasta: null
      };

      pool.query.mockResolvedValueOnce([[mockTokenUser]]);
      pool.execute.mockResolvedValueOnce([]); // UPDATE a intentos_fallidos y bloqueado_hasta

      const response = await request(app)
        .post('/api/auth/activate/verify-dni')
        .send({
          token: 'some_random_token',
          DNI: '00000000' // DNI incorrecto para forzar fallo
        });

      // El status code recomendado para demasiados intentos/bloqueo es 429 (Too Many Requests) o 403 (Forbidden)
      expect([403, 429]).toContain(response.status); 
      expect(response.body.error).toContain('Demasiados intentos fallidos. Espere 15 minutos');

      const executeCalls = pool.execute.mock.calls;
      
      // Asegurar que se haya realizado alguna query de actualización
      expect(executeCalls.length).toBeGreaterThan(0);
      
      // Validar que se aplica un bloqueo temporal (seteando bloqueado_hasta)
      const queryActualizacion = executeCalls[0][0];
      expect(queryActualizacion).toContain('bloqueado_hasta');
      
      // Validar expresamente que NO se altera la fecha de expiración del token (se preserva validez)
      expect(queryActualizacion).not.toContain('fecha_expira =');
    });
  });

});
