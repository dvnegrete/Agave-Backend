import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para asignar una casa a un usuario (desde user-management)
 * Nota: El DTO similar AssignHouseDto en unclaimed-deposits.dto.ts
 * se usa para asignar casas a depósitos no conciliados
 */
export class AssignHouseToUserDto {
  @IsNumber()
  @ApiProperty({
    type: 'number',
    description: 'Número de la casa a asignar',
    example: 101,
  })
  house_number: number;
}
