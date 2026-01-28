/**
 * Mensajes de error para WhatsApp
 */

export const ErrorMessages = {
  /**
   * Error genérico al procesar el comprobante
   */
  processingError:
    'Hubo un error al procesar tu comprobante. Por favor intenta nuevamente o envía una imagen más clara del comprobante.',

  /**
   * Error cuando el tipo de archivo no es soportado
   */
  unsupportedFileType: (mimeType: string) =>
    `El tipo de archivo ${mimeType} no es soportado. Por favor envía una imagen (JPG, PNG, etc.) o PDF, para registrar tu pago`,

  /**
   * Error cuando el tipo de mensaje no es soportado
   */
  unsupportedMessageType:
    'Por favor envía un comprobante de pago como imagen o PDF, o escribe tu consulta sobre pagos. Toma en cuenta que mis funciones tan limitadas al registro de pagos.',

  /**
   * Error cuando solo se soportan documentos PDF
   */
  onlyPdfSupported:
    'Solo puedo procesar documentos PDF. Por favor envía tu comprobante como imagen o PDF.',

  /**
   * Error genérico del sistema
   */
  systemError: 'Ha ocurrido un error. Por favor, intenta nuevamente.',

  /**
   * Error cuando la sesión ha expirado
   */
  sessionExpired:
    'Ha expirado la sesión. Por favor envía nuevamente el comprobante.',
} as const;
