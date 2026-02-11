import { HousePeriodCharge } from '@/shared/database/entities';

/**
 * Interface para el repositorio de Cargos de Casa-Período
 * Define el contrato para operaciones de persistencia de house_period_charges
 */
export interface IHousePeriodChargeRepository {
  /**
   * Encuentra un cargo por ID
   */
  findById(id: number): Promise<HousePeriodCharge | null>;

  /**
   * Encuentra todos los cargos de una casa en un período específico
   */
  findByHouseAndPeriod(
    houseId: number,
    periodId: number,
  ): Promise<HousePeriodCharge[]>;

  /**
   * Encuentra todos los cargos de un período
   */
  findByPeriod(periodId: number): Promise<HousePeriodCharge[]>;

  /**
   * Crea un nuevo cargo
   */
  create(charge: Partial<HousePeriodCharge>): Promise<HousePeriodCharge>;

  /**
   * Crea múltiples cargos en batch
   */
  createBatch(
    charges: Partial<HousePeriodCharge>[],
  ): Promise<HousePeriodCharge[]>;

  /**
   * Actualiza un cargo existente
   */
  update(
    id: number,
    data: Partial<HousePeriodCharge>,
  ): Promise<HousePeriodCharge>;

  /**
   * Elimina un cargo
   */
  delete(id: number): Promise<boolean>;

  /**
   * Obtiene el total esperado de una casa en un período (suma de todos los cargos)
   */
  getTotalExpectedByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<number>;
}
