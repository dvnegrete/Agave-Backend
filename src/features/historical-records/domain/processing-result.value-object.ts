import { RowErrorDto } from '../dto/row-error.dto';
import { HistoricalRecordResponseDto } from '../dto/historical-record-response.dto';

/**
 * Value object representing the result of processing a historical records file
 * Encapsulates statistics and errors from the processing operation
 */
export class ProcessingResult {
  constructor(
    public readonly totalRows: number,
    public readonly successfulRows: number,
    public readonly failedRows: number,
    public readonly errors: RowErrorDto[],
    public readonly createdRecordIds: number[],
  ) {}

  /**
   * Factory method for creating empty result
   */
  static empty(): ProcessingResult {
    return new ProcessingResult(0, 0, 0, [], []);
  }

  /**
   * Calculate success rate percentage
   */
  get successRate(): number {
    return this.totalRows > 0
      ? (this.successfulRows / this.totalRows) * 100
      : 0;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.failedRows > 0;
  }

  /**
   * Convert to HTTP response DTO
   */
  toResponseDto(): HistoricalRecordResponseDto {
    return {
      total_rows: this.totalRows,
      successful: this.successfulRows,
      failed: this.failedRows,
      success_rate: parseFloat(this.successRate.toFixed(2)),
      errors: this.errors,
      created_record_ids: this.createdRecordIds,
    };
  }
}
