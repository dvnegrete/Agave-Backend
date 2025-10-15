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
 * Entidad que representa un voucher pendiente sin conciliar
 */
export class PendingVoucher {
  constructor(
    public readonly voucherId: number,
    public readonly amount: number,
    public readonly date: Date,
    public readonly reason: string,
  ) {}

  static fromVoucher(voucher: Voucher, reason: string): PendingVoucher {
    return new PendingVoucher(voucher.id, voucher.amount, voucher.date, reason);
  }
}

/**
 * Entidad que representa una transacción bancaria sobrante
 */
export class SurplusTransaction {
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
  ): SurplusTransaction {
    return new SurplusTransaction(
      transaction.id,
      transaction.amount,
      transaction.date,
      reason,
      requiresManualReview,
      houseNumber,
    );
  }
}

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
    public readonly pendientes: number,
    public readonly sobrantes: number,
    public readonly requiresManualValidation: number,
  ) {}

  static create(params: {
    totalProcessed: number;
    conciliados: number;
    pendientes: number;
    sobrantes: number;
    requiresManualValidation: number;
  }): ReconciliationSummary {
    return new ReconciliationSummary(
      params.totalProcessed,
      params.conciliados,
      params.pendientes,
      params.sobrantes,
      params.requiresManualValidation,
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
