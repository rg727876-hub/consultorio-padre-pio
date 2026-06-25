const cron = require('node-cron');
const pool = require('../../src/config/db');
const { startCronJobs } = require('../../src/jobs/expireAppointments');

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('../../src/config/db', () => ({
  execute: jest.fn(),
}));

describe('INT-HU012: Crear Cita - Tareas Automáticas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('CP-14: Dado una cita confirmada bajo la modalidad "Pagar después. Cuando transcurre 1 hora sin registrarse el pago en caja. Entonces el sistema caduca automáticamente la cita y el horario regresa a estar libre.', async () => {
    // Simulamos que la query de actualización devuelve affectedRows > 0
    pool.execute.mockResolvedValue([{ affectedRows: 1 }]);

    // Iniciar el job
    startCronJobs();

    // Verificamos que se llamó a cron.schedule
    expect(cron.schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function));

    // Ejecutamos manualmente la función del job
    const jobFunction = cron.schedule.mock.calls[0][1];
    await jobFunction();

    // Verificamos que la query correcta fue ejecutada (caducar citas RESERVADAS antiguas)
    // El query hace SET estado = 'EXPIRADA'
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE CITA"),
      expect.any(Array)
    );
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("SET estado = 'EXPIRADA'"),
      expect.any(Array)
    );
    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE estado = 'RESERVADA'"),
      expect.any(Array)
    );
  });
});
