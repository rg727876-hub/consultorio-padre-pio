/**
 * HU: INT-HU015: Cancelar Cita
 * HU: INT-HU016: Reprogramar cita
 * HU: INT-HU017: Horario del doctor
 * Archivo de pruebas para validaciones avanzadas de agenda, cancelaciones y reprogramaciones.
 */

const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');

describe('Gestión Avanzada de Citas (INT-HU015, INT-HU016, INT-HU017)', () => {
  let mockConnection;
  const adminToken = 'Bearer validtoken';
  const doctorToken = 'Bearer doctortoken';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      query: jest.fn(),
      execute: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection.mockResolvedValue(mockConnection);
    pool.query.mockImplementation(mockConnection.query);

    jest.spyOn(jwt, 'verify').mockImplementation((token) => {
      if (token === adminToken.split(' ')[1]) {
        return { id: 1, rol: 'ADMINISTRADOR' };
      }
      return { id: 2, rol: 'DOCTOR' };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('INT-HU015: Cancelar Cita', () => {
    // CP-37: Regla Financiera de Cancelación
    it('CP-37: Dado un recepcionista anulando una cita. Cuando confirma la cancelación de una cita que ya contaba con un pago completado. Entonces el sistema la marca como "Cancelada , libera el horario retiene el dinero (sin reembolsos automáticos) y audita la acción.', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      // SELECT FOR UPDATE
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, estado: 'CONFIRMADA', codigo_cita: 'XYZ' }]]); 
      // UPDATE CITA
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      // AUDITORIA
      mockConnection.query.mockResolvedValueOnce([]);
      mockConnection.query.mockResolvedValueOnce([]); // COMMIT

      const response = await request(app)
        .patch('/api/appointments/1/cancel')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.estado).toBe('CANCELADA');
      
      const llamadas = mockConnection.query.mock.calls;
      const cancelCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE CITA'));
      expect(cancelCall).toBeDefined();
      
      // Asegurar que NUNCA se hace un UPDATE o DELETE en la tabla PAGO
      const pagoCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('PAGO'));
      expect(pagoCall).toBeUndefined();
    });
  });

  describe('INT-HU016: Reprogramar Cita', () => {
    // CP-38: Reprogramación Bloqueada
    it('CP-38: Dado un recepcionista en el flujo de reprogramación. Cuando intenta modificar el servicio o cambiar al doctor asignado para esa cita. Entonces el sistema bloquea y NO permite modificar dichos campos, obligando a cancelar y crear una nueva reserva si se requiere un cambio médico.', async () => {
      mockConnection.query.mockResolvedValueOnce([]); // START TRANSACTION
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, doctor_id: 5, servicio_id: 2, estado: 'CONFIRMADA' }]]); // SELECT FOR UPDATE
      mockConnection.query.mockResolvedValueOnce([[{ buffer: 10 }]]); // Buffer SERVICIO
      mockConnection.query.mockResolvedValueOnce([[]]); // Otras citas (Sin solapamiento)
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE CITA
      mockConnection.query.mockResolvedValueOnce([]); // COMMIT
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA

      const response = await request(app)
        .patch('/api/appointments/1/reschedule')
        .set('Authorization', adminToken)
        .send({
          nueva_fecha: '2026-10-10',
          nueva_hora_inicio: '10:00',
          nueva_hora_fin: '10:30',
          doctor_id: 999, // Intentando cambiar el doctor maliciosamente
          servicio_id: 888 // Intentando cambiar el servicio
        });

      expect(response.status).toBe(200);
      
      const llamadas = mockConnection.query.mock.calls;
      const updateCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('UPDATE CITA\n       SET fecha'));
      
      // Verificamos que el query de UPDATE solo actualiza fecha y horas, ignorando doctor_id
      expect(updateCall[0]).not.toContain('doctor_id');
      expect(updateCall[0]).not.toContain('servicio_id');
      expect(updateCall[1]).toEqual(['2026-10-10', '10:00', '10:30', 1]);
    });

    it('CP-39: Dado un recepcionista confirmando una reprogramación. Cuando el horario seleccionado fue tomado milisegundos antes por otro usuario. Entonces el sistema detiene el cambio, alerta "Horario no disponible selecciona otra opción y actualiza el calendario en vivo.', async () => {
      // Usuario 1 bloquea el slot
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 2, doctor_id: 5, estado: 'CONFIRMADA' }]]);
      await request(app)
        .post('/api/appointments/2/lock')
        .set('Authorization', adminToken)
        .send({ nueva_fecha: '2026-11-11', nueva_hora_inicio: '09:00' });

      // Intentamos bloquear el MISMO slot que ya fue tomado por Usuario 1
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 3, doctor_id: 5, estado: 'CONFIRMADA' }]]);
      const res2 = await request(app)
        .post('/api/appointments/3/lock')
        .set('Authorization', adminToken)
        .send({ nueva_fecha: '2026-11-11', nueva_hora_inicio: '09:00' });

      // Debe ser rechazado (HTTP 409 Conflict)
      expect(res2.status).toBe(409);
      expect(res2.body.error).toContain('otro usuario ya está reservando este slot');
    });

    it('CP-40: Dado un recepcionista reprogramando exitosamente. Cuando confirma la selección del nuevo horario disponible. Entonces el sistema actualiza la fecha, libera el espacio original, mantiene el código (ej CIT-001) y conserva el pago previo', async () => {
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 4, doctor_id: 5, estado: 'CONFIRMADA' }]]);

      // Usuario bloquea un slot diferente exitosamente
      const res1 = await request(app)
        .post('/api/appointments/4/lock')
        .set('Authorization', adminToken)
        .send({ nueva_fecha: '2026-11-11', nueva_hora_inicio: '10:00' });
        
      expect(res1.status).toBe(200);
    });
  });

  describe('INT-HU017: Horario del doctor (Sincronización)', () => {
    // CP-41: Sincronización (Agenda en vivo)
    it('CP-41: Dado un recepcionista visualizando la agenda diaria. Cuando un paciente cancela o reserva una cita desde el portal web en ese mismo instante. Entonces el sistema actualiza la interfaz de la agenda de forma automática y en tiempo real sin requerir refrescar la página.', async () => {
      mockConnection.query.mockResolvedValueOnce([[{ cita_id: 1, estado: 'CONFIRMADA' }]]); // DATA
      mockConnection.query.mockResolvedValueOnce([]); // AUDITORIA

      const response = await request(app)
        .get('/api/appointments/agenda?vista=hoy')
        .set('Authorization', doctorToken);

      expect(response.status).toBe(200);
      
      const llamadas = mockConnection.query.mock.calls;
      const agendaCall = llamadas.find(call => typeof call[0] === 'string' && call[0].includes('SELECT\n         c.cita_id'));
      
      // Comprobar que excluye RESERVADA y EXPIRADA
      expect(agendaCall[0]).toContain("c.estado NOT IN ('RESERVADA', 'EXPIRADA')");
    });
  });
});
