import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AllocationConceptType } from '@/shared/database/entities/enums';
import { BatchUpdatePeriodChargesDto, BatchUpdateResultDto } from '../dto';
import { IHousePeriodChargeRepository } from '../interfaces';
import { EnsurePeriodExistsUseCase } from './ensure-period-exists.use-case';

@Injectable()
export class BatchUpdatePeriodChargesUseCase {
  private readonly logger = new Logger(BatchUpdatePeriodChargesUseCase.name);

  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly housePeriodChargeRepository: IHousePeriodChargeRepository,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
    private readonly dataSource: DataSource,
  ) {}

  async execute(dto: BatchUpdatePeriodChargesDto): Promise<BatchUpdateResultDto> {
    const months = this.generateMonthRange(dto);
    if (months.length === 0) {
      throw new BadRequestException(
        'El rango de fechas es inválido: el inicio debe ser anterior o igual al fin',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let periodsCreated = 0;
      const periodIds: number[] = [];

      // 1. Asegurar que todos los períodos existen
      for (const { year, month } of months) {
        const existed = await this.dataSource.query(
          'SELECT id FROM periods WHERE year = $1 AND month = $2',
          [year, month],
        );
        const period = await this.ensurePeriodExistsUseCase.execute(year, month);
        periodIds.push(period.id);
        if (!existed || existed.length === 0) {
          periodsCreated++;
        }
      }

      // 2. Actualizar flags en periods
      const waterActive =
        dto.amounts.water_amount !== undefined && dto.amounts.water_amount > 0;
      const extraordinaryActive =
        dto.amounts.extraordinary_fee_amount !== undefined &&
        dto.amounts.extraordinary_fee_amount > 0;

      await queryRunner.query(
        `UPDATE periods SET water_active = $1, extraordinary_fee_active = $2, updated_at = NOW()
         WHERE id = ANY($3::int[])`,
        [waterActive, extraordinaryActive, periodIds],
      );

      let chargesUpdated = 0;

      // 3. Upsert MAINTENANCE (siempre)
      const maintenanceCount =
        await this.housePeriodChargeRepository.upsertBatchForPeriods(
          periodIds,
          AllocationConceptType.MAINTENANCE,
          dto.amounts.maintenance_amount,
          'manual',
        );
      chargesUpdated += maintenanceCount;

      // 4. WATER
      if (dto.amounts.water_amount !== undefined) {
        if (dto.amounts.water_amount > 0) {
          const waterCount =
            await this.housePeriodChargeRepository.upsertBatchForPeriods(
              periodIds,
              AllocationConceptType.WATER,
              dto.amounts.water_amount,
              'manual',
            );
          chargesUpdated += waterCount;
        } else {
          await this.housePeriodChargeRepository.deleteByPeriodsAndConcept(
            periodIds,
            AllocationConceptType.WATER,
          );
        }
      }

      // 5. EXTRAORDINARY_FEE
      if (dto.amounts.extraordinary_fee_amount !== undefined) {
        if (dto.amounts.extraordinary_fee_amount > 0) {
          const extraCount =
            await this.housePeriodChargeRepository.upsertBatchForPeriods(
              periodIds,
              AllocationConceptType.EXTRAORDINARY_FEE,
              dto.amounts.extraordinary_fee_amount,
              'manual',
            );
          chargesUpdated += extraCount;
        } else {
          await this.housePeriodChargeRepository.deleteByPeriodsAndConcept(
            periodIds,
            AllocationConceptType.EXTRAORDINARY_FEE,
          );
        }
      }

      // 6. Check retroactive changes
      const retroCheck = await queryRunner.query(
        `SELECT EXISTS(SELECT 1 FROM record_allocations WHERE period_id = ANY($1::int[])) AS has_allocations`,
        [periodIds],
      );
      const hasRetroactiveChanges = retroCheck?.[0]?.has_allocations ?? false;

      await queryRunner.commitTransaction();

      this.logger.log(
        `Batch update: ${periodIds.length} periods, ${chargesUpdated} charges, retroactive=${hasRetroactiveChanges}`,
      );

      return {
        periods_affected: periodIds.length,
        periods_created: periodsCreated,
        charges_updated: chargesUpdated,
        has_retroactive_changes: hasRetroactiveChanges,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private generateMonthRange(
    dto: BatchUpdatePeriodChargesDto,
  ): { year: number; month: number }[] {
    const result: { year: number; month: number }[] = [];
    let year = dto.start_year;
    let month = dto.start_month;

    const endValue = dto.end_year * 12 + dto.end_month;

    while (year * 12 + month <= endValue) {
      result.push({ year, month });
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return result;
  }
}
