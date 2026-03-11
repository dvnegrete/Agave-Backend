import { Injectable, Inject, Logger } from '@nestjs/common';
import { House } from '@/shared/database/entities';
import {
  EnrichedHouseBalance,
} from '../../domain/house-balance-status.types';
import { IHouseStatusSnapshotRepository } from '../../interfaces/house-status-snapshot.repository.interface';
import { CalculateHouseBalanceStatusUseCase } from '../../application/calculate-house-balance-status.use-case';

/**
 * Servicio que gestiona snapshots denormalizados de estados de casas
 * Evita recálculos repetidos usando un TTL de 24 horas
 */
@Injectable()
export class HouseStatusSnapshotService {
  private readonly logger = new Logger(HouseStatusSnapshotService.name);
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

  constructor(
    @Inject('IHouseStatusSnapshotRepository')
    private readonly repository: IHouseStatusSnapshotRepository,
    private readonly calculateStatusUseCase: CalculateHouseBalanceStatusUseCase,
  ) {}

  /**
   * Obtiene el estado de una casa, usando snapshot si es fresco
   * o recalculando si es stale o no existe
   *
   * @param houseId ID de la casa
   * @param house Entidad House (necesaria para cálculo)
   * @returns EnrichedHouseBalance (fresco del snapshot o recalculado)
   */
  async getOrCalculate(
    houseId: number,
    house: House,
  ): Promise<EnrichedHouseBalance> {
    // 1. Buscar snapshot
    const snapshot = await this.repository.findByHouseId(houseId);

    // 2. Verificar si es fresco
    if (
      snapshot &&
      !snapshot.is_stale &&
      this.isWithinTTL(snapshot.calculated_at)
    ) {
      this.logger.debug(
        `[Snapshot HIT] House ${houseId}: using cached result from ${snapshot.calculated_at}`,
      );
      return snapshot.enriched_data as EnrichedHouseBalance;
    }

    // 3. Recalcular (snapshot no existe, es stale, o expiró TTL)
    this.logger.debug(
      `[Snapshot MISS] House ${houseId}: calculating fresh result`,
    );
    const enriched = await this.calculateStatusUseCase.execute(houseId, house);

    // 4. Guardar snapshot
    await this.repository.upsert(houseId, {
      status: enriched.status,
      total_debt: enriched.total_debt,
      credit_balance: enriched.credit_balance,
      total_unpaid_periods: enriched.total_unpaid_periods,
      enriched_data: enriched,
      is_stale: false,
      calculated_at: new Date(),
      invalidated_at: null,
    });

    // 5. Retornar resultado
    return enriched;
  }

  /**
   * Obtiene estados de múltiples casas en bulk
   * Lee snapshots frescos desde BD, recalcula los stale
   *
   * @param houses Array de entidades House
   * @returns Array de EnrichedHouseBalance en orden de entrada
   */
  async getAllForSummary(houses: House[]): Promise<EnrichedHouseBalance[]> {
    if (houses.length === 0) {
      return [];
    }

    // 1. Leer todos los snapshots en 1 query
    const snapshots = await this.repository.findAll();
    const snapshotMap = new Map(
      snapshots.map((s) => [s.house_id, s]),
    );

    // 2. Identificar stale, missing, expired
    const toRecalculate: House[] = [];
    for (const house of houses) {
      const snapshot = snapshotMap.get(house.id);
      if (
        !snapshot ||
        snapshot.is_stale ||
        !this.isWithinTTL(snapshot.calculated_at)
      ) {
        toRecalculate.push(house);
      }
    }

    // 3. Recalcular stale/missing (en paralelo)
    if (toRecalculate.length > 0) {
      this.logger.debug(
        `[Snapshot BULK] Recalculating ${toRecalculate.length}/${houses.length} houses`,
      );
      const enrichedResults = await Promise.all(
        toRecalculate.map((house) =>
          this.calculateStatusUseCase.execute(house.id, house),
        ),
      );

      // Guardar todos los nuevos snapshots en paralelo
      await Promise.all(
        enrichedResults.map((enriched) =>
          this.repository.upsert(enriched.house_id, {
            status: enriched.status,
            total_debt: enriched.total_debt,
            credit_balance: enriched.credit_balance,
            total_unpaid_periods: enriched.total_unpaid_periods,
            enriched_data: enriched,
            is_stale: false,
            calculated_at: new Date(),
            invalidated_at: null,
          }),
        ),
      );

      // Actualizar el map local
      enrichedResults.forEach((enriched) => {
        snapshotMap.set(enriched.house_id, {
          ...snapshotMap.get(enriched.house_id),
          enriched_data: enriched,
          is_stale: false,
          calculated_at: new Date(),
        } as any);
      });
    }

    // 4. Retornar en orden original (preservar orden de entrada)
    return houses
      .map((house) => {
        const snapshot = snapshotMap.get(house.id);
        if (!snapshot) {
          throw new Error(`No snapshot found for house ${house.id}`);
        }
        return snapshot.enriched_data as EnrichedHouseBalance;
      });
  }

  /**
   * Invalida el snapshot de una casa
   */
  async invalidateByHouseId(houseId: number): Promise<void> {
    await this.repository.invalidateByHouseId(houseId);
    this.logger.debug(`[Snapshot INVALIDATED] House ${houseId}`);
  }

  /**
   * Invalida todos los snapshots
   */
  async invalidateAll(): Promise<void> {
    await this.repository.invalidateAll();
    this.logger.debug(`[Snapshot INVALIDATED] All houses`);
  }

  /**
   * Invalida snapshots para múltiples casas
   */
  async invalidateByHouseIds(houseIds: number[]): Promise<void> {
    if (houseIds.length === 0) {
      return;
    }
    await this.repository.invalidateByHouseIds(houseIds);
    this.logger.debug(`[Snapshot INVALIDATED] ${houseIds.length} houses`);
  }

  /**
   * Verifica si un snapshot está dentro del TTL
   */
  private isWithinTTL(calculatedAt: Date | null): boolean {
    if (!calculatedAt) {
      return false;
    }
    const age = Date.now() - new Date(calculatedAt).getTime();
    return age < this.TTL_MS;
  }
}
