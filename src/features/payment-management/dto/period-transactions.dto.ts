/**
 * DTO de una transacción bancaria que aplicó (vía record_allocations) a un
 * período específico de una casa. Permite trazar qué pago cubrió qué período.
 */
export class PeriodTransactionDto {
  transaction_id: number;
  date: string;
  amount: number;
  allocated_to_period: number;
  bank_name: string;
  confirmation_status: boolean;
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
