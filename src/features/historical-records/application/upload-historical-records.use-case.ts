import { Injectable, Logger } from '@nestjs/common';
import { HistoricalExcelParserService } from '../infrastructure/parsers/historical-excel-parser.service';
import { HistoricalRowProcessorService } from '../infrastructure/processors/historical-row-processor.service';
import { ProcessingResult } from '../domain/processing-result.value-object';
import { RowErrorDto } from '../dto/row-error.dto';

/**
 * Use case: Upload and process historical records Excel file
 * Orchestrates parsing, validation, and batch processing with error handling
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

    // Step 3: Process valid rows (one by one with transactions)
    let successfulCount = 0;
    const createdRecordIds: number[] = [];

    for (const row of validRows) {
      this.logger.debug(`Processing row ${row.rowNumber}`);

      const result = await this.rowProcessor.processRow(row, bankName);

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
}
