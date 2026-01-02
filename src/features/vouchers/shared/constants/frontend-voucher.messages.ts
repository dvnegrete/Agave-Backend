/**
 * ⚠️ Mensajes centralizados para el módulo de vouchers frontend
 * Fuente única de verdad para todos los mensajes de error, validación y respuesta
 */

export const VOUCHER_FRONTEND_MESSAGES = {
  // ==================== VALIDACIONES ====================
  VALIDATION: {
    AMOUNT: {
      INVALID_FORMAT: 'Monto inválido',
      MUST_BE_POSITIVE: 'Monto debe ser un número positivo',
      INVALID_WITH_VALUE: (value: string) =>
        `Monto inválido: ${value}. Debe ser un número positivo.`,
    },
    HOUSE_NUMBER: {
      OUT_OF_RANGE: (min: number, max: number) =>
        `Número de casa debe estar entre ${min} y ${max}`,
    },
    DATE: {
      INVALID_FORMAT: 'Formato de fecha inválido (debe ser YYYY-MM-DD)',
    },
    TIME: {
      INVALID_FORMAT: 'Formato de hora inválido (debe ser HH:MM:SS)',
    },
  },

  // ==================== ADVERTENCIAS ====================
  WARNINGS: {
    AUTO_ASSIGNED_TIME:
      'La hora fue asignada automáticamente porque no se encontró en el comprobante',
  },

  // ==================== ERRORES DE NEGOCIO ====================
  BUSINESS_ERRORS: {
    DUPLICATE_VOUCHER: (detailMessage?: string) =>
      `Ya existe un voucher registrado con estos datos.${detailMessage ? ` ${detailMessage}` : ''}`,
    CONFIRMATION_CODE_GENERATION_FAILED: (error?: string) =>
      `No se pudo generar código de confirmación${error ? `: ${error}` : ''}`,
    VOUCHER_NOT_FOUND_AFTER_GENERATION:
      'Voucher no encontrado después de generar código de confirmación',
  },

  // ==================== ERRORES DE USUARIO ====================
  USER_ERRORS: {
    PROCESSING_FAILED: (error?: string) =>
      `Error al procesar usuario${error ? `: ${error}` : ''}`,
  },

  // ==================== ERRORES DE CASA ====================
  HOUSE_ERRORS: {
    PROCESSING_FAILED: (houseNumber: number, error?: string) =>
      `Error al procesar casa ${houseNumber}${error ? `: ${error}` : ''}`,
  },

  // ==================== DEFAULTS ====================
  DEFAULTS: {
    DEFAULT_TIME: '12:00:00',
    DEFAULT_REFERENCE: 'N/A',
  },

  // ==================== MENSAJES DE ÉXITO ====================
  SUCCESS: {
    VOUCHER_UPLOADED: 'Voucher procesado exitosamente',
    VOUCHER_CONFIRMED: 'Voucher confirmado exitosamente',
  },
} as const;

/**
 * Helper para obtener validación de rango de casa
 */
export const getHouseNumberValidationMessage = (
  min: number,
  max: number,
): string => {
  return VOUCHER_FRONTEND_MESSAGES.VALIDATION.HOUSE_NUMBER.OUT_OF_RANGE(
    min,
    max,
  );
};
