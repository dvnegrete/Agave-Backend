import { Injectable, Logger } from '@nestjs/common';
import { HistoricalExcelParserService } from '../infrastructure/parsers/historical-excel-parser.service';
import { HistoricalRowProcessorService } from '../infrastructure/processors/historical-row-processor.service';
import { ProcessingResult } from '../domain/processing-result.value-object';
import { RowErrorDto } from '../dto/row-error.dto';
import { HistoricalRecordRow } from '../domain/historical-record-row.entity';

interface RowProcessingResult {
  success: boolean;
  recordId?: number;
  error?: RowErrorDto;
}

/**
 * Use case: Upload and process historical records Excel file
 * Orchestrates parsing, validation, and batch processing with error handling
 *
 * Uses limited concurrency (max 5 parallel) to prevent connection pool exhaustion
 */
@Injectable()
export class UploadHistoricalRecordsUseCase {
  private readonly logger = new Logger(UploadHistoricalRecordsUseCase.name);

  constructor(
    private readonly excelParser: HistoricalExcelParserService,
    private readonly rowProcessor: HistoricalRowProcessorService,
  ) {}

  /**
   * Execute the file upload and processing
   * @param buffer Excel file buffer from upload
   * @param validateOnly If true, only validate without inserting to DB
   * @param bankName Name of the bank source for these historical records
   * @returns ProcessingResult with statistics and error details
   */
  async execute(
    buffer: Buffer,
    validateOnly: boolean = false,
    bankName: string,
  ): Promise<ProcessingResult> {
    this.logger.log(`Starting historical records processing. Validate only: ${validateOnly}, Bank: ${bankName}`);

    // Step 1: Parse Excel file
    const rows = await this.excelParser.parseFile(buffer);
    this.logger.log(`Parsed ${rows.length} rows from Excel file`);

    // Step 2: Validate all rows first (without DB operations)
    const errors: RowErrorDto[] = [];
    const validRows = rows.filter((row) => {
      const validation = row.validate();
      if (!validation.isValid) {
        errors.push({
          row_number: row.rowNumber,
          error_type: 'validation',
          message: validation.errors.join('; '),
        });
        return false;
      }
      return true;
    });

    this.logger.log(
      `Validation complete: ${validRows.length} valid, ${errors.length} invalid`,
    );

    // If validate-only mode, return results without processing
    if (validateOnly) {
      this.logger.log('Validate-only mode: returning results without DB operations');
      return new ProcessingResult(
        rows.length,
        validRows.length,
        errors.length,
        errors,
        [],
      );
    }

    // Step 3: Process valid rows with limited concurrency (max 3 parallel)
    // Limited to 3 to account for nested DB operations in ensurePeriodExistsUseCase
    let successfulCount = 0;
    const createdRecordIds: number[] = [];
    const CONCURRENCY_LIMIT = 3;

    // Process rows with limited concurrency to avoid exhausting connection pool
    const results = await this.processRowsWithLimitedConcurrency(
      validRows,
      bankName,
      CONCURRENCY_LIMIT,
    );

    // Collect results
    for (const result of results) {
      if (result.success) {
        successfulCount++;
        if (result.recordId) {
          createdRecordIds.push(result.recordId);
        }
      } else if (result.error) {
        errors.push(result.error);
      }
    }

    this.logger.log(
      `Processing complete: ${successfulCount} successful, ${errors.length - (rows.length - validRows.length)} failed`,
    );

    // Step 4: Build and return result
    return new ProcessingResult(
      rows.length,
      successfulCount,
      errors.length,
      errors,
      createdRecordIds,
    );
  }

  /**
   * Process rows with limited concurrency to avoid exhausting connection pool
   * Maintains order of results matching input rows
   * @param rows Rows to process
   * @param bankName Bank name for each row
   * @param concurrencyLimit Maximum number of parallel operations
   * @returns Array of processing results in same order as input rows
   */
  private async processRowsWithLimitedConcurrency(
    rows: HistoricalRecordRow[],
    bankName: string,
    concurrencyLimit: number,
  ): Promise<RowProcessingResult[]> {
    const results: RowProcessingResult[] = new Array(rows.length);
    const queue = rows.map((row, index) => ({ row, index }));
    let processing = 0;
    let completed = 0;

    return new Promise((resolve, reject) => {
      const processNext = async () => {
        while (queue.length > 0 && processing < concurrencyLimit) {
          processing++;
          const remaining = queue.length;
          const { row, index } = queue.shift()!;

          const progressStr = `[${completed + processing}/${rows.length}] (${processing} active, ${remaining} pending)`;
          this.logger.log(
            `▶ Processing row ${row.rowNumber} ${progressStr}`,
          );

          try {
            const result = await this.rowProcessor.processRow(row, bankName);
            results[index] = result;
          } catch (error) {
            this.logger.error(
              `✗ Row ${row.rowNumber} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            results[index] = {
              success: false,
              error: {
                row_number: row.rowNumber,
                error_type: 'database',
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            };
          } finally {
            processing--;
            completed++;
            const nextProgress = `[${completed}/${rows.length}] (${processing} active)`;

            if (results[index]?.success) {
              this.logger.log(`✓ Row ${row.rowNumber} completed ${nextProgress}`);
            }

            if (queue.length > 0 || processing > 0) {
              processNext().catch(reject);
            } else {
              // All done
              this.logger.log(`Processing complete: ${completed}/${rows.length} rows processed`);
              resolve(results);
            }
          }
        }
      };

      // Start initial batch
      if (rows.length === 0) {
        resolve([]);
      } else {
        this.logger.log(`Starting processing of ${rows.length} rows with concurrency limit: ${concurrencyLimit}`);
        processNext().catch(reject);
      }
    });
  }
}
