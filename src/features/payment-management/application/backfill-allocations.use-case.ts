import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IRecordAllocationRepository } from '../interfaces';
import { AllocatePaymentUseCase } from './allocate-payment.use-case';
import { EnsurePeriodExistsUseCase } from './ensure-period-exists.use-case';
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
 * Use case para backfill de record_allocations en records confirmados
 * que fueron procesados antes de que existiera el Balance Engine.
 *
 * Idempotente: si un record ya tiene allocations, se salta.
 * Continue-on-error: cada record se procesa independientemente.
 * Orden cronologico: ORDER BY transaction date ASC para balance acumulativo correcto.
 */
@Injectable()
export class BackfillAllocationsUseCase {
  private readonly logger = new Logger(BackfillAllocationsUseCase.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    private readonly allocatePaymentUseCase: AllocatePaymentUseCase,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
  ) {}

  async execute(houseNumber?: number): Promise<BackfillAllocationsResponseDto> {
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
        // Doble check idempotencia: verificar que no se crearon allocations entre query y procesamiento
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

        // Parsear fecha de la transaccion bancaria para determinar periodo
        const txDate = new Date(record.transaction_date);
        const year = txDate.getFullYear();
        const month = txDate.getMonth() + 1;

        // Asegurar que existe el periodo (para que tenga sus house_period_charges)
        await this.ensurePeriodExistsUseCase.execute(year, month);

        // Ejecutar allocation con FIFO automático (sin period_id)
        await this.allocatePaymentUseCase.execute({
          record_id: record.record_id,
          house_id: record.house_id,
          amount_to_distribute: record.amount,
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

    return {
      total_records_found: orphanRecords.length,
      processed,
      skipped,
      failed,
      results,
    };
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
