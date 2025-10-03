/**
 * Mensajes de error para transacciones bancarias
 */
export const TransactionsBankErrorMessages = {
  /**
   * Error cuando el archivo es demasiado grande
   */
  fileTooLarge: 'El archivo es demasiado grande. Tamaño máximo: 10MB',

  /**
   * Error genérico al procesar el archivo
   */
  fileProcessingError: 'Error al procesar el archivo',

  /**
   * Error al procesar el archivo con detalles
   * @param errorMessage Mensaje de error detallado
   */
  fileProcessingErrorDetail: (errorMessage: string) =>
    `Error al procesar el archivo: ${errorMessage}`,

  /**
   * Error al guardar transacciones
   * @param errorMessage Mensaje de error detallado
   */
  savingError: (errorMessage: string) =>
    `Error al guardar transacciones: ${errorMessage}`,

  /**
   * Error cuando no se encuentra una transacción por ID
   * @param id ID de la transacción
   */
  transactionNotFound: (id: string) =>
    `Transacción bancaria con ID ${id} no encontrada`,

  /**
   * Error cuando algunas transacciones no pudieron ser procesadas
   */
  batchProcessingError:
    'Algunas transacciones bancarias no pudieron ser procesadas',

  /**
   * Error al realizar la reconciliación
   */
  reconciliationError: 'Error al realizar la reconciliación',

  /**
   * Tipo de archivo no soportado
   */
  unsupportedFileType: 'Tipo de archivo no soportado.',

  /**
   * Mensaje de extensiones permitidas
   * @param extensions Array de extensiones permitidas
   */
  allowedExtensions: (extensions: string[]) =>
    `Extensiones permitidas: ${extensions.join(', ')}.`,

  /**
   * Mensaje de tipos MIME permitidos
   * @param mimeTypes Array de tipos MIME permitidos
   */
  allowedMimeTypes: (mimeTypes: string[]) =>
    `Tipos MIME permitidos: ${mimeTypes.join(', ')}.`,
} as const;
