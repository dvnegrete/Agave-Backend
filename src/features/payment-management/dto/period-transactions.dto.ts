/**
 * DTO de una "fuente de pago" que aplicó (vía record_allocations) a un
 * período específico de una casa. Permite trazar qué cubrió cada período.
 *
 * source='bank': proviene de una transacción bancaria real (transactions_bank).
 * source='system_credit': allocations con record_id=0, creadas por
 *   ApplyCreditToPeriodsUseCase al distribuir el credit_balance acumulado
 *   (saldo a favor) hacia períodos pendientes vía FIFO. No tienen tx fuente.
 */
export class PeriodTransactionDto {
  transaction_id: number | null;
  date: string;
  amount: number | null;
  allocated_to_period: number;
  concept: string | null;
  bank_name: string | null;
  confirmation_status: boolean;
  source: 'bank' | 'system_credit';
}

/**
 * DTO de respuesta para GET /houses/:houseId/periods/:periodId/transactions
 */
export class PeriodTransactionsResponseDto {
  house_id: number;
  period_id: number;
  total_allocated: number;
  transactions: PeriodTransactionDto[];
}
