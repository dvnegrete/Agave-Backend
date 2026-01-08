import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { HistoricalRecordRow } from '../../domain/historical-record-row.entity';
import { EnsurePeriodExistsUseCase } from '@/features/payment-management/application/ensure-period-exists.use-case';
import { CtaRecordCreatorService } from './cta-record-creator.service';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { EnsureHouseExistsService } from '@/shared/database/services';
import { RowErrorDto } from '../../dto/row-error.dto';

/**
 * Result of processing a single row
 */
export interface RowProcessingResult {
  success: boolean;
  recordId?: number;
  error?: RowErrorDto;
}

/**
 * Service to process a single historical record row
 * Orchestrates: Period creation/lookup, Cta records, Record, HouseRecord
 * Uses transactions for atomicity - all or nothing per row
 */
@Injectable()
export class HistoricalRowProcessorService {
  private readonly logger = new Logger(HistoricalRowProcessorService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
    private readonly ctaRecordCreatorService: CtaRecordCreatorService,
    private readonly recordRepository: RecordRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly ensureHouseExistsService: EnsureHouseExistsService,
  ) {}

  /**
   * Process a single row with full transaction support
   * If any step fails, entire row is rolled back
   * @param row Historical record row to process
   * @returns Result with success status and either recordId or error details
   */
  async processRow(row: HistoricalRecordRow): Promise<RowProcessingResult> {
    // Validate row first (no DB operations)
    const validation = row.validate();
    if (!validation.isValid) {
      return {
        success: false,
        error: {
          row_number: row.rowNumber,
          error_type: 'validation',
          message: validation.errors.join('; '),
        },
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.debug(`Processing row ${row.rowNumber} with transaction`);

      // Step 1: Ensure Period exists
      const { year, month } = row.getPeriodInfo();
      const period = await this.ensurePeriodExistsUseCase.execute(year, month);
      this.logger.debug(`Period ${year}-${month} ID: ${period.id}`);

      // Step 2: Create cta_* records (within transaction)
      const ctaIds = await this.ctaRecordCreatorService.createCtaRecords(
        row,
        period.id,
        queryRunner,
      );

      // Step 3: Create Record with cta_* FK IDs
      const record = await this.recordRepository.create(
        {
          transaction_status_id: null,
          vouchers_id: null,
          ...ctaIds,
        },
        queryRunner,
      );
      this.logger.debug(`Created Record ID: ${record.id}`);

      // Step 4: Create HouseRecord association (only if casa is identified)
      if (row.isIdentifiedPayment()) {
        const houseNumber = row.getIdentifiedHouseNumber();
        this.logger.debug(`Identified house number: ${houseNumber}`);

        // Ensure house exists, creating if necessary
        const ensureResult = await this.ensureHouseExistsService.execute(
          houseNumber,
          {
            createIfMissing: true,
            queryRunner,
          },
        );

        if (ensureResult.wasCreated) {
          this.logger.log(
            `Casa ${houseNumber} created automatically (Row ${row.rowNumber})`,
          );
        }

        // Create house-record association
        const houseRecord = await this.houseRecordRepository.create(
          {
            house_id: ensureResult.house.id,
            record_id: record.id,
          },
          queryRunner,
        );
        this.logger.debug(`Created HouseRecord ID: ${houseRecord.id}`);
      } else {
        this.logger.debug(`Row ${row.rowNumber}: Casa not identified, skipping HouseRecord`);
      }

      // Commit transaction on success
      await queryRunner.commitTransaction();
      this.logger.log(`Row ${row.rowNumber} processed successfully (Record ID: ${record.id})`);

      return {
        success: true,
        recordId: record.id,
      };
    } catch (error: any) {
      // Rollback on any error
      await queryRunner.rollbackTransaction();
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al procesar la fila';
      this.logger.error(
        `Row ${row.rowNumber} processing failed: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: {
          row_number: row.rowNumber,
          error_type: 'database',
          message: errorMsg,
          details: {
            concepto: row.concepto,
            deposito: row.deposito,
            casa: row.casa,
          },
        },
      };
    } finally {
      await queryRunner.release();
    }
  }
}
