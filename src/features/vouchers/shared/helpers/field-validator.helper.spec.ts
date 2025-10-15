import { validateAndSetVoucherField } from './field-validator.helper';
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

  describe('validateAndSetVoucherField', () => {
    it('should validate monto field', () => {
      const mockResult = { isValid: true, value: '500.15' };
      mockValidateAmount.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(voucherData, 'monto', '500.15');

      expect(mockValidateAmount).toHaveBeenCalledWith('500.15');
      expect(result).toEqual(mockResult);
    });

    it('should validate fecha_pago field', () => {
      const mockResult = { isValid: true, value: '2025-01-15' };
      mockValidateDate.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(
        voucherData,
        'fecha_pago',
        '2025-01-15',
      );

      expect(mockValidateDate).toHaveBeenCalledWith('2025-01-15');
      expect(result).toEqual(mockResult);
    });

    it('should validate referencia field', () => {
      const mockResult = { isValid: true, value: 'REF123' };
      mockValidateReference.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(
        voucherData,
        'referencia',
        'REF123',
      );

      expect(mockValidateReference).toHaveBeenCalledWith('REF123');
      expect(result).toEqual(mockResult);
    });

    it('should validate hora_transaccion field', () => {
      const mockResult = { isValid: true, value: '10:30:00' };
      mockValidateTime.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(
        voucherData,
        'hora_transaccion',
        '10:30:00',
      );

      expect(mockValidateTime).toHaveBeenCalledWith('10:30:00');
      expect(result).toEqual(mockResult);
    });

    it('should validate casa field and set value in voucherData', () => {
      const mockResult = { isValid: true, value: '15' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(voucherData, 'casa', '15');

      expect(mockValidateHouseNumber).toHaveBeenCalledWith('15');
      expect(result).toEqual(mockResult);
      expect(voucherData.casa).toBe(15);
    });

    it('should not set casa when validation fails', () => {
      const mockResult = { isValid: false, error: 'Invalid house number' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(voucherData, 'casa', 'invalid');

      expect(mockValidateHouseNumber).toHaveBeenCalledWith('invalid');
      expect(result).toEqual(mockResult);
      expect(voucherData.casa).toBeNull();
    });

    it('should not set casa when value is not provided', () => {
      const mockResult = { isValid: true, value: undefined };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(voucherData, 'casa', '');

      expect(result).toEqual(mockResult);
      expect(voucherData.casa).toBeNull();
    });

    it('should return default result for unknown field', () => {
      const result = validateAndSetVoucherField(
        voucherData,
        'unknown_field',
        'some_value',
      );

      expect(result).toEqual({ isValid: true, value: 'some_value' });
    });

    it('should handle invalid amount', () => {
      const mockResult = { isValid: false, error: 'Invalid amount format' };
      mockValidateAmount.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(voucherData, 'monto', 'abc');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid amount format');
    });

    it('should handle invalid date', () => {
      const mockResult = { isValid: false, error: 'Invalid date format' };
      mockValidateDate.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(
        voucherData,
        'fecha_pago',
        '2025-13-45',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });

    it('should handle invalid time', () => {
      const mockResult = { isValid: false, error: 'Invalid time format' };
      mockValidateTime.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(
        voucherData,
        'hora_transaccion',
        '25:70',
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid time format');
    });

    it('should parse casa as integer', () => {
      const mockResult = { isValid: true, value: '42' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      validateAndSetVoucherField(voucherData, 'casa', '42');

      expect(voucherData.casa).toBe(42);
      expect(typeof voucherData.casa).toBe('number');
    });

    it('should handle casa with leading zeros', () => {
      const mockResult = { isValid: true, value: '05' };
      mockValidateHouseNumber.mockReturnValue(mockResult);

      validateAndSetVoucherField(voucherData, 'casa', '05');

      expect(voucherData.casa).toBe(5);
    });

    it('should not modify voucherData for non-casa fields', () => {
      const originalData = { ...voucherData };
      mockValidateAmount.mockReturnValue({ isValid: true, value: '500.15' });

      validateAndSetVoucherField(voucherData, 'monto', '500.15');

      expect(voucherData).toEqual(originalData);
    });

    it('should handle empty string values', () => {
      mockValidateAmount.mockReturnValue({ isValid: false, error: 'Required' });

      const result = validateAndSetVoucherField(voucherData, 'monto', '');

      expect(result.isValid).toBe(false);
    });

    it('should handle whitespace values', () => {
      mockValidateDate.mockReturnValue({ isValid: false, error: 'Required' });

      const result = validateAndSetVoucherField(voucherData, 'fecha_pago', '   ');

      expect(result.isValid).toBe(false);
    });

    it('should pass through validation result for referencia', () => {
      const mockResult = {
        isValid: true,
        value: 'VERY_LONG_REFERENCE_12345',
      };
      mockValidateReference.mockReturnValue(mockResult);

      const result = validateAndSetVoucherField(
        voucherData,
        'referencia',
        'VERY_LONG_REFERENCE_12345',
      );

      expect(result).toEqual(mockResult);
    });
  });
});
