/**
 * DTO para saldo de casa
 */
export class HouseBalanceDTO {
  house_id: number;
  house_number: number;
  accumulated_cents: number;
  credit_balance: number;
  debit_balance: number;
  net_balance: number; // credit_balance - debit_balance
  status: 'in-debt' | 'credited' | 'balanced';
  updated_at: Date;
}

/**
 * DTO para actualizar saldo de casa
 */
export class UpdateHouseBalanceDTO {
  accumulated_cents?: number;
  credit_balance?: number;
  debit_balance?: number;
}

/**
 * DTO para resumen de saldos de múltiples casas
 */
export class BalanceSummaryDTO {
  total_houses: number;
  total_credited: number;
  total_in_debt: number;
  total_balanced: number;
  total_credit_balance: number;
  total_debit_balance: number;
  houses: HouseBalanceDTO[];
}
