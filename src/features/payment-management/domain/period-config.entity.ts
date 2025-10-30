/**
 * Entidad de dominio para Configuración de Período
 * Contiene las reglas y montos default para un rango de fechas
 */

export class PeriodConfigDomain {
  constructor(
    public readonly id: number,
    public readonly defaultMaintenanceAmount: number,
    public readonly defaultWaterAmount: number | null,
    public readonly defaultExtraordinaryFeeAmount: number | null,
    public readonly paymentDueDay: number,
    public readonly latePaymentPenaltyAmount: number,
    public readonly effectiveFrom: Date,
    public readonly effectiveUntil: Date | null,
    public readonly isActive: boolean,
  ) {}

  static create(params: {
    id: number;
    defaultMaintenanceAmount: number;
    defaultWaterAmount?: number;
    defaultExtraordinaryFeeAmount?: number;
    paymentDueDay: number;
    latePaymentPenaltyAmount: number;
    effectiveFrom: Date;
    effectiveUntil?: Date;
    isActive?: boolean;
  }): PeriodConfigDomain {
    return new PeriodConfigDomain(
      params.id,
      params.defaultMaintenanceAmount,
      params.defaultWaterAmount ?? null,
      params.defaultExtraordinaryFeeAmount ?? null,
      params.paymentDueDay,
      params.latePaymentPenaltyAmount,
      params.effectiveFrom,
      params.effectiveUntil ?? null,
      params.isActive ?? true,
    );
  }

  /**
   * Verifica si esta configuración es aplicable para una fecha dada
   */
  isApplicableFor(date: Date): boolean {
    if (!this.isActive) return false;

    const isAfterStart = date >= this.effectiveFrom;
    const isBeforeEnd = !this.effectiveUntil || date <= this.effectiveUntil;

    return isAfterStart && isBeforeEnd;
  }

  /**
   * Verifica si un día del mes está retrasado según la configuración
   */
  isLatePayment(dayOfMonth: number): boolean {
    return dayOfMonth > this.paymentDueDay;
  }

  /**
   * Obtiene el monto default para un tipo de concepto
   */
  getDefaultAmount(conceptType: string): number | null {
    switch (conceptType) {
      case 'maintenance':
        return this.defaultMaintenanceAmount;
      case 'water':
        return this.defaultWaterAmount;
      case 'extraordinary_fee':
        return this.defaultExtraordinaryFeeAmount;
      default:
        return null;
    }
  }
}
