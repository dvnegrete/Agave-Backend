import { Injectable } from '@nestjs/common';
import { House } from '@/shared/database/entities';
import {
  UnreconciledVouchersResponseDto,
  UnreconciledVoucherDto,
} from '../dto';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

/**
 * Use case para obtener vouchers no conciliados de una casa
 * Retorna los comprobantes que aún no han sido reconciliados con transacciones bancarias
 */
@Injectable()
export class GetHouseUnreconciledVouchersUseCase {
  constructor(
    private readonly voucherRepository: VoucherRepository,
  ) {}

  /**
   * Ejecuta la búsqueda de vouchers no conciliados de una casa
   * @param house Objeto House con id y number_house
   */
  async execute(house: House): Promise<UnreconciledVouchersResponseDto> {
    // Obtener vouchers no conciliados asociados a esta casa
    const unreconciledVouchers =
      await this.voucherRepository.findUnreconciledByHouseNumber(
        house.number_house,
      );

    if (unreconciledVouchers.length === 0) {
      return {
        total_count: 0,
        vouchers: [],
      };
    }

    // Convertir a DTOs
    const voucherDTOs = unreconciledVouchers.map((v) =>
      this.toUnreconciledVoucherDto(v),
    );

    return {
      total_count: voucherDTOs.length,
      vouchers: voucherDTOs,
    };
  }

  /**
   * Convierte una Voucher entity a UnreconciledVoucherDto
   */
  private toUnreconciledVoucherDto(voucher: any): UnreconciledVoucherDto {
    return {
      id: voucher.id,
      date: voucher.date,
      amount: voucher.amount,
      confirmation_status: voucher.confirmation_status,
      confirmation_code: voucher.confirmation_code ?? null,
      created_at: voucher.created_at,
    };
  }
}
