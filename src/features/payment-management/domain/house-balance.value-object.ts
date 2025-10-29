/**
 * Value Object que representa el balance financiero de una casa
 */

export class HouseBalanceVO {
  constructor(
    public readonly houseId: number,
    public readonly accumulatedCents: number,
    public readonly creditBalance: number,
    public readonly debitBalance: number,
  ) {
    // Validar que accumulated_cents esté en rango válido
    if (accumulatedCents < 0 || accumulatedCents >= 1) {
      throw new Error(
        'accumulated_cents debe estar entre 0.00 y 0.99 (solo decimales)',
      );
    }
  }

  static create(params: {
    houseId: number;
    accumulatedCents?: number;
    creditBalance?: number;
    debitBalance?: number;
  }): HouseBalanceVO {
    return new HouseBalanceVO(
      params.houseId,
      params.accumulatedCents ?? 0,
      params.creditBalance ?? 0,
      params.debitBalance ?? 0,
    );
  }

  /**
   * Añade centavos al acumulado
   */
  addCents(amount: number): HouseBalanceVO {
    const newCents = this.accumulatedCents + amount;
    // Mantener solo la parte decimal
    const onlyDecimals = newCents - Math.floor(newCents);

    return new HouseBalanceVO(
      this.houseId,
      onlyDecimals,
      this.creditBalance,
      this.debitBalance,
    );
  }

  /**
   * Aplica centavos acumulados y retorna cuántos pesos enteros se pueden aplicar
   */
  applyCents(): { wholePesos: number; remainingCents: number } {
    const wholePesos = Math.floor(this.accumulatedCents);
    const remainingCents = this.accumulatedCents - wholePesos;

    return { wholePesos, remainingCents };
  }

  /**
   * Añade saldo a favor
   */
  addCredit(amount: number): HouseBalanceVO {
    return new HouseBalanceVO(
      this.houseId,
      this.accumulatedCents,
      this.creditBalance + amount,
      this.debitBalance,
    );
  }

  /**
   * Añade deuda
   */
  addDebit(amount: number): HouseBalanceVO {
    return new HouseBalanceVO(
      this.houseId,
      this.accumulatedCents,
      this.creditBalance,
      this.debitBalance + amount,
    );
  }

  /**
   * Calcula el balance neto
   */
  getNetBalance(): number {
    return this.creditBalance - this.debitBalance;
  }

  /**
   * Verifica si la casa tiene deudas
   */
  hasDebt(): boolean {
    return this.debitBalance > 0;
  }

  /**
   * Verifica si la casa tiene saldo a favor
   */
  hasCredit(): boolean {
    return this.creditBalance > 0;
  }
}
