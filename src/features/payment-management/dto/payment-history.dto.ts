import {
  AllocationConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';

/**
 * DTO para item de historial de pagos
 */
export class PaymentHistoryItemDTO {
  id: number;
  record_id: number;
  period_year: number;
  period_month: number;
  payment_date: Date;
  concept_type: AllocationConceptType;
  allocated_amount: number;
  expected_amount: number;
  payment_status: PaymentStatus;
  difference: number; // allocated - expected
}

/**
 * DTO para historial de pagos de una casa
 */
export class PaymentHistoryResponseDTO {
  house_id: number;
  house_number: number;
  total_payments: number;
  total_paid: number;
  total_expected: number;
  date_from?: Date;
  date_to?: Date;
  payments: PaymentHistoryItemDTO[];
}

/**
 * DTO para historial de pagos resumido por período
 */
export class PaymentHistoryByPeriodDTO {
  period_year: number;
  period_month: number;
  period_id: number;
  total_allocations: number;
  total_paid: number;
  total_expected: number;
  payment_statuses: {
    complete: number;
    partial: number;
    overpaid: number;
  };
  allocations: PaymentHistoryItemDTO[];
}
