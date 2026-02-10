import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';

export const BusinessValues = {
  /**
   * Configuración de casas del condominio
   */
  houses: {
    min: MIN_HOUSE_NUMBER,
    max: MAX_HOUSE_NUMBER,
  },

  /**
   * Timeouts de sesión
   */
  session: {
    /**
     * Timeout de sesión de conversación en milisegundos (10 minutos)
     */
    timeoutMs: 10 * 60 * 1000,

    /**
     * Intervalo de limpieza de sesiones expiradas en milisegundos (5 minutos)
     */
    cleanupIntervalMs: 5 * 60 * 1000,
  },

  /**
   * Límites de archivos
   */
  files: {
    /**
     * Tamaño máximo de archivo en bytes (10MB)
     */
    maxSizeBytes: 10 * 1024 * 1024,

    /**
     * Extensiones de archivo permitidas para transacciones bancarias
     */
    allowedExtensions: ['.csv', '.xlsx', '.txt', '.json'],

    /**
     * Tipos MIME permitidos para transacciones bancarias
     */
    allowedMimeTypes: [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/json',
    ],
  },

  /**
   * Valores de negocio para transacciones bancarias
   */
  transactionsBank: {
    /**
     * Monto máximo permitido para una transacción (10 millones)
     */
    maxAmount: 10000000,

    /**
     * Monto mínimo permitido para una transacción (1 centavo)
     */
    minAmount: 0.01,

    /**
     * Longitud máxima del concepto de transacción
     */
    maxConceptLength: 500,

    /**
     * Monedas soportadas
     */
    supportedCurrencies: ['MXN', 'USD', 'EUR', 'CAD'],

    /**
     * Keywords sospechosos en conceptos de transacciones
     */
    suspiciousKeywords: [
      'test',
      'prueba',
      'demo',
      'temporal',
      'temp',
      'xxxxx',
      'aaaaa',
      'zzzzz',
      'unknown',
      'desconocido',
      'deposito',
      'retiro',
      'transferencia',
    ],

    /**
     * Límites de tiempo para validación de fechas
     */
    dateValidation: {
      /**
       * Máximo de días en el futuro permitidos (30 días)
       */
      maxFutureDays: 30,

      /**
       * Máximo de años en el pasado permitidos (10 años)
       */
      maxPastYears: 10,
    },

    /**
     * Umbrales para advertencias de montos altos
     */
    highAmountThresholds: {
      /**
       * Umbral para depósitos altos
       */
      deposit: 100000,

      /**
       * Umbral para retiros altos
       */
      withdrawal: 50000,
    },

    /**
     * Montos sospechosos específicos
     */
    suspiciousAmounts: [999999, 1000000, 0, 1, 9999999, 10000000],
  },
} as const;
