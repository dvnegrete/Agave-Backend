import { GenericCsvModel } from './generic-csv.model';

describe('GenericCsvModel', () => {
  describe('mapRowToTransaction', () => {
    it('should handle CSV with RETIRO/DEPOSITO columns', () => {
      const row = [
        '2025-01-15', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'PAGO SERVICIOS', // CONCEPTO
        '100.50', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toEqual({
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.5,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'TestBank',
        validation_flag: false,
        status: 'pending',
      });
    });

    it('should handle CSV with DEPOSITO column', () => {
      const row = [
        '2025-01-15', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'DEPOSITO NOMINA', // CONCEPTO
        '', // RETIRO
        '2500.00', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toEqual({
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'DEPOSITO NOMINA',
        amount: 2500.0,
        currency: 'MXN',
        is_deposit: true,
        bank_name: 'TestBank',
        validation_flag: false,
        status: 'pending',
      });
    });

    it('should handle CSV with RETIRO value', () => {
      const row = [
        '2025-01-15', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'TRANSFERENCIA', // CONCEPTO
        '1500.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toEqual({
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'TRANSFERENCIA',
        amount: 1500.0,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'TestBank',
        validation_flag: false,
        status: 'pending',
      });
    });

    it('should handle CSV with DEPOSITO value', () => {
      const row = [
        '2025-01-15', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'INGRESO', // CONCEPTO
        '', // RETIRO
        '1000.00', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toEqual({
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'INGRESO',
        amount: 1000.0,
        currency: 'MXN',
        is_deposit: true,
        bank_name: 'TestBank',
        validation_flag: false,
        status: 'pending',
      });
    });

    it('should throw error for insufficient columns', () => {
      const row = ['2025-01-15', '10:30:00'];

      expect(() => {
        GenericCsvModel.mapRowToTransaction(row, { bankName: 'TestBank' });
      }).toThrow(
        'CSV debe tener al menos 6 columnas: FECHA,HORA,SUCURSAL,CONCEPTO,RETIRO,DEPÓSITO',
      );
    });

    it('should throw error when no retiro or deposito values', () => {
      const row = [
        '2025-01-15', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '', // RETIRO
        '', // DEPOSITO
      ];

      expect(() => {
        GenericCsvModel.mapRowToTransaction(row, { bankName: 'TestBank' });
      }).toThrow('Debe tener un valor en RETIRO o DEPÓSITO');
    });

    it('should handle MM/DD/YYYY date format (CSV common format)', () => {
      const row = [
        '01/15/2025', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '100.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should convert MM/DD/YYYY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle MM/DD/YY date format', () => {
      const row = [
        '12/31/25', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '100.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-12-31'); // Should convert MM/DD/YY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle DD/MM/YYYY date format when day > 12 (auto-detect)', () => {
      const row = [
        '15/01/2025', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '100.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should convert DD/MM/YYYY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle MM/DD/YYYY date format when day > 12 (auto-detect)', () => {
      const row = [
        '01/15/2025', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '100.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should convert MM/DD/YYYY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should default to MM/DD format for ambiguous dates in CSV files (both numbers <= 12)', () => {
      const row = [
        '02/01/2025', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '100.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-02-01'); // CSV: Should interpret as MM/DD (Feb 1st, not Jan 2nd)
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle YYYY-MM-DD date format (ISO standard)', () => {
      const row = [
        '2025-01-15', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '100.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should remain YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle date parsing errors gracefully', () => {
      const row = [
        'invalid-date', // FECHA
        '10:30:00', // HORA
        'SUC001', // SUCURSAL
        'CONCEPTO', // CONCEPTO
        '100.00', // RETIRO
        '', // DEPOSITO
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('invalid-date');
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });
  });

  describe('mapJsonItem', () => {
    it('should handle JSON with explicit currency', () => {
      const item = {
        fecha: '2025-01-15',
        hora: '10:30:00',
        concepto: 'TEST',
        monto: 100,
        moneda: 'USD',
        is_deposit: true,
      };

      const result = GenericCsvModel.mapJsonItem!(item, {
        bankName: 'TestBank',
      });

      expect(result.currency).toBe('USD');
      expect(result.amount).toBe(100);
      expect(result.is_deposit).toBe(true);
    });

    it('should default to MXN when no currency specified', () => {
      const item = {
        fecha: '2025-01-15',
        hora: '10:30:00',
        concepto: 'TEST',
        monto: 100,
        is_deposit: true,
      };

      const result = GenericCsvModel.mapJsonItem!(item, {
        bankName: 'TestBank',
      });

      expect(result.currency).toBe('MXN');
      expect(result.amount).toBe(100);
      expect(result.is_deposit).toBe(true);
    });

    it('should handle retiro/deposito format', () => {
      const item = {
        fecha: '2025-01-15',
        hora: '10:30:00',
        concepto: 'TEST',
        retiro: 100,
      };

      const result = GenericCsvModel.mapJsonItem!(item, {
        bankName: 'TestBank',
      });

      expect(result.currency).toBe('MXN');
      expect(result.amount).toBe(100);
      expect(result.is_deposit).toBe(false);
    });
  });
});
