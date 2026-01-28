import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO representing an error that occurred while processing a row
 */
export class RowErrorDto {
  @ApiProperty({
    description: 'Número de fila (1-indexed) donde ocurrió el error',
    example: 15,
  })
  row_number: number;

  @ApiProperty({
    description: 'Tipo de error que ocurrió',
    enum: ['validation', 'database', 'business_rule'],
    example: 'validation',
  })
  error_type: 'validation' | 'database' | 'business_rule';

  @ApiProperty({
    description: 'Mensaje descriptivo del error',
    example: 'Amount mismatch - floor(1542.42) != 1500',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Detalles adicionales del error',
    example: {
      concepto: 'Pago mensual',
      deposito: 1500.99,
      casa: 0,
    },
  })
  details?: Record<string, any>;
}
