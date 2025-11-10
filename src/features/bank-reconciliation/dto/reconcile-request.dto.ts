import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReconcileRequestDto {
  /**
   * Fecha de inicio del rango (opcional)
   * Si no se proporciona, se procesan TODOS los registros pendientes
   */
  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango en formato ISO 8601 (YYYY-MM-DD)',
    example: '2025-01-01',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * Fecha de fin del rango (opcional)
   * Si no se proporciona, se procesan TODOS los registros pendientes
   */
  @ApiPropertyOptional({
    description: 'Fecha de fin del rango en formato ISO 8601 (YYYY-MM-DD)',
    example: '2025-01-31',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
