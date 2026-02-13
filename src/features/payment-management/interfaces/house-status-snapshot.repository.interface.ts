import { HouseStatusSnapshot } from '@/shared/database/entities';

/**
 * Interface para el repositorio de Snapshots de Estado de Casa
 * Define el contrato para operaciones de persistencia de house_status_snapshots
 */
export interface IHouseStatusSnapshotRepository {
  /**
   * Encuentra el snapshot para una casa por ID
   */
  findByHouseId(houseId: number): Promise<HouseStatusSnapshot | null>;

  /**
   * Obtiene todos los snapshots
   */
  findAll(): Promise<HouseStatusSnapshot[]>;

  /**
   * Obtiene solo los snapshots frescos (no stale)
   */
  findAllFresh(): Promise<HouseStatusSnapshot[]>;

  /**
   * Inserta o actualiza un snapshot
   * Si el house_id ya existe, actualiza; si no, crea uno nuevo
   */
  upsert(
    houseId: number,
    data: Partial<HouseStatusSnapshot>,
  ): Promise<HouseStatusSnapshot>;

  /**
   * Marca un snapshot como stale por house_id
   */
  invalidateByHouseId(houseId: number): Promise<void>;

  /**
   * Marca todos los snapshots como stale
   */
  invalidateAll(): Promise<void>;

  /**
   * Marca múltiples snapshots como stale por lista de house_ids
   */
  invalidateByHouseIds(houseIds: number[]): Promise<void>;
}
