/**
 * HU: INT-HU007: Definir y gestionar horarios de doctores
 * Archivo de pruebas para la asignación y validación de bloques horarios médicos.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('INT-HU007: Gestión de horarios', () => {
  let mockConnection;
  const adminToken = 'Bearer validtoken';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configurar pool.query mock general
    pool.query = jest.fn();

    // Mockear JWT para simular admin autenticado
    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 1, rol: 'ADMINISTRADOR' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CP-06: Camino Feliz', () => {
    // CP-06: Gestión de horarios - Camino Feliz
    it('Dado un admin creando un bloque horario. Cuando selecciona un día y una hora de fin posterior a la de inicio sin cruces. Entonces el sistema guarda el bloque, lo muestra en el calendario del doctor y lo habilita para reservas.', async () => {
      
      // 1. SELECT COUNT para validar superposición -> devuelve 0
      pool.query.mockResolvedValueOnce([[{ cnt: 0 }]]);
      // 2. INSERT -> devuelve insertId
      pool.query.mockResolvedValueOnce([{ insertId: 10 }]);
      // 3. AUDITORIA -> devuelve success
      pool.query.mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', adminToken)
        .send({
          doctor_id: 2,
          dia_semana: 'LUNES',
          hora_inicio: '08:00',
          hora_fin: '12:00'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Horario registrado correctamente');

      const llamadas = pool.query.mock.calls;
      expect(llamadas[0][0]).toContain('SELECT COUNT(*)'); // Verificación cruce
      expect(llamadas[1][0]).toContain('INSERT INTO HORARIO'); // Inserción exitosa
      expect(llamadas[1][1]).toEqual([2, 'LUNES', '08:00', '12:00']);
    });
  });

  describe('CP-07: Regla Negocio (Cruces)', () => {
    // CP-07: Gestión de horarios - Regla Negocio (Cruces)
    it('Dado un admin editando o creando horarios. Cuando ingresa un rango que se superpone con un bloque ya existente del mismo día. Entonces el sistema bloquea la acción alertando: "El horario ingresado se superpone con un bloque existente."', async () => {
      
      // SELECT COUNT para validar superposición -> devuelve 1 (hay cruce)
      pool.query.mockResolvedValueOnce([[{ cnt: 1 }]]);

      const response = await request(app)
        .post('/api/schedules')
        .set('Authorization', adminToken)
        .send({
          doctor_id: 2,
          dia_semana: 'LUNES',
          hora_inicio: '10:00', // Se cruza con el de 08:00 a 12:00
          hora_fin: '14:00'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('El horario ingresado se superpone con un bloque existente.');

      const llamadas = pool.query.mock.calls;
      expect(llamadas).toHaveLength(1); // Se detuvo en el SELECT, nunca hizo INSERT
    });
  });

});
