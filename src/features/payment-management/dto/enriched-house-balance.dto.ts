import {
  HouseStatus,
  PeriodPaymentStatus,
} from '../domain/house-balance-status.types';

export class ConceptBreakdownDto {
  concept_type: string;
  expected_amount: number;
  paid_amount: number;
  pending_amount: number;
}

export class PeriodPaymentDetailDto {
  period_id: number;
  year: number;
  month: number;
  display_name: string;
  expected_total: number;
  paid_total: number;
  pending_total: number;
  penalty_amount: number;
  status: PeriodPaymentStatus;
  concepts: ConceptBreakdownDto[];
  is_overdue: boolean;
}

export class EnrichedHouseBalanceDto {
  house_id: number;
  house_number: number;
  status: HouseStatus;
  total_debt: number;
  credit_balance: number;
  accumulated_cents: number;
  unpaid_periods: PeriodPaymentDetailDto[];
  paid_periods: PeriodPaymentDetailDto[];
  current_period: PeriodPaymentDetailDto | null;
  next_due_date: string | null;
  deadline_message: string | null;
  total_unpaid_periods: number;
  bank_coverage_date: string | null;
  summary: {
    total_expected: number;
    total_paid: number;
    total_pending: number;
    total_penalties: number;
  };
}

export class HousesSummaryDto {
  total_houses: number;
  morosas: number;
  al_dia: number;
  saldo_a_favor: number;
  total_debt: number;
  total_credit: number;
  houses: EnrichedHouseBalanceDto[];
}
