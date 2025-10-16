/**
 * Mensajes de confirmación para WhatsApp
 */

import { ConfirmationData } from '../types';

export const ConfirmationMessages = {
  /**
   * Solicita confirmación del usuario sobre los datos del voucher
   * NOTA: El campo 'referencia' es opcional
   */
  request: (
    data: ConfirmationData,
  ) => `Voy a registrar tu pago con el estatus *"pendiente verificación en banco"* con los siguientes datos que he encontrado en el comprobante:
      💰 Monto: *$: ${data.monto}*
      📅 Fecha: *${data.fecha_pago}*
      🏠 Casa: *${data.casa}*
      🔢 Referencia: *${data.referencia || 'No disponible'}*
      ⏰ Hora: *${data.hora_transaccion}*

      ¿Son correctos los datos?`,

  /**
   * Mensaje de éxito cuando el usuario confirma el registro
   */
  success: (data: ConfirmationData) => {
    const confirmationInfo = data.confirmation_code
      ? `\n\n🔐 Número de confirmación: ${data.confirmation_code}\n\nGuarda este número para futuras consultas sobre tu pago.`
      : '';
    return `¡Perfecto! Tu pago ha sido registrado exitosamente con el estatus "pendiente verificación en banco".

Casa: ${data.casa}
Monto: ${data.monto}${confirmationInfo}

Te notificaremos cuando sea verificado. ¡Gracias!`;
  },

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
