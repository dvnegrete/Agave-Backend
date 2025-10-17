import { validateAndUpdateVoucherField } from './field-validator.helper';
import { StructuredDataWithCasa } from '../../infrastructure/ocr/voucher-processor.service';

// Mock the validation utilities
jest.mock('@/shared/common/utils', () => ({
  validateAmount: jest.fn(),
  validateDate: jest.fn(),
  validateReference: jest.fn(),
  validateTime: jest.fn(),
  validateHouseNumber: jest.fn(),
}));

import {
  validateAmount,
  validateDate,
  validateReference,
  validateTime,
  validateHouseNumber,
} from '@/shared/common/utils';

describe('FieldValidatorHelper', () => {
  let voucherData: StructuredDataWithCasa;

  const mockValidateAmount = validateAmount as jest.MockedFunction<
    typeof validateAmount
  >;
  const mockValidateDate = validateDate as jest.MockedFunction<
    typeof validateDate
  >;
  const mockValidateReference = validateReference as jest.MockedFunction<
    typeof validateReference
  >;
  const mockValidateTime = validateTime as jest.MockedFunction<
    typeof validateTime
  >;
  const mockValidateHouseNumber = validateHouseNumber as jest.MockedFunction<
    typeof validateHouseNumber
  >;

  beforeEach(() => {
    voucherData = {
      monto: '',
      fecha_pago: '',
      referencia: '',
      hora_transaccion: '',
      casa: null,
    };

    jest.clearAllMocks();
  });

  describe('validateAndUpdateVoucherField', () => {
    it('should validate and update monto field when provided', () => {
      const mockResult = { isValid: true, value: '500.15' };
      mockValidateAmount.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(voucherData, 'monto', '500.15');

      expect(mockValidateAmount).toHaveBeenCalledWith('500.15');
      expect(result).toEqual(mockResult);
      expect(voucherData.monto).toBe('500.15');
    });

    it('should reject empty monto (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(voucherData, 'monto', '');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('El monto es obligatorio');
      expect(mockValidateAmount).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only monto (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(voucherData, 'monto', '   ');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('El monto es obligatorio');
      expect(mockValidateAmount).not.toHaveBeenCalled();
    });

    it('should validate and update fecha_pago field when provided', () => {
      const mockResult = { isValid: true, value: '2025-01-15' };
      mockValidateDate.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(
        voucherData,
        'fecha_pago',
        '2025-01-15',
      );

      expect(mockValidateDate).toHaveBeenCalledWith('2025-01-15');
      expect(result).toEqual(mockResult);
      expect(voucherData.fecha_pago).toBe('2025-01-15');
    });

    it('should reject empty fecha_pago (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(
        voucherData,
        'fecha_pago',
        '',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('La fecha de pago es obligatoria');
      expect(mockValidateDate).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only fecha_pago (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(
        voucherData,
        'fecha_pago',
        '   ',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('La fecha de pago es obligatoria');
      expect(mockValidateDate).not.toHaveBeenCalled();
    });

    it('should validate and update referencia field when provided', () => {
      const mockResult = { isValid: true, value: 'REF123' };
      mockValidateReference.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(
        voucherData,
        'referencia',
        'REF123',
      );

      expect(mockValidateReference).toHaveBeenCalledWith('REF123');
      expect(result).toEqual(mockResult);
      expect(voucherData.referencia).toBe('REF123');
    });

    it('should allow empty referencia field (optional)', () => {
      const result = validateAndUpdateVoucherField(
        voucherData,
        'referencia',
        '',
      );

      expect(result).toEqual({ isValid: true, value: '' });
      expect(mockValidateReference).not.toHaveBeenCalled();
    });

    it('should allow whitespace-only referencia field (optional)', () => {
      const result = validateAndUpdateVoucherField(
        voucherData,
        'referencia',
        '   ',
      );

      expect(result).toEqual({ isValid: true, value: '' });
      expect(mockValidateReference).not.toHaveBeenCalled();
    });

    it('should validate and update hora_transaccion field when provided', () => {
      const mockResult = { isValid: true, value: '10:30:00' };
      mockValidateTime.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(
        voucherData,
        'hora_transaccion',
        '10:30:00',
      );

      expect(mockValidateTime).toHaveBeenCalledWith('10:30:00');
      expect(result).toEqual(mockResult);
      expect(voucherData.hora_transaccion).toBe('10:30:00');
    });

    it('should reject empty hora_transaccion (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(
        voucherData,
        'hora_transaccion',
        '',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('La hora de transacción es obligatoria');
      expect(mockValidateTime).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only hora_transaccion (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(
        voucherData,
        'hora_transaccion',
        '   ',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('La hora de transacción es obligatoria');
      expect(mockValidateTime).not.toHaveBeenCalled();
    });

    it('should validate and update casa field in voucherData when provided', () => {
      const mockResult = { isValid: true, value: '15' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(voucherData, 'casa', '15');

      expect(mockValidateHouseNumber).toHaveBeenCalledWith('15');
      expect(result).toEqual(mockResult);
      expect(voucherData.casa).toBe(15);
    });

    it('should reject empty casa (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(voucherData, 'casa', '');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('El número de casa es obligatorio');
      expect(mockValidateHouseNumber).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only casa (mandatory field)', () => {
      const result = validateAndUpdateVoucherField(voucherData, 'casa', '   ');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('El número de casa es obligatorio');
      expect(mockValidateHouseNumber).not.toHaveBeenCalled();
    });

    it('should not update casa when validation fails', () => {
      const mockResult = { isValid: false, error: 'Invalid house number' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(voucherData, 'casa', 'invalid');

      expect(mockValidateHouseNumber).toHaveBeenCalledWith('invalid');
      expect(result).toEqual(mockResult);
      expect(voucherData.casa).toBeNull();
    });

    it('should not update monto when validation fails', () => {
      const mockResult = { isValid: false, error: 'Invalid amount' };
      mockValidateAmount.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(voucherData, 'monto', 'abc');

      expect(result.isValid).toBe(false);
      expect(voucherData.monto).toBe('');
    });

    it('should return default result for unknown field', () => {
      const result = validateAndUpdateVoucherField(
        voucherData,
        'unknown_field',
        'some_value',
      );

      expect(result).toEqual({ isValid: true, value: 'some_value' });
    });

    it('should handle invalid amount', () => {
      const mockResult = { isValid: false, error: 'Invalid amount format' };
      mockValidateAmount.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(voucherData, 'monto', 'abc');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid amount format');
      expect(voucherData.monto).toBe('');
    });

    it('should handle invalid date', () => {
      const mockResult = { isValid: false, error: 'Invalid date format' };
      mockValidateDate.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(
        voucherData,
        'fecha_pago',
        '2025-13-45',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid date format');
      expect(voucherData.fecha_pago).toBe('');
    });

    it('should handle invalid time', () => {
      const mockResult = { isValid: false, error: 'Invalid time format' };
      mockValidateTime.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(
        voucherData,
        'hora_transaccion',
        '25:70',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid time format');
      expect(voucherData.hora_transaccion).toBe('');
    });

    it('should parse casa as integer', () => {
      const mockResult = { isValid: true, value: '42' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      validateAndUpdateVoucherField(voucherData, 'casa', '42');

      expect(voucherData.casa).toBe(42);
      expect(typeof voucherData.casa).toBe('number');
    });

    it('should handle casa with leading zeros', () => {
      const mockResult = { isValid: true, value: '05' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      validateAndUpdateVoucherField(voucherData, 'casa', '05');

      expect(voucherData.casa).toBe(5);
    });

    it('should handle empty string values', () => {
      mockValidateAmount.mockReturnValue({ isValid: false, error: 'Required' });

      const result = validateAndUpdateVoucherField(voucherData, 'monto', '');

      expect(result.isValid).toBe(false);
    });

    it('should handle whitespace values', () => {
      mockValidateDate.mockReturnValue({ isValid: false, error: 'Required' });

      const result = validateAndUpdateVoucherField(voucherData, 'fecha_pago', '   ');

      expect(result.isValid).toBe(false);
    });

    it('should pass through validation result for referencia', () => {
      const mockResult = {
        isValid: true,
        value: 'VERY_LONG_REFERENCE_12345',
      };
      mockValidateReference.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(
        voucherData,
        'referencia',
        'VERY_LONG_REFERENCE_12345',
      );

      expect(result).toEqual(mockResult);
      expect(voucherData.referencia).toBe('VERY_LONG_REFERENCE_12345');
    });

    it('should handle invalid referencia when provided', () => {
      const mockResult = {
        isValid: false,
        error: 'Invalid reference format',
      };
      mockValidateReference.mockReturnValue(mockResult);

      const result = validateAndUpdateVoucherField(
        voucherData,
        'referencia',
        'INVALID!!!',
      );

      expect(result).toEqual(mockResult);
      expect(result.isValid).toBe(false);
      expect(voucherData.referencia).toBe('');
    });

    it('should update all fields atomically in sequence', () => {
      const montoResult = { isValid: true, value: '1000.50' };
      const dateResult = { isValid: true, value: '2025-01-20' };
      const timeResult = { isValid: true, value: '14:30' };
      const houseResult = { isValid: true, value: '10' };

      mockValidateAmount.mockReturnValue(montoResult);
      mockValidateDate.mockReturnValue(dateResult);
      mockValidateTime.mockReturnValue(timeResult);
      mockValidateHouseNumber.mockReturnValue(houseResult);

      validateAndUpdateVoucherField(voucherData, 'monto', '1000.50');
      validateAndUpdateVoucherField(voucherData, 'fecha_pago', '2025-01-20');
      validateAndUpdateVoucherField(voucherData, 'hora_transaccion', '14:30');
      validateAndUpdateVoucherField(voucherData, 'casa', '10');

      expect(voucherData.monto).toBe('1000.50');
      expect(voucherData.fecha_pago).toBe('2025-01-20');
      expect(voucherData.hora_transaccion).toBe('14:30');
      expect(voucherData.casa).toBe(10);
    });
  });
});
