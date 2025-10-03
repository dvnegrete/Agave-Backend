/**
 * Mensajes contextuales para conversaciones activas en WhatsApp
 */

import { VoucherData } from '../types';

export const ContextualMessages = {
  /**
   * Solicita el número de casa al usuario
   */
  requestHouseNumber:
    'Para poder registrar tu pago por favor indica el número de casa a la que corresponde el pago: (El valor debe ser entre 1 y 66).',

  /**
   * Error cuando no se puede identificar el número de casa
   */
  invalidHouseNumber:
    'No pude identificar el número de casa. Por favor envía un número entre 1 y 66.',

  /**
   * Solicita datos faltantes al usuario
   */
  requestMissingData: (pregunta: string) =>
    `No pude extraer los siguientes datos del comprobante que enviaste. Por favor indícame los valores correctos para los siguientes conceptos:\n\n${pregunta}`,

  /**
   * Confirmación de datos faltantes (en desarrollo)
   */
  missingDataReceived:
    'Gracias por la información. Estoy procesando los datos...\n\n(Función en desarrollo)',

  /**
   * Solicita envío del comprobante
   */
  requestVoucher:
    'Perfecto, por favor envía tu comprobante de pago como imagen o PDF.',
} as const;
