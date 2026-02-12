import {
  AllocationConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';

/**
 * DTO para respuesta de asignación de pago
 */
export class PaymentAllocationDTO {
  id: number;
  record_id: number;
  house_id: number;
  period_id: number;
  concept_type: AllocationConceptType;
  concept_id: number;
  allocated_amount: number;
  expected_amount: number;
  payment_status: PaymentStatus;
  created_at: Date;
}

/**
 * DTO para crear una asignación de pago
 */
export class CreatePaymentAllocationDTO {
  record_id: number;
  house_id: number;
  period_id: number;
  concept_type: AllocationConceptType;
  concept_id: number;
  allocated_amount: number;
  expected_amount: number;
  payment_status: PaymentStatus;
}

/**
 * DTO para request de distribución de pago
 */
export class PaymentDistributionRequestDTO {
  record_id: number;
  house_id: number;
  amount_to_distribute: number;
  /**
   * ID del periodo al que asignar el pago.
   * Si se omite, se usa distribución FIFO automática (periodos más antiguos primero).
   * Usar solo para asignación manual (ej: confirmación de distribución AI).
   */
  period_id?: number;
}

/**
 * DTO para respuesta de distribución de pago
 */
export class PaymentDistributionResponseDTO {
  record_id: number;
  house_id: number;
  total_distributed: number;
  allocations: PaymentAllocationDTO[];
  remaining_amount: number;
  balance_after: {
    accumulated_cents: number;
    credit_balance: number;
    debit_balance: number;
  };
}
