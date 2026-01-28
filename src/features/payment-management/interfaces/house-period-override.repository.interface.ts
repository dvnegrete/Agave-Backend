import { HousePeriodOverride } from '@/shared/database/entities';
import { ConceptType } from '@/shared/database/entities/enums';

/**
 * Interface para el repositorio de Sobrescrituras de Casa-Período
 * Define el contrato para operaciones de persistencia de house_period_overrides
 */
export interface IHousePeriodOverrideRepository {
  /**
   * Encuentra overrides para una casa en un período específico
   */
  findByHouseAndPeriod(
    houseId: number,
    periodId: number,
  ): Promise<HousePeriodOverride[]>;

  /**
   * Encuentra override específico para una casa, período y concepto
   */
  findByHousePeriodAndConcept(
    houseId: number,
    periodId: number,
    conceptType: ConceptType,
  ): Promise<HousePeriodOverride | null>;

  /**
   * Encuentra todos los overrides de una casa
   */
  findByHouseId(houseId: number): Promise<HousePeriodOverride[]>;

  /**
   * Encuentra todos los overrides de un período
   */
  findByPeriodId(periodId: number): Promise<HousePeriodOverride[]>;

  /**
   * Crea un nuevo override
   */
  create(override: Partial<HousePeriodOverride>): Promise<HousePeriodOverride>;

  /**
   * Actualiza un override existente
   */
  update(
    id: number,
    override: Partial<HousePeriodOverride>,
  ): Promise<HousePeriodOverride>;

  /**
   * Encuentra un override por ID
   */
  findById(id: number): Promise<HousePeriodOverride | null>;

  /**
   * Encuentra un override con relaciones cargadas
   */
  findByIdWithRelations(id: number): Promise<HousePeriodOverride | null>;

  /**
   * Elimina un override
   */
  delete(id: number): Promise<boolean>;

  /**
   * Obtiene el monto aplicable para una casa/período/concepto
   * (considera tanto montos globales como overrides)
   */
  getApplicableAmount(
    houseId: number,
    periodId: number,
    conceptType: ConceptType,
    globalAmount: number,
  ): Promise<number>;
}
