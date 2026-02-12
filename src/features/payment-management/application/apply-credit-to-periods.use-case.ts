import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AllocationConceptType,
  ConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';
import {
  IRecordAllocationRepository,
  IPeriodRepository,
  IPeriodConfigRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
  IHousePeriodChargeRepository,
} from '../interfaces';
import {
  CreditApplicationResult,
  CreditAllocationDetail,
} from '../domain/credit-application.types';

@Injectable()
export class ApplyCreditToPeriodsUseCase {
  private readonly logger = new Logger(ApplyCreditToPeriodsUseCase.name);

  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
    @Inject('IHouseBalanceRepository')
    private readonly houseBalanceRepository: IHouseBalanceRepository,
    @Inject('IHousePeriodOverrideRepository')
    private readonly housePeriodOverrideRepository: IHousePeriodOverrideRepository,
    @Inject('IHousePeriodChargeRepository')
    private readonly housePeriodChargeRepository: IHousePeriodChargeRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(houseId: number): Promise<CreditApplicationResult> {
    const balance = await this.houseBalanceRepository.getOrCreate(houseId);

    if (balance.credit_balance <= 0) {
      return {
        house_id: houseId,
        credit_before: balance.credit_balance,
        credit_after: balance.credit_balance,
        total_applied: 0,
        allocations_created: [],
        periods_covered: 0,
        periods_partially_covered: 0,
      };
    }

    const creditBefore = balance.credit_balance;
    let remainingCredit = balance.credit_balance;
    const allocationsCreated: CreditAllocationDetail[] = [];

    // Obtener todos los periodos ordenados ASC
    const allPeriods = await this.periodRepository.findAll();
    const sortedPeriods = [...allPeriods].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );

    // Orden de prioridad de conceptos
    const conceptOrder: AllocationConceptType[] = [
      AllocationConceptType.MAINTENANCE,
      AllocationConceptType.WATER,
      AllocationConceptType.EXTRAORDINARY_FEE,
      AllocationConceptType.PENALTIES,
    ];

    // Usar queryRunner para atomicidad
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const period of sortedPeriods) {
        if (remainingCredit <= 0) break;

        // Obtener cargos de house_period_charges
        const charges =
          await this.housePeriodChargeRepository.findByHouseAndPeriod(
            houseId,
            period.id,
          );

        // Si no hay charges, usar fallback legacy (solo MAINTENANCE)
        const concepts =
          charges.length > 0
            ? charges
                .map((c) => ({
                  type: c.concept_type as AllocationConceptType,
                  expectedAmount: c.expected_amount,
                }))
                .sort((a, b) => {
                  const idxA = conceptOrder.indexOf(a.type);
                  const idxB = conceptOrder.indexOf(b.type);
                  return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                })
            : await this.getLegacyMaintenanceConcept(houseId, period);

        // Obtener lo ya pagado
        const existingAllocations =
          await this.recordAllocationRepository.findByHouseAndPeriod(
            houseId,
            period.id,
          );

        for (const concept of concepts) {
          if (remainingCredit <= 0) break;

          const alreadyPaid = existingAllocations
            .filter((a) => a.concept_type === concept.type)
            .reduce((sum, a) => sum + a.allocated_amount, 0);

          const pending = Math.max(
            0,
            Math.round((concept.expectedAmount - alreadyPaid) * 100) / 100,
          );

          if (pending <= 0) continue;

          const amountToApply = Math.min(remainingCredit, pending);
          const totalPaidAfter = alreadyPaid + amountToApply;
          const isComplete =
            Math.round(totalPaidAfter * 100) / 100 >=
            Math.round(concept.expectedAmount * 100) / 100;

          // Crear allocation usando queryRunner directamente
          await queryRunner.query(
            `INSERT INTO "record_allocations" (
              "record_id", "house_id", "period_id", "concept_type",
              "concept_id", "allocated_amount", "expected_amount", "payment_status"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              0, // record_id 0 = crédito del sistema
              houseId,
              period.id,
              concept.type,
              0, // concept_id 0 = crédito aplicado
              amountToApply,
              concept.expectedAmount,
              isComplete ? PaymentStatus.COMPLETE : PaymentStatus.PARTIAL,
            ],
          );

          allocationsCreated.push({
            period_id: period.id,
            concept_type: concept.type,
            allocated_amount: amountToApply,
            expected_amount: concept.expectedAmount,
            is_complete: isComplete,
          });

          remainingCredit -= amountToApply;
          remainingCredit = Math.round(remainingCredit * 100) / 100;
        }
      }

      // Actualizar balance
      await queryRunner.query(
        `UPDATE "house_balances" SET "credit_balance" = $1 WHERE "house_id" = $2`,
        [remainingCredit, houseId],
      );

      await queryRunner.commitTransaction();

      const totalApplied = creditBefore - remainingCredit;
      const periodsCovered = allocationsCreated.filter(
        (a) => a.is_complete,
      ).length;
      const periodsPartial = allocationsCreated.filter(
        (a) => !a.is_complete,
      ).length;

      this.logger.log(
        `Credito aplicado para casa ${houseId}: $${totalApplied} en ${allocationsCreated.length} conceptos`,
      );

      return {
        house_id: houseId,
        credit_before: creditBefore,
        credit_after: remainingCredit,
        total_applied: Math.round(totalApplied * 100) / 100,
        allocations_created: allocationsCreated,
        periods_covered: periodsCovered,
        periods_partially_covered: periodsPartial,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error aplicando credito para casa ${houseId}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Fallback legacy: obtener solo concepto MAINTENANCE cuando no hay house_period_charges
   */
  private async getLegacyMaintenanceConcept(
    houseId: number,
    period: any,
  ): Promise<Array<{ type: AllocationConceptType; expectedAmount: number }>> {
    const periodStartDate =
      period.start_date instanceof Date
        ? period.start_date
        : new Date(period.start_date);
    const config =
      await this.periodConfigRepository.findActiveForDate(periodStartDate);
    if (!config) return [];

    const maintenanceExpected =
      await this.housePeriodOverrideRepository.getApplicableAmount(
        houseId,
        period.id,
        ConceptType.MAINTENANCE,
        config.default_maintenance_amount,
      );

    return [
      {
        type: AllocationConceptType.MAINTENANCE,
        expectedAmount: maintenanceExpected,
      },
    ];
  }
}
