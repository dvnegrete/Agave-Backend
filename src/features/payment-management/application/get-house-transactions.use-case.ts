import { Injectable } from '@nestjs/common';
import { House } from '@/shared/database/entities';
import { HouseTransactionsResponseDto, TransactionBankItemDto } from '../dto';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { GetHouseUnreconciledVouchersUseCase } from './get-house-unreconciled-vouchers.use-case';

/**
 * Use case para obtener transacciones bancarias, registros históricos y vouchers no conciliados de una casa
 * Retorna combinados los registros de TransactionBank, Records históricos y vouchers sin reconciliar
 */
@Injectable()
export class GetHouseTransactionsUseCase {
  constructor(
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly getHouseUnreconciledVouchersUseCase: GetHouseUnreconciledVouchersUseCase,
  ) {}

  /**
   * Ejecuta la búsqueda de transacciones bancarias, registros históricos y vouchers no conciliados de una casa
   * @param house Objeto House con id y number_house
   */
  async execute(house: House): Promise<HouseTransactionsResponseDto> {
    // Obtener todas las transacciones bancarias (incluyendo las históricas)
    // asociadas a esta casa a través de la cadena de relaciones:
    // TransactionBank → TransactionStatus → Record → HouseRecord → House
    const bankTransactions =
      await this.transactionBankRepository.findByHouseNumberHouse(
        house.number_house,
      );

    // Obtener vouchers no conciliados
    const unreconciledVouchers =
      await this.getHouseUnreconciledVouchersUseCase.execute(house);

    // Convertir transacciones bancarias a DTOs
    // Nota: Ahora incluye tanto transacciones reales como registros históricos
    const bankTransactionDTOs = bankTransactions.map((t) =>
      this.toTransactionBankItemDto(t),
    );

    // Ordenar por fecha (descendente)
    const allTransactions = bankTransactionDTOs.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    if (allTransactions.length === 0) {
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

    // Calcular estadísticas
    const totalAmount = allTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const confirmedTransactions = allTransactions.filter(
      (t) => t.confirmation_status,
    ).length;
    const pendingTransactions = allTransactions.length - confirmedTransactions;

    return {
      house_id: house.id,
      house_number: house.number_house,
      total_transactions: allTransactions.length,
      total_amount: totalAmount,
      confirmed_transactions: confirmedTransactions,
      pending_transactions: pendingTransactions,
      transactions: allTransactions,
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
      source: 'bank',
    };
  }

}
