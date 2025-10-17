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
 * Valida y actualiza ATOMICAMENTE un campo específico del voucher
 * Este es el helper único para validar y guardar datos en voucherData
 * Garantiza que cuando un dato es válido, SIEMPRE se actualiza en voucherData
 *
 * NOTA: El campo 'referencia' NO es obligatorio.
 * - Si el usuario proporciona un valor válido: se actualiza
 * - Si el usuario deja vacío: se mantiene como está (no es obligatorio)
 * - Campos obligatorios: monto, fecha_pago, hora_transaccion, casa
 *
 * @param voucherData - Datos del voucher (se modifica en place)
 * @param fieldName - Nombre del campo a validar y actualizar
 * @param value - Valor a validar y asignar
 * @returns Resultado de validación + actualización
 *
 * @example
 * const result = validateAndUpdateVoucherField(voucherData, 'hora_transaccion', '14:30');
 * if (result.isValid) {
 *   // El campo ya está actualizado en voucherData
 *   console.log(voucherData.hora_transaccion); // '14:30'
 * }
 */
export function validateAndUpdateVoucherField(
  voucherData: StructuredDataWithCasa,
  fieldName: string,
  value: string,
): ValidationResult {
  // 1. Validar el valor
  let validationResult: ValidationResult;

  switch (fieldName) {
    case 'monto':
      validationResult = validateAmount(value);
      if (validationResult.isValid && validationResult.value) {
        voucherData.monto = validationResult.value;
      }
      break;

    case 'fecha_pago':
      validationResult = validateDate(value);
      if (validationResult.isValid && validationResult.value) {
        voucherData.fecha_pago = validationResult.value;
      }
      break;

    case 'referencia':
      // NOTA: referencia NO es obligatoria
      // Si está vacía, es válida (no es un error)
      if (!value || value.trim() === '') {
        // Campo opcional vacío = válido
        validationResult = { isValid: true, value: '' };
      } else {
        // Si tiene valor, validar el formato
        validationResult = validateReference(value);
        if (validationResult.isValid && validationResult.value) {
          voucherData.referencia = validationResult.value;
        }
      }
      break;

    case 'hora_transaccion':
      validationResult = validateTime(value);
      if (validationResult.isValid && validationResult.value) {
        voucherData.hora_transaccion = validationResult.value;
      }
      break;

    case 'casa':
      validationResult = validateHouseNumber(value);
      if (validationResult.isValid && validationResult.value) {
        voucherData.casa = parseInt(validationResult.value, 10);
      }
      break;

    default:
      validationResult = { isValid: true, value };
  }

  return validationResult;
}
