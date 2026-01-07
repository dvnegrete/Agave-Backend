/**
 * Domain entity representing a single historical record row from Excel
 * Contains all the business logic for validating and processing Excel rows
 */
export class HistoricalRecordRow {
  constructor(
    public readonly fecha: Date,
    public readonly hora: string,
    public readonly concepto: string,
    public readonly deposito: number,
    public readonly casa: number,
    public readonly cuotaExtra: number,
    public readonly mantto: number,
    public readonly penalizacion: number,
    public readonly agua: number,
    public readonly rowNumber: number, // For error tracking
  ) {}

  /**
   * Factory method for creating domain entity
   */
  static create(params: {
    fecha: Date;
    hora: string;
    concepto: string;
    deposito: number;
    casa: number;
    cuotaExtra: number;
    mantto: number;
    penalizacion: number;
    agua: number;
    rowNumber: number;
  }): HistoricalRecordRow {
    return new HistoricalRecordRow(
      params.fecha,
      params.hora,
      params.concepto,
      params.deposito,
      params.casa,
      params.cuotaExtra,
      params.mantto,
      params.penalizacion,
      params.agua,
      params.rowNumber,
    );
  }

  /**
   * Business rule: Extract house number from deposit cents
   * If casa === 0, extract from deposit cents (e.g., 1542.42 → 42)
   */
  getIdentifiedHouseNumber(): number {
    if (this.casa > 0) {
      return this.casa;
    }

    // Extract cents from deposit (e.g., 1542.42 → 0.42 → 42)
    const cents = Math.round((this.deposito % 1) * 100);
    return cents;
  }

  /**
   * Business rule: Validate that floor(deposito) equals sum of cta_* amounts
   */
  isValidAmountDistribution(): boolean {
    const expectedTotal = Math.floor(this.deposito);
    const actualTotal = this.cuotaExtra + this.mantto + this.penalizacion + this.agua;
    // Allow small floating point errors
    return Math.abs(expectedTotal - actualTotal) < 0.01;
  }

  /**
   * Business rule: Casa = 0 means unidentified payment
   */
  isIdentifiedPayment(): boolean {
    return this.casa > 0;
  }

  /**
   * Extract year and month for Period lookup
   */
  getPeriodInfo(): { year: number; month: number } {
    return {
      year: this.fecha.getFullYear(),
      month: this.fecha.getMonth() + 1, // JavaScript months are 0-indexed
    };
  }

  /**
   * Get list of cta_* types that have amounts > 0
   */
  getActiveCtaTypes(): Array<{ type: string; amount: number }> {
    const types: Array<{ type: string; amount: number }> = [];

    if (this.cuotaExtra > 0) {
      types.push({ type: 'extraordinary_fee', amount: this.cuotaExtra });
    }
    if (this.mantto > 0) {
      types.push({ type: 'maintenance', amount: this.mantto });
    }
    if (this.penalizacion > 0) {
      types.push({ type: 'penalties', amount: this.penalizacion });
    }
    if (this.agua > 0) {
      types.push({ type: 'water', amount: this.agua });
    }

    return types;
  }

  /**
   * Validate all business rules
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate amount distribution
    if (!this.isValidAmountDistribution()) {
      const expectedTotal = Math.floor(this.deposito);
      const actualTotal = this.cuotaExtra + this.mantto + this.penalizacion + this.agua;
      errors.push(
        `Row ${this.rowNumber}: Amount mismatch - floor(${this.deposito}) != ${actualTotal}`,
      );
    }

    // Validate deposito is positive
    if (this.deposito <= 0) {
      errors.push(`Row ${this.rowNumber}: DEPOSITO must be positive, got ${this.deposito}`);
    }

    // Validate casa is not negative
    if (this.casa < 0) {
      errors.push(`Row ${this.rowNumber}: Casa cannot be negative, got ${this.casa}`);
    }

    // Validate at least one cta_* has amount > 0
    const activeCtaTypes = this.getActiveCtaTypes();
    if (activeCtaTypes.length === 0) {
      errors.push(`Row ${this.rowNumber}: At least one cta_* amount must be > 0`);
    }

    // Validate concepto is not empty
    if (!this.concepto || this.concepto.trim().length === 0) {
      errors.push(`Row ${this.rowNumber}: CONCEPTO cannot be empty`);
    }

    return { isValid: errors.length === 0, errors };
  }
}
