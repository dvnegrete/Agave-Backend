import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  IRecordAllocationRepository,
  IHousePeriodChargeRepository,
} from '../interfaces';
import { AllocatePaymentUseCase } from './allocate-payment.use-case';
import { EnsurePeriodExistsUseCase } from './ensure-period-exists.use-case';
import { ApplyCreditToPeriodsUseCase } from './apply-credit-to-periods.use-case';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { HouseStatusSnapshotService } from '../infrastructure/services/house-status-snapshot.service';
import {
  BackfillAllocationsResponseDto,
  BackfillRecordResultDto,
} from '../dto/backfill-allocations.dto';

interface OrphanRecord {
  record_id: number;
  house_id: number;
  house_number: number;
  transaction_date: string;
  amount: number;
}

/**
 * Use case para backfill de record_allocations en records confirmados.
 *
 * Modo global (sin houseNumber): idempotente. Solo procesa records sin allocations.
 *
 * Modo house-fix (con houseNumber): además detecta sobre-asignaciones causadas por
 * ajustes retroactivos de cargos (allocated_amount > expected_amount actual),
 * resetea las allocations afectadas, borra penalidades auto-generadas (se recrean
 * on-demand al recalcular balance) y reprocesa los records vía FIFO.
 * Al final, aplica el credit_balance acumulado a períodos pendientes.
 */
@Injectable()
export class BackfillAllocationsUseCase {
  private readonly logger = new Logger(BackfillAllocationsUseCase.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    @Inject('IHousePeriodChargeRepository')
    private readonly housePeriodChargeRepository: IHousePeriodChargeRepository,
    private readonly allocatePaymentUseCase: AllocatePaymentUseCase,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
    private readonly applyCreditToPeriodsUseCase: ApplyCreditToPeriodsUseCase,
    private readonly houseRepository: HouseRepository,
    private readonly snapshotService: HouseStatusSnapshotService,
  ) {}

