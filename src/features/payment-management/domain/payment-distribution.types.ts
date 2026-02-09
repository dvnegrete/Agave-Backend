export interface UnpaidPeriodInfo {
  period_id: number;
  year: number;
  month: number;
  display_name: string;
  expected_maintenance: number;
  paid_maintenance: number;
  pending_maintenance: number;
}

export interface PaymentDistributionAIRequest {
  amount: number;
  house_id: number;
  house_number: number;
  credit_balance: number;
  unpaid_periods: UnpaidPeriodInfo[];
  total_debt: number;
}

export interface SuggestedAllocation {
  period_id: number;
  concept_type: string;
  amount: number;
  reasoning: string;
}

export interface PaymentDistributionAIResponse {
  allocations: SuggestedAllocation[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  total_allocated: number;
  remaining_as_credit: number;
}

export interface PaymentDistributionResult {
  method: 'deterministic' | 'ai' | 'manual_review';
  confidence: 'high' | 'medium' | 'low' | 'none';
  suggested_allocations: SuggestedAllocation[];
  total_allocated: number;
  remaining_as_credit: number;
  reasoning: string;
  requires_manual_review: boolean;
  auto_applied: boolean;
}
