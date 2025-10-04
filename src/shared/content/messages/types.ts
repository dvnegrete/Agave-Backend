/**
 * Tipos compartidos para el sistema de mensajes
 */

export interface VoucherData {
  monto: string;
  fecha_pago: string;
  referencia: string;
  hora_transaccion: string;
  casa: number | null;
  faltan_datos?: boolean;
  pregunta?: string;
}

export interface ConfirmationData {
  casa: number;
  monto: string;
  fecha_pago: string;
  referencia: string;
  hora_transaccion: string;
  confirmation_code?: string;
}
