import { Period } from '@/shared/database/entities';

/**
 * Interface para el repositorio de Períodos
 * Define el contrato para operaciones de persistencia
 */
export interface IPeriodRepository {
  /**
   * Crea un nuevo período
   */
  create(year: number, month: number, configId?: number): Promise<Period>;

  /**
   * Busca un período por año y mes
   */
  findByYearAndMonth(year: number, month: number): Promise<Period | null>;

  /**
   * Busca todos los períodos
   */
  findAll(): Promise<Period[]>;

  /**
   * Busca un período por ID
   */
  findById(id: number): Promise<Period | null>;

  /**
   * Busca un período por ID con sus relaciones cargadas
   */
  findByIdWithRelations(id: number): Promise<Period | null>;

  /**
   * Verifica si existe un período para año y mes
   */
  exists(year: number, month: number): Promise<boolean>;

  /**
   * Elimina un período si no tiene registros asociados
   */
  delete(id: number): Promise<boolean>;

  /**
   * Busca todos los períodos desde un año/mes dado hasta el actual, ordenados ASC
   */
  findFromDate(year: number, month: number): Promise<Period[]>;
}
