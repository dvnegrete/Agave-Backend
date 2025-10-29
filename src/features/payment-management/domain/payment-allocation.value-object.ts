/**
 * Value Object que representa la distribución de un pago
 */

export enum AllocationConceptType {
  MAINTENANCE = 'maintenance',
  WATER = 'water',
  EXTRAORDINARY_FEE = 'extraordinary_fee',
  PENALTIES = 'penalties',
  OTHER = 'other',
}

export enum PaymentStatus {
  COMPLETE = 'complete',
  PARTIAL = 'partial',
  OVERPAID = 'overpaid',
}

export class PaymentAllocation {
  constructor(
    public readonly recordId: number,
    public readonly houseId: number,
    public readonly periodId: number,
    public readonly conceptType: AllocationConceptType,
    public readonly conceptId: number,
    public readonly allocatedAmount: number,
    public readonly expectedAmount: number,
    public readonly paymentStatus: PaymentStatus,
  ) {}

  static create(params: {
    recordId: number;
    houseId: number;
    periodId: number;
    conceptType: AllocationConceptType;
    conceptId: number;
    allocatedAmount: number;
    expectedAmount: number;
  }): PaymentAllocation {
    const status = PaymentAllocation.calculateStatus(
      params.allocatedAmount,
      params.expectedAmount,
    );

    return new PaymentAllocation(
      params.recordId,
      params.houseId,
      params.periodId,
      params.conceptType,
      params.conceptId,
      params.allocatedAmount,
      params.expectedAmount,
      status,
    );
  }

  private static calculateStatus(
    allocated: number,
    expected: number,
  ): PaymentStatus {
    if (allocated >= expected) {
      return PaymentStatus.COMPLETE;
    }
    if (allocated < expected && allocated > 0) {
      return PaymentStatus.PARTIAL;
    }
    return PaymentStatus.OVERPAID;
  }

  /**
   * Obtiene el saldo pendiente (positivo) o excedente (negativo)
   */
  getBalance(): number {
    return this.expectedAmount - this.allocatedAmount;
  }

  /**
   * Verifica si el pago está completo
   */
  isComplete(): boolean {
    return this.paymentStatus === PaymentStatus.COMPLETE;
  }

  /**
   * Verifica si hay sobrepago
   */
  hasOverpayment(): boolean {
    return this.allocatedAmount > this.expectedAmount;
  }

  /**
   * Obtiene el monto de sobrepago
   */
  getOverpaymentAmount(): number {
    return this.hasOverpayment()
      ? this.allocatedAmount - this.expectedAmount
      : 0;
  }
}
