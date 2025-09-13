import { SantanderXlsxModel } from './santander-xlsx.model';

describe('SantanderXlsxModel', () => {
  it('debe exponer headerKeywords', () => {
    expect(SantanderXlsxModel.headerKeywords.length).toBeGreaterThan(0);
  });

  it('mapRowToTransaction debe mapear una fila de retiro', () => {
    const row = ['31/jul/25', '10:30:00', 'PAGO SERVICIOS', 150.75, '', 'MXN'];
    const options = { bank: 'Santander' };
    const tx = SantanderXlsxModel.mapRowToTransaction(row, options)!;
    expect(tx.date).toBe('2025-07-31');
    expect(tx.time).toBe('10:30:00');
    expect(tx.concept).toBe('PAGO SERVICIOS');
    expect(tx.amount).toBe(150.75);
    expect(tx.currency).toBe('MXN');
    expect(tx.is_deposit).toBe(false);
    expect(tx.bank_name).toBe('Santander');
    expect(tx.status).toBe('pending');
  });

  it('mapRowToTransaction debe mapear una fila de depósito', () => {
    const row = ['31/jul/25', '14:05:22', 'ABONO NÓMINA', '', 2500, 'MXN'];
    const options = { bankName: 'Santander' };
    const tx = SantanderXlsxModel.mapRowToTransaction(row, options)!;
    expect(tx.is_deposit).toBe(true);
    expect(tx.amount).toBe(2500);
    expect(tx.bank_name).toBe('Santander');
  });

  it('mapRowToTransaction debe mapear una fila de retiro con monto negativo', () => {
    const row = ['31/jul/25', '10:30:00', 'PAGO SERVICIOS', -150.75, '', 'MXN'];
    const options = { bank: 'BBVA' };
    const tx = SantanderXlsxModel.mapRowToTransaction(row, options)!;
    expect(tx.date).toBe('2025-07-31');
    expect(tx.time).toBe('10:30:00');
    expect(tx.concept).toBe('PAGO SERVICIOS');
    expect(tx.amount).toBe(150.75); // Should be positive (absolute value)
    expect(tx.currency).toBe('MXN');
    expect(tx.is_deposit).toBe(false); // Should be withdrawal
    expect(tx.bank_name).toBe('BBVA');
    expect(tx.status).toBe('pending');
  });

  it('mapJsonItem debe soportar llaves equivalentes', () => {
    const item = {
      fecha: '31/jul/25',
      hora: '14:05:22',
      concepto: 'ABONO',
      monto: 2500,
      moneda: 'MXN',
      deposito: true,
    };
    const options = { bank: 'Banorte' };
    const tx = SantanderXlsxModel.mapJsonItem!(item, options);
    expect(tx.date).toBeDefined();
    expect(tx.is_deposit).toBe(true);
    expect(tx.amount).toBe(2500);
    expect(tx.bank_name).toBe('Banorte');
  });

  it('mapJsonItem debe manejar montos negativos correctamente', () => {
    const item = {
      fecha: '31/jul/25',
      hora: '10:30:00',
      concepto: 'COMPRA',
      retiro: -500.50, // Negative amount in withdrawal column
      moneda: 'MXN',
    };
    const options = { bankName: 'HSBC' };
    const tx = SantanderXlsxModel.mapJsonItem!(item, options);
    expect(tx.amount).toBe(500.50); // Should be positive (absolute value)
    expect(tx.is_deposit).toBe(false); // Should be withdrawal
    expect(tx.bank_name).toBe('HSBC');
  });
});