  async execute(houseNumber?: number): Promise<BackfillAllocationsResponseDto> {
    const mode: 'global' | 'house-fix' = houseNumber ? 'house-fix' : 'global';
    let resetRecords = 0;
    let fixedBuckets = 0;
    let resolvedHouseId: number | null = null;

    if (houseNumber !== undefined) {
      const house = await this.houseRepository.findByNumberHouse(houseNumber);
      if (house) {
        resolvedHouseId = house.id;
        const fixResult = await this.resetOverpaidAllocationsForHouse(house.id);
        resetRecords = fixResult.resetRecords;
        fixedBuckets = fixResult.fixedBuckets;
        if (fixedBuckets > 0) {
          this.logger.log(
            `House ${houseNumber} (id=${house.id}): reset ${resetRecords} records over ${fixedBuckets} overpaid buckets`,
          );
        }
      }
    }

    const orphanRecords = await this.findOrphanRecords(houseNumber);

    this.logger.log(
      `Found ${orphanRecords.length} confirmed records without allocations${houseNumber ? ` for house ${houseNumber}` : ''}`,
    );

    const results: BackfillRecordResultDto[] = [];
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const record of orphanRecords) {
      try {
        const existing = await this.recordAllocationRepository.findByRecordId(
          record.record_id,
        );
        if (existing.length > 0) {
          skipped++;
          results.push({
            record_id: record.record_id,
            house_number: record.house_number,
            transaction_date: record.transaction_date,
            period_year: 0,
            period_month: 0,
            amount: record.amount,
            status: 'skipped',
          });
          continue;
        }

        const txDate = new Date(record.transaction_date);
        const year = txDate.getFullYear();
        const month = txDate.getMonth() + 1;

        await this.ensurePeriodExistsUseCase.execute(year, month);

        await this.allocatePaymentUseCase.execute({
          record_id: record.record_id,
          house_id: record.house_id,
          amount_to_distribute: record.amount,
          transaction_date: txDate,
        });

        processed++;
        results.push({
          record_id: record.record_id,
          house_number: record.house_number,
          transaction_date: record.transaction_date,
          period_year: year,
          period_month: month,
          amount: record.amount,
          status: 'processed',
        });

        this.logger.log(
          `Backfilled record ${record.record_id} → house ${record.house_number}, period ${year}-${month}, amount ${record.amount}`,
        );
      } catch (error) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          record_id: record.record_id,
          house_number: record.house_number,
          transaction_date: record.transaction_date,
          period_year: 0,
          period_month: 0,
          amount: record.amount,
          status: 'failed',
          error: errorMessage,
        });

        this.logger.error(
          `Failed to backfill record ${record.record_id}: ${errorMessage}`,
        );
      }
    }

    if (resolvedHouseId !== null && resetRecords > 0) {
      try {
        await this.applyCreditToPeriodsUseCase.execute(resolvedHouseId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `applyCreditToPeriods failed for house ${resolvedHouseId}: ${errorMessage}`,
        );
      }
      await this.snapshotService.invalidateByHouseId(resolvedHouseId);
    }

    const response: BackfillAllocationsResponseDto = {
      total_records_found: orphanRecords.length,
      processed,
      skipped,
      failed,
      results,
      mode,
    };

    if (mode === 'house-fix') {
      response.reset_records = resetRecords;
      response.fixed_buckets = fixedBuckets;
    }

    return response;
  }

  /**
   * Detecta y resetea allocations sobre-dimensionadas para una casa.
   * Borra todas las allocations de los records que contribuyen a buckets
   * (period_id, concept_type) donde SUM(allocated) > current_charge.
   * También borra cargos auto_penalty (se recrean al recalcular balance).
   */
  private async resetOverpaidAllocationsForHouse(
    houseId: number,
  ): Promise<{ resetRecords: number; fixedBuckets: number }> {
    const buckets =
      await this.recordAllocationRepository.findOverpaidBuckets(houseId);

    if (buckets.length === 0) {
      return { resetRecords: 0, fixedBuckets: 0 };
    }

    const recordIds =
      await this.recordAllocationRepository.findRecordIdsContributingToBuckets(
        houseId,
        buckets.map((b) => ({
          period_id: b.period_id,
          concept_type: b.concept_type,
        })),
      );

    if (recordIds.length === 0) {
      return { resetRecords: 0, fixedBuckets: buckets.length };
    }

    await this.recordAllocationRepository.deleteByRecordIds(recordIds);
    await this.housePeriodChargeRepository.deleteAutoPenaltyChargesByHouse(
      houseId,
    );

    return { resetRecords: recordIds.length, fixedBuckets: buckets.length };
  }

  /**
   * Encuentra records confirmados que no tienen record_allocations.
   * JOIN: records → house_records → houses, records → transactions_status → transactions_bank
   * LEFT JOIN record_allocations WHERE ra.id IS NULL
   * Filtro: validation_status = 'confirmed'
   * Orden: tb.date ASC (cronologico para balance acumulativo correcto)
   */
  private async findOrphanRecords(
    houseNumber?: number,
  ): Promise<OrphanRecord[]> {
    let query = `
      SELECT DISTINCT
        r.id AS record_id,
        h.id AS house_id,
        h.number_house AS house_number,
        tb.date AS transaction_date,
        tb.amount
      FROM records r
      INNER JOIN house_records hr ON hr.record_id = r.id
      INNER JOIN houses h ON h.id = hr.house_id
      INNER JOIN transactions_status ts ON ts.id = r.transaction_status_id
      INNER JOIN transactions_bank tb ON tb.id = ts.transactions_bank_id
      LEFT JOIN record_allocations ra ON ra.record_id = r.id
      WHERE ts.validation_status = 'confirmed'
        AND ra.id IS NULL
        AND tb.is_deposit = true
    `;

    const params: any[] = [];

    if (houseNumber) {
      params.push(houseNumber);
      query += ` AND h.number_house = $${params.length}`;
    }

    query += ` ORDER BY tb.date ASC`;

    return this.dataSource.query(query, params);
  }
}
