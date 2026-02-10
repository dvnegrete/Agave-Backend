import { VoucherValidator } from './voucher-validator';
import { VoucherData } from './voucher.entity';

describe('VoucherValidator', () => {
  describe('identifyMissingFields', () => {
    it('should return empty array when all required fields are present', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toEqual([]);
    });

    it('should not require referencia field', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: '',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toEqual([]);
    });

    it('should identify missing monto', () => {
      const voucherData: VoucherData = {
        monto: '',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toContain('monto');
    });

    it('should identify missing fecha_pago', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toContain('fecha_pago');
    });

    it('should identify missing hora_transaccion', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '',
        casa: 15,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toContain('hora_transaccion');
    });

    it('should identify missing casa', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: null,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toContain('casa');
    });

    it('should identify multiple missing fields', () => {
      const voucherData: VoucherData = {
        monto: '',
        fecha_pago: '',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: null,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toHaveLength(3);
      expect(missingFields).toContain('monto');
      expect(missingFields).toContain('fecha_pago');
      expect(missingFields).toContain('casa');
    });

    it('should identify all missing fields', () => {
      const voucherData: VoucherData = {
        monto: '',
        fecha_pago: '',
        referencia: '',
        hora_transaccion: '',
        casa: null,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toHaveLength(4);
      expect(missingFields).toContain('monto');
      expect(missingFields).toContain('fecha_pago');
      expect(missingFields).toContain('hora_transaccion');
      expect(missingFields).toContain('casa');
      expect(missingFields).not.toContain('referencia'); // Not required
    });

    it('should handle whitespace-only fields as missing', () => {
      const voucherData: VoucherData = {
        monto: '   ',
        fecha_pago: '\t',
        referencia: 'ABC123',
        hora_transaccion: '\n',
        casa: 15,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toContain('monto');
      expect(missingFields).toContain('fecha_pago');
      expect(missingFields).toContain('hora_transaccion');
    });
  });

  describe('areAllFieldsComplete', () => {
    it('should return true when all required fields are present', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      expect(VoucherValidator.areAllFieldsComplete(voucherData)).toBe(true);
    });

    it('should return true when referencia is empty (not required)', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: '',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      expect(VoucherValidator.areAllFieldsComplete(voucherData)).toBe(true);
    });

    it('should return false when any required field is missing', () => {
      const voucherData: VoucherData = {
        monto: '',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: 15,
      };

      expect(VoucherValidator.areAllFieldsComplete(voucherData)).toBe(false);
    });

    it('should return false when multiple fields are missing', () => {
      const voucherData: VoucherData = {
        monto: '',
        fecha_pago: '',
        referencia: '',
        hora_transaccion: '',
        casa: null,
      };

      expect(VoucherValidator.areAllFieldsComplete(voucherData)).toBe(false);
    });
  });

  describe('extractHouseNumberFromAmount', () => {
    it('should extract house number from cents', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('500.15')).toBe(15);
      expect(VoucherValidator.extractHouseNumberFromAmount('1000.25')).toBe(25);
      expect(VoucherValidator.extractHouseNumberFromAmount('750.42')).toBe(42);
      expect(VoucherValidator.extractHouseNumberFromAmount('2500.66')).toBe(66);
    });

    it('should extract single digit house numbers', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('500.01')).toBe(1);
      expect(VoucherValidator.extractHouseNumberFromAmount('500.05')).toBe(5);
      expect(VoucherValidator.extractHouseNumberFromAmount('500.09')).toBe(9);
    });

    it('should return null for amount without decimals', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('500')).toBeNull();
      expect(VoucherValidator.extractHouseNumberFromAmount('1000')).toBeNull();
    });

    it('should return null for zero cents', () => {
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.00'),
      ).toBeNull();
    });

    it('should return null for cents exceeding max house number', () => {
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.67'),
      ).toBeNull(); // Default max is 66
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.99'),
      ).toBeNull();
    });

    it('should return null for invalid cents', () => {
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.XX'),
      ).toBeNull();
    });

    it('should return null for empty or null amount', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('')).toBeNull();
      expect(
        VoucherValidator.extractHouseNumberFromAmount(null as any),
      ).toBeNull();
    });

    it('should respect custom min and max casa values', () => {
      // Custom range: 10-50
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.05', 10, 50),
      ).toBeNull(); // Below min
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.15', 10, 50),
      ).toBe(15); // Within range
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.50', 10, 50),
      ).toBe(50); // At max
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.55', 10, 50),
      ).toBeNull(); // Above max
    });

    it('should handle minimum valid house number', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('500.01')).toBe(1);
    });

    it('should handle maximum valid house number', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('500.66')).toBe(66);
    });

    it('should handle amounts with leading zeros in cents', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('500.05')).toBe(5);
      expect(VoucherValidator.extractHouseNumberFromAmount('500.08')).toBe(8);
    });

    it('should handle large amounts', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('10000.15')).toBe(
        15,
      );
      expect(VoucherValidator.extractHouseNumberFromAmount('99999.42')).toBe(
        42,
      );
    });

    it('should handle small amounts', () => {
      expect(VoucherValidator.extractHouseNumberFromAmount('0.15')).toBe(15);
      expect(VoucherValidator.extractHouseNumberFromAmount('1.25')).toBe(25);
    });

    it('should return null for amounts with more than 2 decimal places', () => {
      // parseInt('154', 10) = 154, which exceeds max casa (66), so returns null
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.154'),
      ).toBeNull();
    });
  });

  describe('getFieldLabel', () => {
    it('should return correct labels for known fields', () => {
      expect(VoucherValidator.getFieldLabel('monto')).toBe('Monto de pago');
      expect(VoucherValidator.getFieldLabel('fecha_pago')).toBe(
        'Fecha de pago',
      );
      expect(VoucherValidator.getFieldLabel('referencia')).toBe(
        'Referencia bancaria',
      );
      expect(VoucherValidator.getFieldLabel('hora_transaccion')).toBe(
        'Hora de transacción',
      );
      expect(VoucherValidator.getFieldLabel('casa')).toBe('Número de casa');
    });

    it('should return field name for unknown fields', () => {
      expect(VoucherValidator.getFieldLabel('unknown_field')).toBe(
        'unknown_field',
      );
      expect(VoucherValidator.getFieldLabel('custom')).toBe('custom');
    });

    it('should handle empty string', () => {
      expect(VoucherValidator.getFieldLabel('')).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle boundary values for casa extraction', () => {
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.00'),
      ).toBeNull(); // Zero
      expect(VoucherValidator.extractHouseNumberFromAmount('500.01')).toBe(1); // Min valid
      expect(VoucherValidator.extractHouseNumberFromAmount('500.66')).toBe(66); // Max valid
      expect(
        VoucherValidator.extractHouseNumberFromAmount('500.67'),
      ).toBeNull(); // Above max
    });

    it('should handle missing fields with special characters', () => {
      const voucherData: VoucherData = {
        monto: '  \n  ',
        fecha_pago: '\t\t',
        referencia: '',
        hora_transaccion: '   ',
        casa: null,
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields.length).toBeGreaterThan(0);
    });

    it('should handle numeric strings for casa validation', () => {
      const voucherData: VoucherData = {
        monto: '500.15',
        fecha_pago: '2025-01-10',
        referencia: 'ABC123',
        hora_transaccion: '10:30:00',
        casa: 0, // Zero casa
      };

      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      expect(missingFields).toContain('casa');
    });
  });
});
