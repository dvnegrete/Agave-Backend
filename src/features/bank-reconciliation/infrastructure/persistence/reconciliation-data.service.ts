import { Injectable } from '@nestjs/common';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
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
    private readonly transactionStatusRepository: TransactionStatusRepository,
  ) {}

  /**
   * Obtiene IDs de transacciones que ya fueron procesadas por conciliación
   * (tienen un TransactionStatus registrado, sin importar el resultado)
   */
  private async getProcessedTransactionIds(): Promise<Set<string>> {
    const statuses = await this.transactionStatusRepository.findAll();
    return new Set(
      statuses
        .map((s) => s.transactions_bank_id)
        .filter((id): id is string => id !== null && id !== undefined),
    );
  }

  /**
   * Obtiene transacciones bancarias pendientes de conciliar
   * Filtra por: confirmation_status = FALSE, is_deposit = TRUE
   * y NO procesadas anteriormente (sin TransactionStatus)
   */
  async getPendingTransactions(
    startDate?: Date,
    endDate?: Date,
  ): Promise<TransactionBank[]> {
    let transactions = await this.transactionBankRepository.findAll();

    // ✅ NUEVO: Obtener IDs de transacciones ya procesadas
    const processedTransactionIds = await this.getProcessedTransactionIds();

    // Filtrar por reglas de negocio
    transactions = transactions.filter(
      (t) =>
        t.is_deposit &&
        !t.confirmation_status &&
        !processedTransactionIds.has(t.id), // ⬅️ NUEVO: No reprocesar
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
