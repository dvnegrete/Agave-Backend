/**
 * Utilidades para validar campos de formularios
 */

export interface ValidationResult {
  isValid: boolean;
  value?: string;
  error?: string;
}

/**
 * Valida un monto (número con o sin decimales)
 * @param value - Valor a validar
 * @returns Resultado de validación
 */
export function validateAmount(value: string): ValidationResult {
  const montoRegex = /^\d+(\.\d{1,2})?$/;
  if (!montoRegex.test(value)) {
    return {
      isValid: false,
      error: 'El monto debe ser un número válido (ejemplo: 1500 o 1500.50)',
    };
  }
  return { isValid: true, value };
}

/**
 * Valida una fecha en formato DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD
 * @param value - Valor a validar
 * @returns Resultado de validación
 */
export function validateDate(value: string): ValidationResult {
  const fechaRegex =
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})$/;
  if (!fechaRegex.test(value)) {
    return {
      isValid: false,
      error: 'La fecha debe estar en formato DD/MM/YYYY o YYYY-MM-DD',
    };
  }
  return { isValid: true, value };
}

/**
 * Valida una referencia bancaria (mínimo 3 caracteres)
 * @param value - Valor a validar
 * @returns Resultado de validación
 */
export function validateReference(value: string): ValidationResult {
  if (value.length < 3) {
    return {
      isValid: false,
      error: 'La referencia debe tener al menos 3 caracteres',
    };
  }
  return { isValid: true, value };
}

/**
 * Valida una hora en formato HH:MM o HH:MM:SS
 * @param value - Valor a validar
 * @returns Resultado de validación
 */
export function validateTime(value: string): ValidationResult {
  const horaRegex = /^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  if (!horaRegex.test(value)) {
    return {
      isValid: false,
      error: 'La hora debe estar en formato HH:MM (ejemplo: 14:30)',
    };
  }
  return { isValid: true, value };
}

/**
 * Valida un número de casa (rango 1-66)
 * @param value - Valor a validar
 * @param min - Número mínimo de casa (default: 1)
 * @param max - Número máximo de casa (default: 66)
 * @returns Resultado de validación
 */
export function validateHouseNumber(
  value: string,
  min: number = 1,
  max: number = 66,
): ValidationResult {
  const casaNumber = parseInt(value, 10);
  if (isNaN(casaNumber) || casaNumber < min || casaNumber > max) {
    return {
      isValid: false,
      error: `El número de casa debe ser un valor entre ${min} y ${max}`,
    };
  }
  return { isValid: true, value: casaNumber.toString() };
}
