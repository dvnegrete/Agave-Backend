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

    // Step 3: Process valid rows sequentially (concurrency = 1)
    // Sequential processing ensures period cache is fully utilized and prevents connection pool exhaustion
    // Even though sequential, the period cache makes this fast (~10-50ms per row)
    let successfulCount = 0;
    const createdRecordIds: number[] = [];
    const CONCURRENCY_LIMIT = 1; // Sequential: 1 row at a time

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
   * Uses simple sequential approach with for loop instead of recursion
   * @param rows Rows to process
   * @param bankName Bank name for each row
   * @param concurrencyLimit Maximum number of parallel operations (currently 1 for sequential)
   * @returns Array of processing results in same order as input rows
   */
  private async processRowsWithLimitedConcurrency(
    rows: HistoricalRecordRow[],
    bankName: string,
    concurrencyLimit: number,
  ): Promise<RowProcessingResult[]> {
    const results: RowProcessingResult[] = new Array(rows.length);

    if (rows.length === 0) {
      return results;
    }

    const processingMode = concurrencyLimit === 1 ? 'sequential (1 row at a time)' : `${concurrencyLimit} rows in parallel`;
    this.logger.log(`Starting processing of ${rows.length} rows - Mode: ${processingMode}`);

    // Simple sequential processing with for loop
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const progressStr = `[${i + 1}/${rows.length}]`;

      this.logger.log(`▶ Processing row ${row.rowNumber} ${progressStr}`);

      try {
        const result = await this.rowProcessor.processRow(row, bankName);
        results[i] = result;

        if (result.success) {
          this.logger.log(`Row ${row.rowNumber} completed ${progressStr}`);
        } else {
          this.logger.warn(`Row ${row.rowNumber} failed: ${result.error?.message} ${progressStr}`);
        }
      } catch (error) {
        this.logger.error(
          `Row ${row.rowNumber} failed with exception: ${error instanceof Error ? error.message : 'Unknown error'} ${progressStr}`,
          error instanceof Error ? error.stack : '',
        );
        results[i] = {
          success: false,
          error: {
            row_number: row.rowNumber,
            error_type: 'database',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    }

    this.logger.log(`Processing complete: ${rows.length}/${rows.length} rows processed`);
    return results;
  }
}
