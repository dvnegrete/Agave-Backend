/**
 * Entidades de dominio para el proceso de conciliación bancaria
 * Representan conceptos de negocio puros sin dependencias de infraestructura
 */

import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';

export enum ConfidenceLevel {
  HIGH = 'high', // Monto + fecha cercana + voucher único
  MEDIUM = 'medium', // Monto exacto pero múltiples candidatos
  LOW = 'low', // Solo identificado por centavos sin voucher
  MANUAL = 'manual', // Requiere revisión humana
}

export enum MatchCriteria {
  AMOUNT = 'amount',
  DATE = 'date',
  CONCEPT = 'concept',
}

/**
 * Entidad que representa el resultado de una conciliación exitosa
 */
export class ReconciliationMatch {
  constructor(
    public readonly transactionBankId: string,
    public readonly amount: number,
    public readonly houseNumber: number,
    public readonly matchCriteria: MatchCriteria[],
    public readonly confidenceLevel: ConfidenceLevel,
    public readonly voucherId?: number,
    public readonly dateDifferenceHours?: number,
  ) {}

  static create(params: {
    transaction: TransactionBank;
    voucher?: Voucher;
    houseNumber: number;
    matchCriteria: MatchCriteria[];
    confidenceLevel: ConfidenceLevel;
    dateDifferenceHours?: number;
  }): ReconciliationMatch {
    return new ReconciliationMatch(
      params.transaction.id,
      params.transaction.amount,
      params.houseNumber,
      params.matchCriteria,
      params.confidenceLevel,
      params.voucher?.id,
      params.dateDifferenceHours,
    );
  }

  hasVoucher(): boolean {
    return this.voucherId !== undefined;
  }

  isHighConfidence(): boolean {
    return this.confidenceLevel === ConfidenceLevel.HIGH;
  }
}

/**
 * Entidad que representa un voucher sin fondos correspondientes
 * (Voucher exists but matching bank transaction does not)
 */
export class UnfundedVoucher {
  constructor(
    public readonly voucherId: number,
    public readonly amount: number,
    public readonly date: Date,
    public readonly reason: string,
  ) {}

  static fromVoucher(voucher: Voucher, reason: string): UnfundedVoucher {
    return new UnfundedVoucher(
      voucher.id,
      voucher.amount,
      voucher.date,
      reason,
    );
  }
}

// Legacy alias for backwards compatibility
export const PendingVoucher = UnfundedVoucher;

/**
 * Entidad que representa un depósito bancario no reclamado
 * (Bank transaction exists but matching voucher does not)
 */
export class UnclaimedDeposit {
  constructor(
    public readonly transactionBankId: string,
    public readonly amount: number,
    public readonly date: Date,
    public readonly reason: string,
    public readonly requiresManualReview: boolean,
    public readonly houseNumber?: number,
  ) {}

  static fromTransaction(
    transaction: TransactionBank,
    reason: string,
    requiresManualReview = true,
    houseNumber?: number,
  ): UnclaimedDeposit {
    return new UnclaimedDeposit(
      transaction.id,
      transaction.amount,
      transaction.date,
      reason,
      requiresManualReview,
      houseNumber,
    );
  }
}

// Legacy alias for backwards compatibility
export const SurplusTransaction = UnclaimedDeposit;

/**
 * Entidad que representa un caso que requiere validación manual
 */
export class ManualValidationCase {
  constructor(
    public readonly transactionBankId: string,
    public readonly possibleMatches: Array<{
      voucherId: number;
      similarity: number;
      dateDifferenceHours: number;
    }>,
    public readonly reason: string,
  ) {}

  static create(params: {
    transaction: TransactionBank;
    possibleMatches: Array<{
      voucher: Voucher;
      dateDifferenceHours: number;
      similarityScore: number;
    }>;
    reason: string;
  }): ManualValidationCase {
    return new ManualValidationCase(
      params.transaction.id,
      params.possibleMatches.map((m) => ({
        voucherId: m.voucher.id,
        similarity: m.similarityScore,
        dateDifferenceHours: m.dateDifferenceHours,
      })),
      params.reason,
    );
  }

  hasMultipleOptions(): boolean {
    return this.possibleMatches.length > 1;
  }
}

/**
 * Value Object que encapsula el resumen de la conciliación
 */
export class ReconciliationSummary {
  constructor(
    public readonly totalProcessed: number,
    public readonly conciliados: number,
    public readonly unfundedVouchers: number,
    public readonly unclaimedDeposits: number,
    public readonly requiresManualValidation: number,
    public readonly crossMatched: number = 0,
  ) {}

  static create(params: {
    totalProcessed: number;
    conciliados: number;
    unfundedVouchers: number;
    unclaimedDeposits: number;
    requiresManualValidation: number;
    crossMatched?: number;
  }): ReconciliationSummary {
    return new ReconciliationSummary(
      params.totalProcessed,
      params.conciliados,
      params.unfundedVouchers,
      params.unclaimedDeposits,
      params.requiresManualValidation,
      params.crossMatched || 0,
    );
  }

  getSuccessRate(): number {
    if (this.totalProcessed === 0) return 0;
    return Math.round((this.conciliados / this.totalProcessed) * 100);
  }

  hasManualReview(): boolean {
    return this.requiresManualValidation > 0;
  }
}
