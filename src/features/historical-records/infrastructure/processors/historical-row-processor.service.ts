import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { HistoricalRecordRow } from '../../domain/historical-record-row.entity';
import { EnsurePeriodExistsUseCase } from '@/features/payment-management/application/ensure-period-exists.use-case';
import { CtaRecordCreatorService } from './cta-record-creator.service';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { EnsureHouseExistsService } from '@/shared/database/services';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { ValidationStatus } from '@/shared/database/entities/enums';
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
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly transactionStatusRepository: TransactionStatusRepository,
    private readonly ensureHouseExistsService: EnsureHouseExistsService,
  ) {}

  /**
   * Process a single row with full transaction support
   * If any step fails, entire row is rolled back
   * @param row Historical record row to process
   * @param bankName Name of the bank source for this historical record
   * @returns Result with success status and either recordId or error details
   */
  async processRow(
    row: HistoricalRecordRow,
    bankName: string,
  ): Promise<RowProcessingResult> {
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

    // Step 1: Ensure Period exists BEFORE starting transaction
    // This avoids nested transactions. The period cache minimizes lookups.
    // First lookup of each period creates it, subsequent rows reuse cached value.
    const { year, month } = row.getPeriodInfo();
    const period = await this.ensurePeriodExistsUseCase.execute(year, month);
    this.logger.debug(`Period ${year}-${month} ID: ${period.id}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.debug(`Processing row ${row.rowNumber} with transaction`);

      // Step 1.5: Create TransactionBank record
      const transactionBankData = {
        date: row.fecha,
        time: row.hora,
        amount: row.deposito,
        concept: row.concepto,
        is_deposit: true,
        currency: 'MXN',
        bank_name: bankName,
        confirmation_status: true,
      };
      const transactionBank = queryRunner.manager.create(
        TransactionBank,
        transactionBankData,
      );
      const savedTransactionBank =
        await queryRunner.manager.save(transactionBank);
      this.logger.debug(`Created TransactionBank ID: ${savedTransactionBank.id}`);

      // Step 1.6: Create TransactionStatus record
      // Use NOT_FOUND for unidentified payments (casa = 0) so they appear in unclaimed-deposits
      // Use CONFIRMED for identified payments (casa > 0)
      const isIdentified = row.isIdentifiedPayment();
      const transactionStatus = await this.transactionStatusRepository.create(
        {
          transactions_bank_id: Number(savedTransactionBank.id),
          vouchers_id: null,
          validation_status: isIdentified
            ? ValidationStatus.CONFIRMED
            : ValidationStatus.NOT_FOUND,
          identified_house_number: isIdentified ? row.casa : undefined,
          processed_at: row.fecha,
          reason: isIdentified
            ? 'Registro histórico importado - Con casa asignada'
            : 'Registro histórico importado - Sin casa (será conciliado manualmente)',
        },
        queryRunner,
      );
      this.logger.debug(`Created TransactionStatus ID: ${transactionStatus.id}`);

      // Step 2: Create cta_* records (within transaction)
      const ctaIds = await this.ctaRecordCreatorService.createCtaRecords(
        row,
        period.id,
        queryRunner,
      );

      // Step 3: Create Record and HouseRecord association
      let recordId: number | null = null;

      if (row.isIdentifiedPayment()) {
        // Casa > 0: Create Record and HouseRecord (will appear in unclaimed-deposits if no conceptos)
        const record = await this.recordRepository.create(
          {
            transaction_status_id: transactionStatus.id,
            vouchers_id: null,
            ...ctaIds,
          },
          queryRunner,
        );
        recordId = record.id;
        this.logger.debug(`Created Record ID: ${record.id}`);

        // Get house number (from casa column, not from cents)
        const houseNumber = row.casa;
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
        // Casa = 0: NO Record, NO HouseRecord
        // Transaction will be pending in unclaimed-deposits, ready to be assigned via endpoint
        this.logger.debug(
          `Row ${row.rowNumber}: Casa = 0 (unidentified), Record not created. Will appear in unclaimed-deposits.`,
        );
      }

      // Commit transaction on success
      await queryRunner.commitTransaction();
      if (recordId) {
        this.logger.log(`Row ${row.rowNumber} processed successfully (Record ID: ${recordId})`);
      } else {
        this.logger.log(
          `Row ${row.rowNumber} processed successfully (No Record created - Casa = 0, pending unclaimed-deposits)`,
        );
      }

      return {
        success: true,
        recordId: recordId ?? undefined,
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
