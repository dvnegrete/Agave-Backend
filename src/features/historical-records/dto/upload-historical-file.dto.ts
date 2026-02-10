import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for historical records file upload request
 */
export class UploadHistoricalFileDto {
  @ApiPropertyOptional({
    description: 'Descripción opcional del archivo histórico',
    example: 'Registros históricos 2020-2023',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Solo validar sin insertar registros en la base de datos (modo seco/dry-run)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  validateOnly?: boolean;
}
