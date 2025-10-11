/**
 * Entidad de dominio del Voucher
 * Representa un comprobante de pago con toda su información
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

export interface VoucherConfirmationData {
  casa: number;
  monto: string;
  fecha_pago: string;
  referencia: string;
  hora_transaccion: string;
  confirmation_code?: string;
}

export class VoucherEntity {
  constructor(
    public readonly monto: string,
    public readonly fecha_pago: string,
    public readonly referencia: string,
    public readonly hora_transaccion: string,
    public readonly casa: number,
    public readonly gcsFilename?: string,
    public readonly originalFilename?: string,
    public readonly confirmationCode?: string,
  ) {}

  /**
   * Crea una entidad de voucher desde datos estructurados
   */
  static fromData(
    data: VoucherData,
    files?: {
      gcsFilename?: string;
      originalFilename?: string;
    },
  ): VoucherEntity {
    if (data.casa === null) {
      throw new Error('El número de casa es requerido para crear un voucher');
    }

    return new VoucherEntity(
      data.monto,
      data.fecha_pago,
      data.referencia,
      data.hora_transaccion,
      data.casa,
      files?.gcsFilename,
      files?.originalFilename,
    );
  }

  /**
   * Convierte la entidad a datos de confirmación
   */
  toConfirmationData(): VoucherConfirmationData {
    return {
      casa: this.casa,
      monto: this.monto,
      fecha_pago: this.fecha_pago,
      referencia: this.referencia,
      hora_transaccion: this.hora_transaccion,
      confirmation_code: this.confirmationCode,
    };
  }

  /**
   * Verifica si todos los campos están completos
   */
  isComplete(): boolean {
    return !!(
      this.monto &&
      this.fecha_pago &&
      this.hora_transaccion &&
      this.casa
    );
    // Nota: referencia es opcional
  }

  /**
   * Verifica si tiene un número de casa asignado
   */
  hasHouseNumber(): boolean {
    return this.casa !== null && this.casa > 0;
  }
}
