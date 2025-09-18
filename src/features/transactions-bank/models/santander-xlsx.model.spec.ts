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
      retiro: -500.5, // Negative amount in withdrawal column
      moneda: 'MXN',
    };
    const options = { bankName: 'HSBC' };
    const tx = SantanderXlsxModel.mapJsonItem!(item, options);
    expect(tx.amount).toBe(500.5); // Should be positive (absolute value)
    expect(tx.is_deposit).toBe(false); // Should be withdrawal
    expect(tx.bank_name).toBe('HSBC');
  });

  it('debe formatear fechas correctamente sin offset de zona horaria', () => {
    const row = ['31/jul/25', '10:30:00', 'PAGO SERVICIOS', 150.75, '', 'MXN'];
    const options = { bank: 'Santander' };
    const tx = SantanderXlsxModel.mapRowToTransaction(row, options)!;

    // La fecha debe ser exactamente la fecha esperada sin offset
    expect(tx.date).toBe('2025-07-31');

    // Verificar que parseDateFlexible funciona correctamente para esta fecha
    const testDate = '31/jul/25';
    const { parseDateFlexible } = require('../../../shared/common/utils/parse');
    const parsedDate = parseDateFlexible(testDate);
    const isoString = parsedDate.toISOString().split('T')[0];
    expect(isoString).toBe('2025-07-31');
  });

  it('debe manejar fechas de fin de mes correctamente', () => {
    const testCases = [
      { input: '28/feb/25', expected: '2025-02-28' },
      { input: '31/ene/25', expected: '2025-01-31' },
      { input: '30/abr/25', expected: '2025-04-30' },
      { input: '31/dic/25', expected: '2025-12-31' },
    ];

    testCases.forEach(({ input, expected }) => {
      const row = [input, '10:30:00', 'TEST', 100, '', 'MXN'];
      const options = { bank: 'Test' };
      const tx = SantanderXlsxModel.mapRowToTransaction(row, options)!;
      expect(tx.date).toBe(expected);
    });
  });

  it('debe manejar años de 2 dígitos correctamente', () => {
    const testCases = [
      { input: '01/ene/25', expected: '2025-01-01' },
      { input: '01/ene/99', expected: '2099-01-01' },
      { input: '01/ene/00', expected: '2000-01-01' },
    ];

    testCases.forEach(({ input, expected }) => {
      const row = [input, '10:30:00', 'TEST', 100, '', 'MXN'];
      const options = { bank: 'Test' };
      const tx = SantanderXlsxModel.mapRowToTransaction(row, options)!;
      expect(tx.date).toBe(expected);
    });
  });
});
