import { Injectable, Inject, Logger } from '@nestjs/common';
import { PeriodDomain } from '../domain';
import { IPeriodRepository } from '../interfaces';
import { IPeriodConfigRepository } from '../interfaces';

/**
 * Caso de uso: Asegurar que existe un período
 * Crea el período automáticamente si no existe, usando la configuración activa
 * Usado principalmente durante la conciliación bancaria y carga de registros históricos
 *
 * Implementa caché en memoria para evitar búsquedas repetidas del mismo período
 * (común durante carga de archivos históricos donde muchas filas son del mismo mes)
 */
@Injectable()
export class EnsurePeriodExistsUseCase {
  private readonly logger = new Logger(EnsurePeriodExistsUseCase.name);
  private periodCache = new Map<string, PeriodDomain>();

  constructor(
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
  ) {}

  async execute(year: number, month: number): Promise<PeriodDomain> {
    // Check cache first (common for historical records uploads where many rows are same month)
    const cacheKey = `${year}-${month}`;
    const cachedPeriod = this.periodCache.get(cacheKey);
    if (cachedPeriod) {
      this.logger.debug(`Period ${cacheKey} found in cache`);
      return cachedPeriod;
    }

    // 1. Verificar si el período ya existe
    const existingPeriod = await this.periodRepository.findByYearAndMonth(
      year,
      month,
    );

    if (existingPeriod) {
      const periodDomain = PeriodDomain.create({
        id: existingPeriod.id,
        year: existingPeriod.year,
        month: existingPeriod.month,
        startDate: existingPeriod.start_date,
        endDate: existingPeriod.end_date,
        periodConfigId: existingPeriod.period_config_id,
      });
      this.periodCache.set(cacheKey, periodDomain);
      this.logger.debug(`Period ${cacheKey} found in DB and cached`);
      return periodDomain;
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

    const periodDomain = PeriodDomain.create({
      id: newPeriod.id,
      year: newPeriod.year,
      month: newPeriod.month,
      startDate: newPeriod.start_date,
      endDate: newPeriod.end_date,
      periodConfigId: newPeriod.period_config_id,
    });
    this.periodCache.set(cacheKey, periodDomain);
    this.logger.log(`Period ${cacheKey} created and cached`);
    return periodDomain;
  }

  /**
   * Limpia el caché de períodos (útil para testing o reinicialización)
   */
  clearCache(): void {
    this.periodCache.clear();
    this.logger.debug('Period cache cleared');
  }
}
