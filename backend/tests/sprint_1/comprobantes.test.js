const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/config/db');
const jwt = require('jsonwebtoken');
const mailer = require('../../src/utils/mailer.util');

jest.mock('../../src/utils/mailer.util', () => ({
  sendComprobanteEmail: jest.fn()
}));

describe('INT-HU022: Comprobantes', () => {
  let mockConnection;
  const recepcionistaToken = 'Bearer validtoken';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
    };

    pool.getConnection = jest.fn().mockResolvedValue(mockConnection);
    pool.query = jest.fn().mockImplementation(mockConnection.query);

    jest.spyOn(jwt, 'verify').mockReturnValue({ id: 2, rol: 'CAJERO' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('CP-23: Dado un cajero con un comprobante generado. Cuando presiona "Enviar por Correo". Entonces el sistema despacha el PDF automáticamente al correo del paciente y notifica el éxito en tiempo real.', async () => {
    
    // Mock the query that fetches the comprobante details for email
    const mockComprobante = {
      comprobante_id: 100,
      tipo_comprobante: 'BOLETA',
      serie: 'B001',
      numero: '000123',
      nubefact_pdf_url: 'https://nubefact.com/pdf/123.pdf',
      paciente_nombre: 'Maria',
      paciente_email: 'maria@example.com',
      servicio_nombre: 'Cardiologia',
      cita_fecha: '2026-10-10',
      hora_inicio: '10:00'
    };
    // 1. findById
    pool.query.mockResolvedValueOnce([[mockComprobante]]);
    // 2. markEmailSent
    pool.query.mockResolvedValueOnce([]);
    // 3. logAudit
    pool.query.mockResolvedValueOnce([]);

    // Mock the mailer response
    mailer.sendComprobanteEmail.mockResolvedValueOnce(true);

    const response = await request(app)
      .post('/api/comprobantes/100/email')
      .set('Authorization', recepcionistaToken);

    if (response.status === 500) {
      console.log('Response body:', response.body);
    }
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Comprobante enviado correctamente al correo del cliente.');

    // Verificar que el mailer fue llamado con el comp correcto
    expect(mailer.sendComprobanteEmail).toHaveBeenCalledWith(mockComprobante);
  });
});
