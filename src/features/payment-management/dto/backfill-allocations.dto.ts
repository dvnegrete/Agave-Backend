/**
 * DTO para el resultado de backfill de un record individual
 */
export class BackfillRecordResultDto {
  record_id: number;
  house_number: number;
  transaction_date: string;
  period_year: number;
  period_month: number;
  amount: number;
  status: 'processed' | 'skipped' | 'failed';
  error?: string;
}

/**
 * DTO para la respuesta del endpoint de backfill de allocations
 */
export class BackfillAllocationsResponseDto {
  total_records_found: number;
  processed: number;
  skipped: number;
  failed: number;
  results: BackfillRecordResultDto[];
}
