import {
  ValidationResult,
  validateAmount,
  validateDate,
  validateReference,
  validateTime,
  validateHouseNumber,
} from '@/shared/common/utils';
import { StructuredDataWithCasa } from '../../infrastructure/ocr/voucher-processor.service';

/**
 * Valida y establece el valor de un campo específico del voucher
 * @param voucherData - Datos del voucher
 * @param fieldName - Nombre del campo a validar
 * @param value - Valor a asignar
 * @returns Resultado de validación
 */
export function validateAndSetVoucherField(
  voucherData: StructuredDataWithCasa,
  fieldName: string,
  value: string,
): ValidationResult {
  switch (fieldName) {
    case 'monto':
      return validateAmount(value);

    case 'fecha_pago':
      return validateDate(value);

    case 'referencia':
      return validateReference(value);

    case 'hora_transaccion':
      return validateTime(value);

    case 'casa':
      const result = validateHouseNumber(value);
      if (result.isValid && result.value) {
        voucherData.casa = parseInt(result.value, 10);
      }
      return result;

    default:
      return { isValid: true, value };
  }
}
