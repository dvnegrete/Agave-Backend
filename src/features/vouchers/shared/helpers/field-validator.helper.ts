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
 * REGLAS DE NEGOCIO:
 * - Campos OBLIGATORIOS (nunca vacíos): monto, fecha_pago, hora_transaccion, casa
 *   * Si están vacíos: rechaza con error descriptivo
 *   * Si tienen valor válido: actualiza en voucherData
 *   * Si tienen valor inválido: rechaza con error descriptivo
 *
 * - Campo OPCIONAL: referencia
 *   * Si está vacío: válido (no se actualiza)
 *   * Si tiene valor válido: actualiza
 *   * Si tiene valor inválido: rechaza
 *
 * GARANTÍAS:
 * - NUNCA se enviará a BD un campo obligatorio con valor "Sin Información"
 * - NUNCA se guardará un campo obligatorio vacío en voucherData
 * - El usuario SIEMPRE será rechazado si intenta enviar campos obligatorios vacíos
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
 * } else {
 *   // Usuario recibe error descriptivo
 *   console.error(result.error); // 'La hora de transacción es obligatoria...'
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
      // NOTA: monto es OBLIGATORIO
      // Si está vacío, debe rechazarse con error claro
      if (!value || value.trim() === '') {
        validationResult = {
          isValid: false,
          error: 'El monto es obligatorio. Por favor proporciona el monto en formato numérico (ejemplo: 1500 o 1500.50)',
        };
      } else {
        validationResult = validateAmount(value);
        if (validationResult.isValid && validationResult.value) {
          voucherData.monto = validationResult.value;
        }
      }
      break;

    case 'fecha_pago':
      // NOTA: fecha_pago es OBLIGATORIO
      // Si está vacío, debe rechazarse con error claro
      if (!value || value.trim() === '') {
        validationResult = {
          isValid: false,
          error: 'La fecha de pago es obligatoria. Por favor proporciona la fecha en formato DD/MM/YYYY (ejemplo: 15/01/2025)',
        };
      } else {
        validationResult = validateDate(value);
        if (validationResult.isValid && validationResult.value) {
          voucherData.fecha_pago = validationResult.value;
        }
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
      // NOTA: hora_transaccion es OBLIGATORIO
      // Si está vacío, debe rechazarse con error claro
      if (!value || value.trim() === '') {
        validationResult = {
          isValid: false,
          error: 'La hora de transacción es obligatoria. Por favor proporciona la hora en formato HH:MM (ejemplo: 14:30)',
        };
      } else {
        validationResult = validateTime(value);
        if (validationResult.isValid && validationResult.value) {
          voucherData.hora_transaccion = validationResult.value;
        }
      }
      break;

    case 'casa':
      // NOTA: casa es OBLIGATORIO
      // Si está vacío, debe rechazarse con error claro
      if (!value || value.trim() === '') {
        validationResult = {
          isValid: false,
          error: 'El número de casa es obligatorio. Por favor proporciona un número entre 1 y 66',
        };
      } else {
        validationResult = validateHouseNumber(value);
        if (validationResult.isValid && validationResult.value) {
          voucherData.casa = parseInt(validationResult.value, 10);
        }
      }
      break;

    default:
      validationResult = { isValid: true, value };
  }

  return validationResult;
}
