import { GenericCsvModel } from './generic-csv.model';

describe('GenericCsvModel', () => {
  describe('mapRowToTransaction', () => {
    it('should handle CSV with RETIRO/DEPOSITO columns and MONEDA column', () => {
      const row = [
        '2025-01-15',
        '10:30:00',
        'PAGO SERVICIOS',
        '100.50',
        '',
        'USD',
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toEqual({
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.5,
        currency: 'USD',
        is_deposit: false,
        bank_name: 'TestBank',
        validation_flag: false,
        status: 'pending',
      });
    });

    it('should handle CSV with RETIRO/DEPOSITO columns without MONEDA column (default MXN)', () => {
      const row = ['2025-01-15', '10:30:00', 'PAGO SERVICIOS', '100.50', ''];

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

    it('should handle CSV with DEPOSITO column and default MXN currency', () => {
      const row = ['2025-01-15', '10:30:00', 'DEPOSITO NOMINA', '', '2500.00'];

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

    it('should handle CSV with MONTO/TIPO format and MONEDA column', () => {
      const row = [
        '2025-01-15',
        '10:30:00',
        'TRANSFERENCIA',
        '1500.00',
        'deposit',
        'EUR',
      ];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toEqual({
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'TRANSFERENCIA',
        amount: 1500.0,
        currency: 'EUR',
        is_deposit: true,
        bank_name: 'TestBank',
        validation_flag: false,
        status: 'pending',
      });
    });

    it('should handle CSV with MONTO/TIPO format without MONEDA column (default MXN)', () => {
      const row = [
        '2025-01-15',
        '10:30:00',
        'TRANSFERENCIA',
        '1500.00',
        'RETIRO',
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

    it('should handle CSV with only amount (determine type by sign)', () => {
      const row = ['2025-01-15', '10:30:00', 'COMPRA', '-500.00'];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toEqual({
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'COMPRA',
        amount: 500.0,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'TestBank',
        validation_flag: false,
        status: 'pending',
      });
    });

    it('should handle CSV with positive amount (deposit)', () => {
      const row = ['2025-01-15', '10:30:00', 'INGRESO', '1000.00'];

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
      }).toThrow('CSV debe tener al menos 4 columnas');
    });

    it('should throw error when no retiro or deposito values', () => {
      const row = ['2025-01-15', '10:30:00', 'CONCEPTO', '', ''];

      expect(() => {
        GenericCsvModel.mapRowToTransaction(row, { bankName: 'TestBank' });
      }).toThrow('Monto requerido');
    });

    it('should handle MM/DD/YYYY date format (CSV common format)', () => {
      const row = ['01/15/2025', '10:30:00', 'CONCEPTO', '100.00', ''];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should convert MM/DD/YYYY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle MM/DD/YY date format', () => {
      const row = ['12/31/25', '10:30:00', 'CONCEPTO', '100.00', ''];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-12-31'); // Should convert MM/DD/YY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle DD/MM/YYYY date format when day > 12 (auto-detect)', () => {
      const row = ['15/01/2025', '10:30:00', 'CONCEPTO', '100.00', ''];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should convert DD/MM/YYYY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle MM/DD/YYYY date format when day > 12 (auto-detect)', () => {
      const row = ['01/15/2025', '10:30:00', 'CONCEPTO', '100.00', ''];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should convert MM/DD/YYYY to YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should default to MM/DD format for ambiguous dates in CSV files (both numbers <= 12)', () => {
      const row = ['02/01/2025', '10:30:00', 'CONCEPTO', '100.00', ''];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-02-01'); // CSV: Should interpret as MM/DD (Feb 1st, not Jan 2nd)
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle YYYY-MM-DD date format (ISO standard)', () => {
      const row = ['2025-01-15', '10:30:00', 'CONCEPTO', '100.00', ''];

      const result = GenericCsvModel.mapRowToTransaction(row, {
        bankName: 'TestBank',
      });

      expect(result).toBeTruthy();
      expect(result!.date).toBe('2025-01-15'); // Should remain YYYY-MM-DD
      expect(result!.amount).toBe(100.0);
      expect(result!.currency).toBe('MXN');
    });

    it('should handle date parsing errors gracefully', () => {
      const row = ['invalid-date', '10:30:00', 'CONCEPTO', '100.00', ''];

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

      const result = GenericCsvModel.mapJsonItem!(item, { bankName: 'TestBank' });

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

      const result = GenericCsvModel.mapJsonItem!(item, { bankName: 'TestBank' });

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

      const result = GenericCsvModel.mapJsonItem!(item, { bankName: 'TestBank' });

      expect(result.currency).toBe('MXN');
      expect(result.amount).toBe(100);
      expect(result.is_deposit).toBe(false);
    });
  });
});
