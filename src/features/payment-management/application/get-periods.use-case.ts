import { Injectable } from '@nestjs/common';
import { PeriodDomain } from '../domain';
import { IPeriodRepository } from '../interfaces';

/**
 * Caso de uso: Obtener todos los períodos
 */
@Injectable()
export class GetPeriodsUseCase {
  constructor(private readonly periodRepository: IPeriodRepository) {}

  async execute(): Promise<PeriodDomain[]> {
    const periods = await this.periodRepository.findAll();

    return periods.map((period) =>
      PeriodDomain.create({
        id: period.id,
        year: period.year,
        month: period.month,
        startDate: period.start_date,
        endDate: period.end_date,
        periodConfigId: period.period_config_id,
      }),
    );
  }
}
