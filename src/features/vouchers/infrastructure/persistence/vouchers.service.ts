import { Injectable } from '@nestjs/common';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

@Injectable()
export class VouchersService {
  constructor(private readonly voucherRepository: VoucherRepository) {}

  /**
   * Obtiene todos los vouchers desde la base de datos con información de casa asociada
   * @returns Lista de todos los vouchers registrados con número de casa
   */
  async getAllTransactions() {
    return await this.voucherRepository.findAllWithHouse();
  }

  /**
   * Obtiene vouchers filtrados por estado de confirmación con información de casa asociada
   * @param confirmed - true para confirmados, false para pendientes
   * @returns Lista de vouchers filtrados con número de casa
   */
  async getTransactionsByStatus(confirmed: boolean) {
    return await this.voucherRepository.findByConfirmationStatusWithHouse(
      confirmed,
    );
  }

  /**
   * Obtiene vouchers en un rango de fechas con información de casa asociada
   * @param startDate - Fecha inicial
   * @param endDate - Fecha final
   * @returns Lista de vouchers en el rango especificado con número de casa
   */
  async getTransactionsByDateRange(startDate: Date, endDate: Date) {
    return await this.voucherRepository.findByDateRangeWithHouse(
      startDate,
      endDate,
    );
  }
}
