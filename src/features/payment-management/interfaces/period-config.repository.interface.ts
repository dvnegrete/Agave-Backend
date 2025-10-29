import { PeriodConfig } from '@/shared/database/entities';

/**
 * Interface para el repositorio de Configuración de Períodos
 */
export interface IPeriodConfigRepository {
  /**
   * Crea una nueva configuración de período
   */
  create(data: {
    default_maintenance_amount: number;
    default_water_amount?: number;
    default_extraordinary_fee_amount?: number;
    payment_due_day: number;
    late_payment_penalty_amount: number;
    effective_from: Date;
    effective_until?: Date;
    is_active?: boolean;
  }): Promise<PeriodConfig>;

  /**
   * Busca la configuración activa para una fecha específica
   */
  findActiveForDate(date: Date): Promise<PeriodConfig | null>;

  /**
   * Busca todas las configuraciones
   */
  findAll(): Promise<PeriodConfig[]>;

  /**
   * Busca una configuración por ID
   */
  findById(id: number): Promise<PeriodConfig | null>;

  /**
   * Actualiza una configuración
   */
  update(
    id: number,
    data: Partial<{
      default_maintenance_amount: number;
      default_water_amount: number;
      default_extraordinary_fee_amount: number;
      payment_due_day: number;
      late_payment_penalty_amount: number;
      effective_from: Date;
      effective_until: Date;
      is_active: boolean;
    }>,
  ): Promise<PeriodConfig>;

  /**
   * Desactiva una configuración
   */
  deactivate(id: number): Promise<PeriodConfig>;
}
