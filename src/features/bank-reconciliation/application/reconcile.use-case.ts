import { Injectable, Logger } from '@nestjs/common';
import { MatchingService } from '../infrastructure/matching/matching.service';
import { ReconciliationPersistenceService } from '../infrastructure/persistence/reconciliation-persistence.service';
import { ReconciliationDataService } from '../infrastructure/persistence/reconciliation-data.service';
import {
  ReconciliationMatch,
  PendingVoucher,
  SurplusTransaction,
  ManualValidationCase,
  ReconciliationSummary,
} from '../domain';
import { extractHouseNumberFromCents } from '@/shared/common/utils';

export interface ReconcileInput {
  startDate?: Date;
  endDate?: Date;
}

export interface ReconcileOutput {
  summary: ReconciliationSummary;
  conciliados: ReconciliationMatch[];
  pendientes: PendingVoucher[];
  sobrantes: SurplusTransaction[];
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
    const sobrantes: SurplusTransaction[] = [];
    const manualValidationRequired: ManualValidationCase[] = [];
    const processedVoucherIds = new Set<number>();

    for (const transaction of pendingTransactions) {
      const matchResult = this.matchingService.matchTransaction(
        transaction,
        pendingVouchers,
        processedVoucherIds,
      );

      if (matchResult.type === 'matched') {
        // Persistir conciliación
        try {
          await this.persistenceService.persistReconciliation(
            matchResult.match.transactionBankId,
            matchResult.voucherId,
            matchResult.match.houseNumber,
          );

          conciliados.push(matchResult.match);
          processedVoucherIds.add(matchResult.voucherId);
        } catch (error) {
          this.logger.error(
            `Error al persistir conciliación para transaction ${matchResult.match.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // En caso de error, marcar como sobrante
          const houseNumber = extractHouseNumberFromCents(transaction.amount);
          sobrantes.push(
            SurplusTransaction.fromTransaction(
              transaction,
              `Error durante persistencia: ${error instanceof Error ? error.message : 'Unknown error'}`,
              true,
              houseNumber,
            ),
          );
        }
      } else if (matchResult.type === 'manual') {
        manualValidationRequired.push(matchResult.case);
      } else if (matchResult.type === 'surplus') {
        sobrantes.push(matchResult.surplus);
      }
    }

    // 3. Identificar vouchers pendientes sin conciliar
    const pendientesList = pendingVouchers
      .filter((voucher) => !processedVoucherIds.has(voucher.id))
      .map((voucher) =>
        PendingVoucher.fromVoucher(
          voucher,
          'No matching bank transaction found',
        ),
      );

    // 4. Generar resumen
    const summary = ReconciliationSummary.create({
      totalProcessed: pendingTransactions.length,
      conciliados: conciliados.length,
      pendientes: pendientesList.length,
      sobrantes: sobrantes.length,
      requiresManualValidation: manualValidationRequired.length,
    });

    this.logger.log(`Conciliación completada. Resumen:`);
    this.logger.log(`  - Conciliados: ${conciliados.length}`);
    this.logger.log(`  - Pendientes: ${pendientesList.length}`);
    this.logger.log(`  - Sobrantes: ${sobrantes.length}`);
    this.logger.log(
      `  - Requieren validación manual: ${manualValidationRequired.length}`,
    );

    return {
      summary,
      conciliados,
      pendientes: pendientesList,
      sobrantes,
      manualValidationRequired,
    };
  }
}
