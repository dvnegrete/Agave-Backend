import { SantanderXlsxModel } from './santander-xlsx.model';

describe('SantanderXlsxModel', () => {
  it('debe exponer headerKeywords', () => {
    expect(SantanderXlsxModel.headerKeywords.length).toBeGreaterThan(0);
  });

  it('mapRowToTransaction debe mapear una fila de retiro', () => {
    const row = ['31/jul/25', '10:30:00', 'PAGO SERVICIOS', 150.75, '', 'MXN'];
    const tx = SantanderXlsxModel.mapRowToTransaction(row, undefined)!;
    expect(tx.date).toBe('2025-07-31');
    expect(tx.time).toBe('10:30:00');
    expect(tx.concept).toBe('PAGO SERVICIOS');
    expect(tx.amount).toBe(150.75);
    expect(tx.currency).toBe('MXN');
    expect(tx.is_deposit).toBe(false);
    expect(tx.status).toBe('pending');
  });

  it('mapRowToTransaction debe mapear una fila de depósito', () => {
    const row = ['31/jul/25', '14:05:22', 'ABONO NÓMINA', '', 2500, 'MXN'];
    const tx = SantanderXlsxModel.mapRowToTransaction(row, undefined)!;
    expect(tx.is_deposit).toBe(true);
    expect(tx.amount).toBe(2500);
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
    const tx = SantanderXlsxModel.mapJsonItem!(item, undefined);
    expect(tx.date).toBeDefined();
    expect(tx.is_deposit).toBe(true);
    expect(tx.amount).toBe(2500);
  });
});
