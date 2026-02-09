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

    // Usar queryRunner para atomicidad
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const period of sortedPeriods) {
        if (remainingCredit <= 0) break;

        // Verificar cuanto falta pagar en este periodo (solo mantenimiento)
        const periodStartDate =
          period.start_date instanceof Date
            ? period.start_date
            : new Date(period.start_date);
        const config =
          await this.periodConfigRepository.findActiveForDate(periodStartDate);
        if (!config) continue;

        const maintenanceExpected =
          await this.housePeriodOverrideRepository.getApplicableAmount(
            houseId,
            period.id,
            ConceptType.MAINTENANCE,
            config.default_maintenance_amount,
          );

        // Obtener lo ya pagado
        const existingAllocations =
          await this.recordAllocationRepository.findByHouseAndPeriod(
            houseId,
            period.id,
          );

        const maintenancePaid = existingAllocations
          .filter((a) => a.concept_type === AllocationConceptType.MAINTENANCE)
          .reduce((sum, a) => sum + a.allocated_amount, 0);

        const maintenancePending = Math.max(
          0,
          maintenanceExpected - maintenancePaid,
        );

        if (maintenancePending <= 0) continue;

        // Aplicar crédito
        const amountToApply = Math.min(remainingCredit, maintenancePending);
        const isComplete =
          Math.round(amountToApply * 100) / 100 >=
          Math.round(maintenancePending * 100) / 100;

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
            AllocationConceptType.MAINTENANCE,
            0, // concept_id 0 = crédito aplicado
            amountToApply,
            maintenanceExpected,
            isComplete ? PaymentStatus.COMPLETE : PaymentStatus.PARTIAL,
          ],
        );

        allocationsCreated.push({
          period_id: period.id,
          concept_type: AllocationConceptType.MAINTENANCE,
          allocated_amount: amountToApply,
          expected_amount: maintenanceExpected,
          is_complete: isComplete,
        });

        remainingCredit -= amountToApply;
        remainingCredit = Math.round(remainingCredit * 100) / 100;
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
        `Credito aplicado para casa ${houseId}: $${totalApplied} en ${allocationsCreated.length} periodos`,
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
}
