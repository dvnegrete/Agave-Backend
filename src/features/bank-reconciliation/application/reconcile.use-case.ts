import { Injectable, Logger } from '@nestjs/common';
import { MatchingService } from '../infrastructure/matching/matching.service';
import { ReconciliationPersistenceService } from '../infrastructure/persistence/reconciliation-persistence.service';
import { ReconciliationDataService } from '../infrastructure/persistence/reconciliation-data.service';
import {
  ReconciliationMatch,
  UnfundedVoucher,
  UnclaimedDeposit,
  ManualValidationCase,
  ReconciliationSummary,
  MatchCriteria,
  ConfidenceLevel,
} from '../domain';
import { extractHouseNumberFromCents } from '@/shared/common/utils';

export interface ReconcileInput {
  startDate?: Date;
  endDate?: Date;
}

export interface ReconcileOutput {
  summary: ReconciliationSummary;
  conciliados: ReconciliationMatch[];
  unfundedVouchers: UnfundedVoucher[];
  unclaimedDeposits: UnclaimedDeposit[];
  manualValidationRequired: ManualValidationCase[];
}

/**
 * Use Case: Ejecutar proceso de conciliación bancaria
 *
 * Responsabilidades:
 * - Obtener transacciones bancarias y vouchers pendientes
 * - Realizar matching usando el servicio de matching
 * - Persistir conciliaciones exitosas
 * - Identificar vouchers pendientes y transacciones sobrantes
 * - Generar resumen de resultados
 */
@Injectable()
export class ReconcileUseCase {
  private readonly logger = new Logger(ReconcileUseCase.name);

  constructor(
    private readonly dataService: ReconciliationDataService,
    private readonly matchingService: MatchingService,
    private readonly persistenceService: ReconciliationPersistenceService,
  ) {}

