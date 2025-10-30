import { Injectable } from '@nestjs/common';
import { PeriodDomain } from '../domain';
import { IPeriodRepository } from '../interfaces';
import { IPeriodConfigRepository } from '../interfaces';

/**
 * Caso de uso: Asegurar que existe un período
 * Crea el período automáticamente si no existe, usando la configuración activa
 * Usado principalmente durante la conciliación bancaria
 */
@Injectable()
export class EnsurePeriodExistsUseCase {
  constructor(
    private readonly periodRepository: IPeriodRepository,
    private readonly periodConfigRepository: IPeriodConfigRepository,
  ) {}

  async execute(year: number, month: number): Promise<PeriodDomain> {
    // 1. Verificar si el período ya existe
    const existingPeriod = await this.periodRepository.findByYearAndMonth(
      year,
      month,
    );

    if (existingPeriod) {
      return PeriodDomain.create({
        id: existingPeriod.id,
        year: existingPeriod.year,
        month: existingPeriod.month,
        startDate: existingPeriod.start_date,
        endDate: existingPeriod.end_date,
        periodConfigId: existingPeriod.period_config_id,
      });
    }

    // 2. Buscar configuración activa para la fecha del período
    const periodDate = new Date(year, month - 1, 1);
    const activeConfig =
      await this.periodConfigRepository.findActiveForDate(periodDate);

    // 3. Crear el nuevo período
    const newPeriod = await this.periodRepository.create(
      year,
      month,
      activeConfig?.id,
    );

    // TODO: Crear registros default en cta_maintenance, cta_water, etc.
    // usando los montos de activeConfig

    return PeriodDomain.create({
      id: newPeriod.id,
      year: newPeriod.year,
      month: newPeriod.month,
      startDate: newPeriod.start_date,
      endDate: newPeriod.end_date,
      periodConfigId: newPeriod.period_config_id,
    });
  }
}
