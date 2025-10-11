import { VoucherData } from './voucher.entity';

/**
 * Servicio de dominio para validar reglas de negocio de vouchers
 */
export class VoucherValidator {
  /**
   * Identifica qué campos están faltantes en los datos del voucher
   * NOTA: El campo 'referencia' NO es obligatorio
   * @param voucherData - Datos del voucher a validar
   * @returns Array de campos faltantes
   */
  static identifyMissingFields(voucherData: VoucherData): string[] {
    const missingFields: string[] = [];

    if (!voucherData.monto || voucherData.monto.trim() === '') {
      missingFields.push('monto');
    }
    if (!voucherData.fecha_pago || voucherData.fecha_pago.trim() === '') {
      missingFields.push('fecha_pago');
    }
    // NOTA: 'referencia' NO es obligatoria - se omite de la validación
    if (
      !voucherData.hora_transaccion ||
      voucherData.hora_transaccion.trim() === ''
    ) {
      missingFields.push('hora_transaccion');
    }
    if (!voucherData.casa) {
      missingFields.push('casa');
    }

    return missingFields;
  }

  /**
   * Verifica si todos los campos obligatorios están completos
   * @param voucherData - Datos del voucher
   * @returns true si todos los campos están completos
   */
  static areAllFieldsComplete(voucherData: VoucherData): boolean {
    return this.identifyMissingFields(voucherData).length === 0;
  }

  /**
   * Extrae el número de casa desde los centavos del monto
   * Regla de negocio: los centavos indican el número de casa (ej: 123.05 → casa 5)
   * @param monto - Monto como string
   * @param minCasas - Número mínimo de casas (default: 1)
   * @param maxCasas - Número máximo de casas (default: 66)
   * @returns Número de casa o null si no es válido
   */
  static extractHouseNumberFromAmount(
    monto: string,
    minCasas: number = 1,
    maxCasas: number = 66,
  ): number | null {
    if (!monto) return null;

    const montoStr = String(monto);
    const parts = montoStr.split('.');

    if (parts.length === 2) {
      const centavos = parseInt(parts[1], 10);

      if (isNaN(centavos) || centavos === 0 || centavos > maxCasas) {
        return null;
      }

      if (centavos >= minCasas && centavos <= maxCasas) {
        return centavos;
      }
    }

    return null;
  }

  /**
   * Obtiene la etiqueta legible de un campo
   * @param fieldName - Nombre del campo
   * @returns Etiqueta en español
   */
  static getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      monto: 'Monto de pago',
      fecha_pago: 'Fecha de pago',
      referencia: 'Referencia bancaria',
      hora_transaccion: 'Hora de transacción',
      casa: 'Número de casa',
    };

    return labels[fieldName] || fieldName;
  }
}
