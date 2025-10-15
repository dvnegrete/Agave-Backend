import { Injectable } from '@nestjs/common';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { ReconciliationConfig } from '../../config/reconciliation.config';
import {
  getDateDifferenceInHours,
  extractHouseNumberFromCents,
} from '@/shared/common/utils';
import {
  ReconciliationMatch,
  SurplusTransaction,
  ManualValidationCase,
  ConfidenceLevel,
  MatchCriteria,
} from '../../domain';

export type MatchResult =
  | { type: 'matched'; match: ReconciliationMatch; voucherId: number }
  | { type: 'surplus'; surplus: SurplusTransaction }
  | { type: 'manual'; case: ManualValidationCase };

/**
 * Servicio de infraestructura para matching de transacciones con vouchers
 * Implementa la lógica de coincidencias basada en reglas de negocio
 */
@Injectable()
export class MatchingService {
  /**
   * Intenta encontrar coincidencias para una transacción bancaria
   */
  matchTransaction(
    transaction: TransactionBank,
    availableVouchers: Voucher[],
    processedVoucherIds: Set<number>,
  ): MatchResult {
    // 1. Buscar coincidencias por monto exacto
    const amountMatches = this.filterByAmount(
      transaction,
      availableVouchers,
      processedVoucherIds,
    );

    // Si hay una sola coincidencia por monto, conciliar automáticamente
    if (amountMatches.length === 1) {
      return this.createSingleMatch(transaction, amountMatches[0]);
    }

    // Si hay múltiples coincidencias, filtrar por fecha
    if (amountMatches.length > 1) {
      return this.resolveMultipleMatches(transaction, amountMatches);
    }

    // No hay coincidencias con vouchers, intentar identificar por centavos
    return this.handleNoVoucherMatch(transaction);
  }

  /**
   * Filtra vouchers por monto exacto
   */
  private filterByAmount(
    transaction: TransactionBank,
    vouchers: Voucher[],
    processedIds: Set<number>,
  ): Voucher[] {
    return vouchers.filter(
      (v) =>
        Math.abs(v.amount - transaction.amount) < 0.01 &&
        !processedIds.has(v.id),
    );
  }

  /**
   * Crea un match cuando hay una sola coincidencia
   */
  private createSingleMatch(
    transaction: TransactionBank,
    voucher: Voucher,
  ): MatchResult {
    const dateDiff = getDateDifferenceInHours(
      transaction.date,
      transaction.time,
      voucher.date,
    );

    const houseNumber = extractHouseNumberFromCents(transaction.amount);

    const match = ReconciliationMatch.create({
      transaction,
      voucher,
      houseNumber,
      matchCriteria: [MatchCriteria.AMOUNT],
      confidenceLevel: ConfidenceLevel.HIGH,
      dateDifferenceHours: dateDiff,
    });

    return { type: 'matched', match, voucherId: voucher.id };
  }

  /**
   * Resuelve el caso de múltiples coincidencias por monto
   */
  private resolveMultipleMatches(
    transaction: TransactionBank,
    matches: Voucher[],
  ): MatchResult {
    // Calcular diferencias de fecha y ordenar por más cercano
    const matchesWithDateDiff = matches
      .map((voucher) => ({
        voucher,
        dateDiff: getDateDifferenceInHours(
          transaction.date,
          transaction.time,
          voucher.date,
        ),
      }))
      .filter((m) => m.dateDiff <= ReconciliationConfig.DATE_TOLERANCE_HOURS)
      .sort((a, b) => a.dateDiff - b.dateDiff);

    // Si hay una sola coincidencia dentro de tolerancia de fecha
    if (matchesWithDateDiff.length === 1) {
      const { voucher, dateDiff } = matchesWithDateDiff[0];
      const houseNumber = extractHouseNumberFromCents(transaction.amount);

      const match = ReconciliationMatch.create({
        transaction,
        voucher,
        houseNumber,
        matchCriteria: [MatchCriteria.AMOUNT, MatchCriteria.DATE],
        confidenceLevel: ConfidenceLevel.HIGH,
        dateDifferenceHours: dateDiff,
      });

      return { type: 'matched', match, voucherId: voucher.id };
    }

    // Múltiples coincidencias aún → validación manual
    if (matchesWithDateDiff.length > 1) {
      const manualCase = ManualValidationCase.create({
        transaction,
        possibleMatches: matchesWithDateDiff.map((m) => ({
          voucher: m.voucher,
          dateDifferenceHours: m.dateDiff,
          similarityScore:
            1 - m.dateDiff / ReconciliationConfig.DATE_TOLERANCE_HOURS,
        })),
        reason: 'Multiple vouchers with same amount and similar dates',
      });

      return { type: 'manual', case: manualCase };
    }

    // Sin coincidencias dentro de tolerancia
    return this.handleNoVoucherMatch(transaction);
  }

  /**
   * Maneja el caso donde no hay voucher coincidente
   */
  private handleNoVoucherMatch(transaction: TransactionBank): MatchResult {
    const houseNumber = extractHouseNumberFromCents(transaction.amount);

    // Verificar si tiene centavos válidos
    if (
      houseNumber > 0 &&
      houseNumber <= ReconciliationConfig.MAX_HOUSE_NUMBER
    ) {
      const surplus = SurplusTransaction.fromTransaction(
        transaction,
        `No voucher found, house ${houseNumber} identified by cents`,
        true,
        houseNumber,
      );

      return { type: 'surplus', surplus };
    }

    // Sin centavos válidos → voucher obligatorio
    const reason = ReconciliationConfig.REQUIRE_VOUCHER_FOR_NO_CENTS
      ? 'No voucher found and no valid cents to identify house (voucher required)'
      : 'No voucher found and no cents to identify house';

    const surplus = SurplusTransaction.fromTransaction(
      transaction,
      reason,
      true,
      houseNumber,
    );

    return { type: 'surplus', surplus };
  }
}
