export class PeriodChargeSummaryDto {
  period_id: number;
  year: number;
  month: number;
  display_name: string;
  maintenance_amount: number;
  water_amount: number | null;
  extraordinary_fee_amount: number | null;
  water_active: boolean;
  extraordinary_fee_active: boolean;
  has_allocations: boolean;
}

export class BatchUpdateResultDto {
  periods_affected: number;
  periods_created: number;
  charges_updated: number;
  has_retroactive_changes: boolean;
}

export class ReprocessResultDto {
  allocations_deleted: number;
  balances_reset: number;
  backfill_result: {
    total_records_found: number;
    processed: number;
    skipped: number;
    failed: number;
  };
}
