export interface CreditAllocationDetail {
  period_id: number;
  concept_type: string;
  allocated_amount: number;
  expected_amount: number;
  is_complete: boolean;
}

export interface CreditApplicationResult {
  house_id: number;
  credit_before: number;
  credit_after: number;
  total_applied: number;
  allocations_created: CreditAllocationDetail[];
  periods_covered: number;
  periods_partially_covered: number;
}
