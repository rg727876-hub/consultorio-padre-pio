/**
 * HU: WEB-HU001: Autenticación de Pacientes y WEB-HU006: Vinculación
 */
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const bcrypt = require('bcryptjs');

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('Portal del Paciente - Autenticación y Vinculación', () => {
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    };
    pool.getConnection.mockResolvedValue(mockConnection);
    bcrypt.hash.mockResolvedValue('hashed_password');
  });

  describe('WEB-HU001: Inicio de sesión de paciente', () => {
    it('Camino Feliz - Login exitoso', async () => {
      const mockPatient = {
        paciente_id: 1,
        nombre: 'Maria',
        apellido: 'Lopez',
        tipo_documento: 'DNI',
        numero_documento: '12345678',
        estado_cuenta: 'ACTIVO',
        estado: 'ACTIVO',
        password_hash: 'hashedpassword',
        intentos_fallidos: 0,
        bloqueado_hasta: null
      };

      pool.query.mockResolvedValueOnce([[mockPatient]]); // SELECT paciente
      pool.query.mockResolvedValueOnce([{}]);         // UPDATE reset intentos

      bcrypt.compare.mockResolvedValueOnce(true); // Contraseña correcta

      const response = await request(app)
        .post('/api/auth/patient/login')
        .send({
          tipo_documento: 'DNI',
          numero_documento: '12345678',
          password: 'Password123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.nombre).toBe('Maria');
    });

    it('Bloqueo de cuenta tras 5 intentos fallidos', async () => {
      const mockPatient = {
        paciente_id: 2,
        estado_cuenta: 'ACTIVO',
        estado: 'ACTIVO',
        password_hash: 'hashedpassword',
        intentos_fallidos: 4, 
        bloqueado_hasta: null
      };

      pool.query.mockResolvedValueOnce([[mockPatient]]); // SELECT paciente
      pool.query.mockResolvedValueOnce([{}]);         // UPDATE bloqueo

      bcrypt.compare.mockResolvedValueOnce(false); // Contraseña incorrecta

      const response = await request(app)
        .post('/api/auth/patient/login')
        .send({
          tipo_documento: 'DNI',
          numero_documento: '87654321',
          password: 'WrongPassword!'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Demasiados intentos fallidos');
    });

    it('Validación - Datos en blanco', async () => {
      const response = await request(app)
        .post('/api/auth/patient/login')
        .send({
          tipo_documento: 'DNI',
          numero_documento: '', // en blanco
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('credenciales');
    });

    it('Antifraude - Mensaje genérico', async () => {
      // Usuario no existe
      pool.query.mockResolvedValueOnce([[]]); 

      const response = await request(app)
        .post('/api/auth/patient/login')
        .send({
          tipo_documento: 'DNI',
          numero_documento: '99999999',
          password: 'Password123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Documento o contraseña incorrectos.');
    });
  });

  describe('WEB-HU001: Registro de Paciente Web', () => {
    it('CP-45: Dado un paciente nuevo sin registros previos, cuando llena todos los campos obligatorios con un formato válido, contraseñas seguras y acepta la política. Entonces el sistema activa la cuenta, registra el evento, muestra el mensaje de éxito, envía el correo y redirige al login.', async () => {
      // No existe paciente previo
      mockConnection.query.mockResolvedValueOnce([[]]); 
      // Insert paciente
      mockConnection.query.mockResolvedValueOnce([{ insertId: 5 }]);
      
      const response = await request(app)
        .post('/api/auth/patient/register')
        .send({
          nombre: 'Nuevo',
          apellido: 'Paciente',
          tipo_documento: 'DNI',
          numero_documento: '99999999',
          sexo: 'MASCULINO',
          telefono: '999999999',
          email: 'nuevo@paciente.com',
          password: 'Password123!',
          confirmar_password: 'Password123!',
          acepta_politica: true,
          fecha_nacimiento: '1990-01-01'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Registro exitoso');
    });

    it('CP-48: Dado un paciente que solo tiene registro fisico en la clínica, cuando ingresa su número de documento en el formulario web. Entonces el sistema alerta: "Este documento está registrado... vincúlala con tu registro existente." y provee el botón para la vinculación.', async () => {
      // Paciente existe físicamente pero sin cuenta web
      mockConnection.query.mockResolvedValueOnce([[{ 
        paciente_id: 10, 
        estado_cuenta: 'SIN_CUENTA' 
      }]]);
      
      const response = await request(app)
        .post('/api/auth/patient/register')
        .send({
          nombre: 'Fisico',
          apellido: 'Paciente',
          tipo_documento: 'DNI',
          numero_documento: '88888888',
          sexo: 'MASCULINO',
          telefono: '999999999',
          email: 'fisico@paciente.com',
          password: 'Password123!',
          confirmar_password: 'Password123!',
          acepta_politica: true,
          fecha_nacimiento: '1990-01-01'
        });

      // El sistema avisa que debe vincular su cuenta
      expect(response.status).toBe(409);
      expect(response.body.error).toContain('vincular');
    });

    it('CP-46: Dado un paciente llenando el formulario, cuando ingresa una contraseña que no cumple los requisitos mínimos o las contraseñas no coinciden. Entonces el sistema detiene el registro y exige corregir los campos según las reglas de seguridad.', async () => {
      const response = await request(app)
        .post('/api/auth/patient/register')
        .send({
          nombre: 'Nuevo',
          apellido: 'Paciente',
          tipo_documento: 'DNI',
          numero_documento: '99999999',
          sexo: 'MASCULINO',
          telefono: '999999999',
          email: 'nuevo@paciente.com',
          password: '123', // Insegura
          confirmar_password: '123',
          acepta_politica: true,
          fecha_nacimiento: '1990-01-01'
        });

      // El backend debe validar la seguridad
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('La contraseña debe tener mínimo 8 caracteres');
    });

    it('CP-47: Dado un paciente que ya posee una cuenta web habilitada, cuando intenta registrarse nuevamente utilizando el mismo número de documento. Entonces el sistema detiene el registro y muestra la alerta: "Este documento ya tiene una cuenta activa. Inicia sesión."', async () => {
      // Paciente existe y ya tiene cuenta
      mockConnection.query.mockResolvedValueOnce([[{ 
        paciente_id: 10, 
        estado_cuenta: 'ACTIVO' 
      }]]);
      
      const response = await request(app)
        .post('/api/auth/patient/register')
        .send({
          nombre: 'Fisico',
          apellido: 'Paciente',
          tipo_documento: 'DNI',
          numero_documento: '88888888',
          sexo: 'MASCULINO',
          telefono: '999999999',
          email: 'fisico@paciente.com',
          password: 'Password123!',
          confirmar_password: 'Password123!',
          acepta_politica: true,
          fecha_nacimiento: '1990-01-01'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Inicia sesión');
    });

    it('CP-49: Dado un paciente llenando el formulario, cuando ingresa un correo electrónico que ya está en uso por otra cuenta. Entonces el sisterna bloquea el registro y muestra la alerta: "El correo electrónico ya se encuentra registrado."', async () => {
      // Documento no existe
      mockConnection.query.mockResolvedValueOnce([[]]); 
      // Correo ya existe
      mockConnection.query.mockResolvedValueOnce([[{ paciente_id: 11 }]]);
      
      const response = await request(app)
        .post('/api/auth/patient/register')
        .send({
          nombre: 'Nuevo',
          apellido: 'Paciente',
          tipo_documento: 'DNI',
          numero_documento: '99999998',
          sexo: 'MASCULINO',
          telefono: '999999999',
          email: 'enuso@paciente.com',
          password: 'Password123!',
          confirmar_password: 'Password123!',
          acepta_politica: true,
          fecha_nacimiento: '1990-01-01'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('El correo electrónico ya se encuentra registrado.');
    });
  });

  describe('WEB-HU006: Vinculación de Pacientes', () => {
    it('Camino Feliz - Vincula cuenta exitosamente', async () => {
      const mockPatient = {
        paciente_id: 10,
        fecha_nacimiento: '1990-01-01T00:00:00.000Z',
        estado_cuenta: 'SIN_CUENTA'
      };
      
      mockConnection.query.mockResolvedValueOnce([[mockPatient]]); // Busca por DNI
      mockConnection.query.mockResolvedValueOnce([[]]); // Verifica correo único
      mockConnection.query.mockResolvedValueOnce([{}]); // UPDATE paciente
      
      const response = await request(app)
        .post('/api/auth/patient/link')
        .send({
          tipo_documento: 'DNI',
          numero_documento: '88888888',
          fecha_nacimiento: '1990-01-01',
          email_cuenta: 'fisico@paciente.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Cuenta vinculada y activada');
    });

    it('Seguridad - Fecha de nacimiento incorrecta bloquea vinculación', async () => {
      const mockPatient = {
        paciente_id: 10,
        fecha_nacimiento: '1990-01-01T00:00:00.000Z',
        estado_cuenta: 'SIN_CUENTA'
      };
      
      mockConnection.query.mockResolvedValueOnce([[mockPatient]]); // Busca por DNI
      
      const response = await request(app)
        .post('/api/auth/patient/link')
        .send({
          tipo_documento: 'DNI',
          numero_documento: '88888888',
          fecha_nacimiento: '1985-05-05', // Fecha incorrecta
          email_cuenta: 'fisico@paciente.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Los datos no coinciden');
    });

  });
});
