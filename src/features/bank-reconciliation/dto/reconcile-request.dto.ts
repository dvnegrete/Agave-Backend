import { IsOptional, IsDateString } from 'class-validator';

export class ReconcileRequestDto {
  /**
   * Fecha de inicio del rango (opcional)
   * Si no se proporciona, se procesan TODOS los registros pendientes
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * Fecha de fin del rango (opcional)
   * Si no se proporciona, se procesan TODOS los registros pendientes
   */
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
