export enum HouseStatus {
  MOROSA = 'morosa',
  AL_DIA = 'al_dia',
  SALDO_A_FAVOR = 'saldo_a_favor',
}

export enum PeriodPaymentStatus {
  PAID = 'paid',
  PARTIAL = 'partial',
  UNPAID = 'unpaid',
}

export interface ConceptBreakdown {
  concept_type: string;
  expected_amount: number;
  paid_amount: number;
  pending_amount: number;
}

export interface PeriodPaymentDetail {
  period_id: number;
  year: number;
  month: number;
  display_name: string;
  expected_total: number;
  paid_total: number;
  pending_total: number;
  penalty_amount: number;
  status: PeriodPaymentStatus;
  concepts: ConceptBreakdown[];
  is_overdue: boolean;
}

export interface EnrichedHouseBalance {
  house_id: number;
  house_number: number;
  status: HouseStatus;
  total_debt: number;
  credit_balance: number;
  accumulated_cents: number;
  unpaid_periods: PeriodPaymentDetail[];
  paid_periods: PeriodPaymentDetail[];
  upcoming_periods: PeriodPaymentDetail[];
  current_period: PeriodPaymentDetail | null;
  next_due_date: string | null;
  deadline_message: string | null;
  bank_coverage_date: string | null;
  total_unpaid_periods: number;
  summary: {
    total_expected: number;
    total_paid: number;
    total_pending: number;
    total_penalties: number;
  };
}
