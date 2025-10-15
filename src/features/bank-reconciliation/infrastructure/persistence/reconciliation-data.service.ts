import { Injectable } from '@nestjs/common';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';

/**
 * Servicio de infraestructura para obtención de datos pendientes de conciliación
 */
@Injectable()
export class ReconciliationDataService {
  constructor(
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly voucherRepository: VoucherRepository,
  ) {}

  /**
   * Obtiene transacciones bancarias pendientes de conciliar
   * Filtra por: confirmation_status = FALSE y is_deposit = TRUE
   */
  async getPendingTransactions(
    startDate?: Date,
    endDate?: Date,
  ): Promise<TransactionBank[]> {
    let transactions = await this.transactionBankRepository.findAll();

    // Filtrar por reglas de negocio
    transactions = transactions.filter(
      (t) => !t.confirmation_status && t.is_deposit,
    );

    // Filtrar por rango de fechas si se especifica
    if (startDate && endDate) {
      transactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    return transactions;
  }

  /**
   * Obtiene vouchers pendientes de conciliar
   * Filtra por: confirmation_status = FALSE
   */
  async getPendingVouchers(
    startDate?: Date,
    endDate?: Date,
  ): Promise<Voucher[]> {
    let vouchers = await this.voucherRepository.findByConfirmationStatus(false);

    // Filtrar por rango de fechas si se especifica
    if (startDate && endDate) {
      vouchers = vouchers.filter((v) => {
        const voucherDate = new Date(v.date);
        return voucherDate >= startDate && voucherDate <= endDate;
      });
    }

    return vouchers;
  }
}
