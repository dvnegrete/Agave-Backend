import { Injectable } from '@nestjs/common';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

@Injectable()
export class VouchersService {
  constructor(private readonly voucherRepository: VoucherRepository) {}

  /**
   * Obtiene todos los vouchers desde la base de datos
   * @returns Lista de todos los vouchers registrados
   */
  async getAllTransactions() {
    return await this.voucherRepository.findAll();
  }

  /**
   * Obtiene vouchers filtrados por estado de confirmación
   * @param confirmed - true para confirmados, false para pendientes
   * @returns Lista de vouchers filtrados
   */
  async getTransactionsByStatus(confirmed: boolean) {
    return await this.voucherRepository.findByConfirmationStatus(confirmed);
  }

  /**
   * Obtiene vouchers en un rango de fechas
   * @param startDate - Fecha inicial
   * @param endDate - Fecha final
   * @returns Lista de vouchers en el rango especificado
   */
  async getTransactionsByDateRange(startDate: Date, endDate: Date) {
    return await this.voucherRepository.findByDateRange(startDate, endDate);
  }
}
