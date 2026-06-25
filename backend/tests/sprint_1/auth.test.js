/**
 * HU: INT-HU001: Inicio de sesión seguro
 * Archivo de pruebas para la autenticación del personal de la clínica.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const bcrypt = require('bcryptjs');

// Mockear bcrypt para no gastar tiempo hasheando en tests
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('INT-HU001: Inicio de sesión seguro', () => {
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    };

    // Hacer que getConnection del mock devuelva la mockConnection
    pool.getConnection.mockResolvedValue(mockConnection);
  });

  describe('CP-01: Camino Feliz', () => {
    // CP-01: Inicio de sesión seguro - Camino Feliz
    it('Dado un usuario con una cuenta verificada y activa. Cuando ingresa su correo y contraseña correctos. Entonces el sistema restablece el contador de intentos, redirige al panel según su cargo y audita el evento.', async () => {
      // Configurar el mock de la BD para que devuelva un usuario válido
      const mockUser = {
        usuario_id: 1,
        nombre: 'Juan',
        apellido: 'Perez',
        email: 'admin@clinica.com',
        password_hash: 'hashedpassword',
        estado: 'ACTIVO',
        intentos_fallidos: 2, // Tenía intentos previos
        bloqueado_hasta: null,
        rol: 'ADMINISTRADOR'
      };

      pool.query.mockResolvedValueOnce([[mockUser]]); // Simula el SELECT inicial
      pool.query.mockResolvedValueOnce([{}]);         // Simula el UPDATE de reseteo

      // Simular contraseña correcta
      bcrypt.compare.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/api/auth/staff/login')
        .send({
          email: 'admin@clinica.com',
          password: 'Password123!'
        });

      // Validar respuesta y redirección implícita (token generado)
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toEqual({
        id: 1,
        nombre: 'Juan',
        apellido: 'Perez',
        email: 'admin@clinica.com',
        rol: 'ADMINISTRADOR'
      });

      // Validar que se restableció el contador de intentos
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE USUARIO'),
        expect.arrayContaining([1]) // El ID del usuario en el array de params
      );
      expect(pool.query.mock.calls[1][0]).toContain('intentos_fallidos = 0');
    });
  });

  describe('CP-02: Seguridad (Bloqueo)', () => {
    // CP-02: Inicio de sesión seguro - Seguridad (Bloqueo)
    it('Dado un usuario intentando iniciar sesión. Cuando el sistema detecta exactamente 5 intentos fallidos consecutivos. Entonces el sistema bloquea el acceso temporalmente por 15 minutos exactos y muestra el tiempo restante dinámico.', async () => {
      // Configurar el mock para un usuario en su intento #4 (el actual será el 5to)
      const mockUser = {
        usuario_id: 2,
        nombre: 'Carlos',
        apellido: 'Gomez',
        email: 'doctor@clinica.com',
        password_hash: 'hashedpassword',
        estado: 'ACTIVO',
        intentos_fallidos: 4, 
        bloqueado_hasta: null,
        rol: 'DOCTOR'
      };

      pool.query.mockResolvedValueOnce([[mockUser]]); // SELECT
      pool.query.mockResolvedValueOnce([{}]);         // UPDATE bloqueo

      // Simular contraseña incorrecta
      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/auth/staff/login')
        .send({
          email: 'doctor@clinica.com',
          password: 'WrongPassword!'
        });

      // Validar respuesta de bloqueo
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Demasiados intentos fallidos. Cuenta bloqueada 15 minutos.');

      // Validar que la BD registró el bloqueo (intentos = 5 y fecha bloqueado_hasta)
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query.mock.calls[1][0]).toContain('intentos_fallidos = ?');
      expect(pool.query.mock.calls[1][0]).toContain('bloqueado_hasta = ?');
      
      const updateParams = pool.query.mock.calls[1][1];
      expect(updateParams[0]).toBe(5); // nuevosIntentos
      expect(updateParams[1]).toBeInstanceOf(Date); // bloqueoHasta
      expect(updateParams[2]).toBe(2); // usuario_id
    });
  });

});