  async execute(input: ReconcileInput): Promise<ReconcileOutput> {
    this.logger.log('Iniciando proceso de conciliación bancaria...');

    const { startDate, endDate } = input;

    // 1. Obtener datos pendientes
    const pendingTransactions = await this.dataService.getPendingTransactions(
      startDate,
      endDate,
    );

    const pendingVouchers = await this.dataService.getPendingVouchers(
      startDate,
      endDate,
    );

    this.logger.log(
      `Transacciones bancarias pendientes: ${pendingTransactions.length}`,
    );
    this.logger.log(`Vouchers pendientes: ${pendingVouchers.length}`);

    // 2. Realizar proceso de matching
    const conciliados: ReconciliationMatch[] = [];
    const unclaimedDeposits: UnclaimedDeposit[] = [];
    const manualValidationRequired: ManualValidationCase[] = [];
    const processedVoucherIds = new Set<number>();

    for (const transaction of pendingTransactions) {
      const matchResult = await this.matchingService.matchTransaction(
        transaction,
        pendingVouchers,
        processedVoucherIds,
      );

      if (matchResult.type === 'matched') {
        // Persistir conciliación con voucher
        try {
          await this.persistenceService.persistReconciliation(
            matchResult.match.transactionBankId,
            matchResult.voucher,
            matchResult.match.houseNumber,
          );

          conciliados.push(matchResult.match);
          processedVoucherIds.add(matchResult.voucherId);
        } catch (error) {
          this.logger.error(
            `Error al persistir conciliación para transaction ${matchResult.match.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // En caso de error, marcar como depósito no reclamado
          const houseNumber = extractHouseNumberFromCents(transaction.amount);
          unclaimedDeposits.push(
            UnclaimedDeposit.fromTransaction(
              transaction,
              `Error durante persistencia: ${error instanceof Error ? error.message : 'Unknown error'}`,
              true,
              houseNumber,
            ),
          );
        }
      } else if (matchResult.type === 'surplus') {
        // Distinguir entre surplus conciliados automáticamente vs sobrantes
        if (!matchResult.surplus.requiresManualReview) {
          // ✅ Conciliado automáticamente (sin voucher, por centavos/concepto)
          try {
            await this.persistenceService.persistReconciliation(
              matchResult.surplus.transactionBankId,
              null, // Sin voucher
              matchResult.surplus.houseNumber!,
            );

            // Crear ReconciliationMatch para agregarlo a conciliados
            const match = ReconciliationMatch.create({
              transaction,
              voucher: undefined,
              houseNumber: matchResult.surplus.houseNumber!,
              matchCriteria: [MatchCriteria.CONCEPT], // Identificado por centavos o concepto
              confidenceLevel: ConfidenceLevel.MEDIUM,
            });

            conciliados.push(match);
            this.logger.log(
              `Conciliado automáticamente sin voucher: Transaction ${transaction.id} → Casa ${matchResult.surplus.houseNumber}`,
            );
          } catch (error) {
            this.logger.error(
              `Error al persistir conciliación automática para transaction ${matchResult.surplus.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            // En caso de error, marcar como depósito no reclamado que requiere revisión
            unclaimedDeposits.push(
              UnclaimedDeposit.fromTransaction(
                transaction,
                `Error durante persistencia automática: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true,
                matchResult.surplus.houseNumber,
              ),
            );
          }
        } else {
          // ⚠️ Depósito no reclamado que requiere validación manual
          // ✅ Persistir en BD para tracking
          try {
            await this.persistenceService.persistSurplus(
              matchResult.surplus.transactionBankId,
              matchResult.surplus,
            );
            this.logger.log(
              `Depósito no reclamado persistido: Transaction ${matchResult.surplus.transactionBankId}, Razón: ${matchResult.surplus.reason}`,
            );
          } catch (error) {
            this.logger.error(
              `Error al persistir depósito no reclamado para transaction ${matchResult.surplus.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            // Continuar de todos modos, agregar a lista de depósitos no reclamados
          }
          unclaimedDeposits.push(matchResult.surplus);
        }
      } else if (matchResult.type === 'manual') {
        // ✅ NUEVO: Persistir casos manuales en BD
        try {
          await this.persistenceService.persistManualValidationCase(
            matchResult.case.transactionBankId,
            matchResult.case,
          );
          this.logger.log(
            `Caso manual persistido: Transaction ${matchResult.case.transactionBankId}, Candidatos: ${matchResult.case.possibleMatches.length}`,
          );
        } catch (error) {
          this.logger.error(
            `Error al persistir caso manual para transaction ${matchResult.case.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // Continuar de todos modos, agregar a lista de manuales
        }
        manualValidationRequired.push(matchResult.case);
      }
    }

    // 3. Identificar vouchers sin fondos (sin conciliar)
    const unfundedVouchersList = pendingVouchers
      .filter((voucher) => !processedVoucherIds.has(voucher.id))
      .map((voucher) =>
        UnfundedVoucher.fromVoucher(
          voucher,
          'No matching bank transaction found',
        ),
      );

    // 4. Generar resumen
    const summary = ReconciliationSummary.create({
      totalProcessed: pendingTransactions.length,
      conciliados: conciliados.length,
      unfundedVouchers: unfundedVouchersList.length,
      unclaimedDeposits: unclaimedDeposits.length,
      requiresManualValidation: manualValidationRequired.length,
    });

    this.logger.log(`Conciliación completada. Resumen:`);
    this.logger.log(`  - Conciliados: ${conciliados.length}`);
    this.logger.log(`  - Vouchers sin fondos: ${unfundedVouchersList.length}`);
    this.logger.log(`  - Depósitos no reclamados: ${unclaimedDeposits.length}`);
    this.logger.log(
      `  - Requieren validación manual: ${manualValidationRequired.length}`,
    );

    return {
      summary,
      conciliados,
      unfundedVouchers: unfundedVouchersList,
      unclaimedDeposits,
      manualValidationRequired,
    };
  }
}
