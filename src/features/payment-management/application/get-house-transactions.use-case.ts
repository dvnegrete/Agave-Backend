import { Injectable } from '@nestjs/common';
import { House } from '@/shared/database/entities';
import { HouseTransactionsResponseDto, TransactionBankItemDto } from '../dto';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { GetHouseUnreconciledVouchersUseCase } from './get-house-unreconciled-vouchers.use-case';

/**
 * Use case para obtener transacciones bancarias y vouchers no conciliados de una casa
 * Retorna los registros puros de TransactionBank y vouchers sin reconciliar asociados a una casa
 */
@Injectable()
export class GetHouseTransactionsUseCase {
  constructor(
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly getHouseUnreconciledVouchersUseCase: GetHouseUnreconciledVouchersUseCase,
  ) {}

  /**
   * Ejecuta la búsqueda de transacciones bancarias y vouchers no conciliados de una casa
   * @param house Objeto House con id y number_house
   */
  async execute(house: House): Promise<HouseTransactionsResponseDto> {
    // Obtener transacciones bancarias asociadas a esta casa
    const transactions =
      await this.transactionBankRepository.findByHouseNumberHouse(
        house.number_house,
      );

    // Obtener vouchers no conciliados
    const unreconciledVouchers =
      await this.getHouseUnreconciledVouchersUseCase.execute(house);

    if (transactions.length === 0) {
      return {
        house_id: house.id,
        house_number: house.number_house,
        total_transactions: 0,
        total_amount: 0,
        confirmed_transactions: 0,
        pending_transactions: 0,
        transactions: [],
        unreconciled_vouchers: unreconciledVouchers,
      };
    }

    // Convertir a DTOs y calcular estadísticas
    const transactionDTOs = transactions.map((t) =>
      this.toTransactionBankItemDto(t),
    );

    const totalAmount = transactionDTOs.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const confirmedTransactions = transactionDTOs.filter(
      (t) => t.confirmation_status,
    ).length;
    const pendingTransactions = transactionDTOs.length - confirmedTransactions;

    return {
      house_id: house.id,
      house_number: house.number_house,
      total_transactions: transactionDTOs.length,
      total_amount: totalAmount,
      confirmed_transactions: confirmedTransactions,
      pending_transactions: pendingTransactions,
      transactions: transactionDTOs,
      unreconciled_vouchers: unreconciledVouchers,
    };
  }

  /**
   * Convierte una TransactionBank entity a TransactionBankItemDto
   */
  private toTransactionBankItemDto(transaction: any): TransactionBankItemDto {
    return {
      date: transaction.date,
      time: transaction.time,
      concept: transaction.concept ?? null,
      amount: transaction.amount,
      currency: transaction.currency ?? null,
      bank_name: transaction.bank_name ?? null,
      confirmation_status: transaction.confirmation_status,
    };
  }
}
