import { Inject, Injectable } from '@nestjs/common';
import { IRecordAllocationRepository } from '../interfaces';
import { PeriodTransactionsResponseDto } from '../dto/period-transactions.dto';

/**
 * Use case que retorna las transacciones bancarias asociadas (vía
 * record_allocations) a un período específico de una casa.
 * Pensado para auditoría: permite trazar qué pagos cubrieron cada período.
 */
@Injectable()
export class GetPeriodTransactionsUseCase {
  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
  ) {}

  async execute(
    houseId: number,
    periodId: number,
  ): Promise<PeriodTransactionsResponseDto> {
    const transactions =
      await this.recordAllocationRepository.findTransactionsByHousePeriod(
        houseId,
        periodId,
      );

    const total_allocated = transactions.reduce(
      (sum, t) => sum + t.allocated_to_period,
      0,
    );

    return {
      house_id: houseId,
      period_id: periodId,
      total_allocated,
      transactions,
    };
  }
}
