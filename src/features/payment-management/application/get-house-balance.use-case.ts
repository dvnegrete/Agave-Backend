import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { House } from '@/shared/database/entities';
import { HouseBalanceDTO } from '../dto/house-balance.dto';
import { IHouseBalanceRepository } from '../interfaces';

/**
 * Use case para obtener saldo actual de una casa
 */
@Injectable()
export class GetHouseBalanceUseCase {
  constructor(
    @Inject('IHouseBalanceRepository')
    private readonly houseBalanceRepository: IHouseBalanceRepository,
  ) {}

  /**
   * Obtiene el saldo de una casa
   */
  async execute(houseId: number, house: House): Promise<HouseBalanceDTO> {
    const balance = await this.houseBalanceRepository.findByHouseId(houseId);

    if (!balance) {
      // Si no existe saldo, crear uno nuevo con valores por defecto
      const newBalance = await this.houseBalanceRepository.create(houseId);
      return this.toBalanceDTO(newBalance, house);
    }

    return this.toBalanceDTO(balance, house);
  }

  /**
   * Convierte HouseBalance a DTO
   */
  private toBalanceDTO(balance: any, house: House): HouseBalanceDTO {
    const netBalance = balance.credit_balance - balance.debit_balance;
    let status: 'in-debt' | 'credited' | 'balanced' = 'balanced';

    if (balance.debit_balance > 0) {
      status = 'in-debt';
    } else if (balance.credit_balance > 0) {
      status = 'credited';
    }

    return {
      house_id: balance.house_id,
      house_number: house.number_house,
      accumulated_cents: balance.accumulated_cents,
      credit_balance: balance.credit_balance,
      debit_balance: balance.debit_balance,
      net_balance: netBalance,
      status,
      updated_at: balance.updated_at,
    };
  }
}
