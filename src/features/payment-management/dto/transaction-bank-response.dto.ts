import { UnreconciledVouchersResponseDto } from './unreconciled-voucher.dto';

/**
 * DTO para cada transacción dentro del historial
 * Contiene solo los campos esenciales de la transacción bancaria
 */
export class TransactionBankItemDto {
  date: Date;
  time: string;
  concept: string | null;
  amount: number;
  currency: string | null;
  bank_name: string | null;
  confirmation_status: boolean;
}

/**
 * DTO para respuesta de historial de transacciones de una casa
 * Incluye tanto transacciones bancarias como vouchers no conciliados
 */
export class HouseTransactionsResponseDto {
  house_id: number;
  house_number: number;
  total_transactions: number;
  total_amount: number;
  confirmed_transactions: number;
  pending_transactions: number;
  transactions: TransactionBankItemDto[];
  unreconciled_vouchers: UnreconciledVouchersResponseDto;
}
