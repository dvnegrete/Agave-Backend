import { RecordAllocation } from '@/shared/database/entities';
import {
  AllocationConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';

/**
 * Interface para el repositorio de Asignaciones de Pago
 * Define el contrato para operaciones de persistencia de record_allocations
 */
export interface IRecordAllocationRepository {
  /**
   * Encuentra todas las asignaciones de una casa
   */
  findByHouseId(houseId: number): Promise<RecordAllocation[]>;

  /**
   * Encuentra asignaciones de una casa en un período específico
   */
  findByHouseAndPeriod(
    houseId: number,
    periodId: number,
  ): Promise<RecordAllocation[]>;

  /**
   * Encuentra asignaciones de un registro de pago
   */
  findByRecordId(recordId: number): Promise<RecordAllocation[]>;

  /**
   * Encuentra asignaciones de un período
   */
  findByPeriodId(periodId: number): Promise<RecordAllocation[]>;

  /**
   * Encuentra una asignación específica por house, period y concept
   */
  findByHousePeriodAndConcept(
    houseId: number,
    periodId: number,
    conceptType: AllocationConceptType,
  ): Promise<RecordAllocation | null>;

  /**
   * Encuentra asignaciones con un estado específico de pago
   */
  findByPaymentStatus(status: PaymentStatus): Promise<RecordAllocation[]>;

  /**
   * Crea una nueva asignación de pago
   */
  create(allocation: Partial<RecordAllocation>): Promise<RecordAllocation>;

  /**
   * Crea múltiples asignaciones en una transacción
   */
  createBatch(
    allocations: Partial<RecordAllocation>[],
  ): Promise<RecordAllocation[]>;

  /**
   * Actualiza una asignación existente
   */
  update(
    id: number,
    allocation: Partial<RecordAllocation>,
  ): Promise<RecordAllocation>;

  /**
   * Encuentra una asignación por ID
   */
  findById(id: number): Promise<RecordAllocation | null>;

  /**
   * Encuentra una asignación con relaciones cargadas
   */
  findByIdWithRelations(id: number): Promise<RecordAllocation | null>;

  /**
   * Elimina una asignación
   */
  delete(id: number): Promise<boolean>;

  /**
   * Obtiene el total pagado de una casa en un período
   */
  getTotalPaidByHousePeriod(houseId: number, periodId: number): Promise<number>;

  /**
   * Obtiene el total esperado de una casa en un período
   */
  getTotalExpectedByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<number>;
}
