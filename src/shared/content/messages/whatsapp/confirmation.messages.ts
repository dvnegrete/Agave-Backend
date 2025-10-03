/**
 * Mensajes de confirmación para WhatsApp
 */

import { ConfirmationData } from '../types';

export const ConfirmationMessages = {
  /**
   * Solicita confirmación del usuario sobre los datos del voucher
   */
  request: (
    data: ConfirmationData,
  ) => `Voy a registrar tu pago con el estatus "pendiente verificación en banco" con los siguientes datos que he encontrado en el comprobante:
      Monto de pago: ${data.monto}
      Fecha de Pago: ${data.fecha_pago}
      Numero de Casa: ${data.casa}
      Referencia: ${data.referencia}
      Hora de Transacción: ${data.hora_transaccion}

      Si los datos son correctos, escribe SI`,

  /**
   * Mensaje de éxito cuando el usuario confirma el registro
   */
  success: (
    data: ConfirmationData,
  ) => `¡Perfecto! Tu pago ha sido registrado exitosamente con el estatus "pendiente verificación en banco".

Casa: ${data.casa}
Monto: ${data.monto}

Te notificaremos cuando sea verificado. ¡Gracias!`,

  /**
   * Mensaje cuando el usuario cancela el registro
   */
  cancelled:
    'Entendido, he cancelado el registro. Si necesitas corregir algo, por favor envía nuevamente el comprobante.',

  /**
   * Mensaje cuando no se entiende la respuesta del usuario
   */
  retry:
    'No entendí tu respuesta. Por favor responde con "SI" para confirmar el registro o "NO" para cancelar.',
} as const;
