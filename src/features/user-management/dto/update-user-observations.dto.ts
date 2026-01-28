import { IsString, IsOptional, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserObservationsDto {
  @IsOptional()
  @ValidateIf((o) => o.observations !== null)
  @IsString()
  @MaxLength(500, { message: 'Las observaciones no pueden exceder 500 caracteres' })
  @ApiProperty({
    type: 'string',
    nullable: true,
    description: 'Observaciones sobre el usuario (o null para limpiar)',
    example: 'Usuario verificado, sin deudas pendientes',
    maxLength: 500,
  })
  observations?: string | null;
}
