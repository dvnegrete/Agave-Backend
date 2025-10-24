import { VoucherData } from './voucher.entity';

/**
 * Servicio de dominio para validar reglas de negocio de vouchers
 */
export class VoucherValidator {
  /**
   * Convierte un valor a string de forma segura
   * Maneja null, undefined, números y strings
   * @param value - Valor a convertir
   * @returns String convertido o vacío si es inválido
   */
  private static toSafeString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  /**
   * Identifica qué campos están faltantes en los datos del voucher
   * @param voucherData - Datos del voucher a validar
   * @returns Array de campos faltantes
   *
   * NOTA: Si hora fue asignada automáticamente (12:00:00), NO se marca como faltante
   */
  static identifyMissingFields(voucherData: VoucherData): string[] {
    const missingFields: string[] = [];

    if (!this.toSafeString(voucherData.monto)) {
      missingFields.push('monto');
    }
    if (!this.toSafeString(voucherData.fecha_pago)) {
      missingFields.push('fecha_pago');
    }
    // NO marcar hora como faltante si fue asignada automáticamente
    const horaAsignadaAutomaticamente = (voucherData as any).hora_asignada_automaticamente;
    if (!this.toSafeString(voucherData.hora_transaccion) && !horaAsignadaAutomaticamente) {
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
