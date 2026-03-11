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
  /**
   * Fecha de la transacción bancaria.
   * Si se proporciona (sin period_id), activa la asignación period-aware:
   *   1. Primero cubre los cargos del período correspondiente a esta fecha
   *   2. Con el sobrante aplica FIFO hacia períodos anteriores con deuda
   * Si se omite, usa FIFO puro (comportamiento anterior).
   */
  transaction_date?: Date;
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
