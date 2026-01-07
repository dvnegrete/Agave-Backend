import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RowErrorDto } from './row-error.dto';

/**
 * DTO for the response of historical records upload operation
 */
export class HistoricalRecordResponseDto {
  @ApiProperty({
    description: 'Total de filas procesadas del archivo Excel',
    example: 100,
  })
  total_rows: number;

  @ApiProperty({
    description: 'Número de filas procesadas exitosamente',
    example: 95,
  })
  successful: number;

  @ApiProperty({
    description: 'Número de filas que fallaron al procesar',
    example: 5,
  })
  failed: number;

  @ApiProperty({
    description: 'Tasa de éxito como porcentaje',
    example: 95.0,
  })
  success_rate: number;

  @ApiPropertyOptional({
    description: 'Lista de errores ocurridos durante el procesamiento',
    type: [RowErrorDto],
    example: [
      {
        row_number: 15,
        error_type: 'validation',
        message: 'Amount mismatch - floor(1542.42) != 1500',
      },
    ],
  })
  errors: RowErrorDto[];

  @ApiPropertyOptional({
    description: 'IDs de registros creados exitosamente en la base de datos',
    type: [Number],
    example: [1, 2, 3, 4, 5],
  })
  created_record_ids: number[];
}
