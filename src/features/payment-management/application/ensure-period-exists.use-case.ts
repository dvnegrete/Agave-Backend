import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Period } from '@/shared/database/entities';
import { PeriodDomain } from '../domain';
import { IPeriodRepository } from '../interfaces';
import { IPeriodConfigRepository } from '../interfaces';
import { SeedHousePeriodChargesService } from '@/features/payment-management/infrastructure/services';

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
    private readonly dataSource: DataSource,
    private readonly seedChargesService: SeedHousePeriodChargesService,
  ) {}

  async execute(year: number, month: number): Promise<PeriodDomain> {
    // Check cache first (common for historical records uploads where many rows are same month)
    const cacheKey = `${year}-${month}`;
    const cachedPeriod = this.periodCache.get(cacheKey);
    if (cachedPeriod) {
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
      return periodDomain;
    }

    // 2. Buscar configuración activa para la fecha del período
    const periodDate = new Date(year, month - 1, 1);
    const activeConfig =
      await this.periodConfigRepository.findActiveForDate(periodDate);

    // 3. Crear el nuevo período usando inserteo directo para evitar transacciones anidadas
    // TypeORM's repository.save() inicia una transacción automática, causando deadlocks
    // cuando se llama desde dentro de otra transacción
    const newPeriod = await this.createPeriodDirect(
      year,
      month,
      activeConfig?.id,
    );

    // 4. Seed de cargos esperados para todas las casas
    await this.seedChargesService.seedChargesForPeriod(newPeriod.id);

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
   * Crea un período directamente sin usar repository.save()
   * Evita transacciones anidadas que causan deadlocks
   * @private
   */
  private async createPeriodDirect(
    year: number,
    month: number,
    configId?: number,
  ): Promise<Period> {
    const result = await this.dataSource.query(
      `INSERT INTO "periods" ("year", "month", "period_config_id", "created_at", "updated_at")
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING "id", "year", "month", "start_date", "end_date", "period_config_id", "created_at", "updated_at"`,
      [year, month, configId || null],
    );

    if (!result || result.length === 0) {
      throw new Error(`Failed to create period ${year}-${month}`);
    }

    return result[0] as Period;
  }

  /**
   * Limpia el caché de períodos (útil para testing o reinicialización)
   */
  clearCache(): void {
    this.periodCache.clear();
  }
}
