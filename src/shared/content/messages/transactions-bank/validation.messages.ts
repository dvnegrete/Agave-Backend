/**
 * Mensajes de validación para transacciones bancarias
 * Organizados por campo
 */
export const TransactionsBankValidationMessages = {
  /**
   * Validaciones de fecha
   */
  date: {
    required: 'Fecha es requerida',
    invalidFormat: 'Formato de fecha inválido. Use YYYY-MM-DD',
    invalid: 'Fecha inválida',
    tooFarInFuture: 'La fecha no puede ser más de 30 días en el futuro',
    tooFarInPast: 'La fecha no puede ser más de 10 años en el pasado',
  },

  /**
   * Validaciones de hora
   */
  time: {
    required: 'Hora es requerida',
    invalidFormat: 'Formato de hora inválido. Use HH:MM:SS',
  },

  /**
   * Validaciones de concepto
   */
  concept: {
    required: 'Concepto es requerido',
    tooLong: (maxLength: number) =>
      `El concepto no puede exceder ${maxLength} caracteres`,
    tooShort: 'El concepto es muy corto',
    invalidCharacters: 'El concepto contiene caracteres no permitidos',
  },

  /**
   * Validaciones de monto
   */
  amount: {
    invalid: 'Monto debe ser un número válido',
    belowMinimum: (min: number) => `El monto mínimo es ${min}`,
    aboveMaximum: (max: number) => `El monto máximo es ${max}`,
    noDecimals: 'El monto no tiene decimales',
    suspicious: 'Monto sospechoso detectado',
  },

  /**
   * Validaciones de moneda
   */
  currency: {
    required: 'Moneda es requerida',
    invalidFormat:
      'Formato de moneda inválido. Use código de 3 letras (ej: MXN, USD)',
    notSupported: (currency: string, supported: string[]) =>
      `Moneda no soportada: ${currency}. Monedas soportadas: ${supported.join(', ')}`,
  },

  /**
   * Validaciones de tipo de depósito
   */
  isDeposit: {
    invalid: 'Tipo de depósito debe ser un valor booleano',
  },
} as const;
