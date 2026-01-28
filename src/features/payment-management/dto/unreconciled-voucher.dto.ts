/**
 * DTO para voucher no conciliado
 * Contiene información de comprobantes que aún no han sido conciliados con transacciones bancarias
 */
export class UnreconciledVoucherDto {
  id: number;
  date: Date;
  amount: number;
  confirmation_status: boolean;
  confirmation_code?: string | null;
  created_at: Date;
}

/**
 * DTO para respuesta de vouchers no conciliados
 */
export class UnreconciledVouchersResponseDto {
  total_count: number;
  vouchers: UnreconciledVoucherDto[];
}
