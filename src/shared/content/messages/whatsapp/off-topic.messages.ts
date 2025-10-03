/**
 * Mensajes para temas fuera del alcance del bot
 */

export const OffTopicMessages = {
  /**
   * Redirige a usuarios que preguntan sobre información de pagos (saldos, estados, etc.)
   * Usa {portalUrl} como placeholder que se reemplazará por la URL real
   */
  paymentsInfo: (portalUrl: string) =>
    `Para consultar información sobre tus pagos, saldos o estados de cuenta, por favor ingresa al portal web: ${portalUrl}`,

  /**
   * Mensaje para temas completamente fuera del alcance
   */
  general:
    'Lo lamento, solo estoy configurado para recibir comprobantes de pago del condominio.',

  /**
   * Mensaje por defecto para off-topic
   */
  default:
    'Lo lamento, solo estoy configurado para recibir comprobantes de pago del condominio.',
} as const;
