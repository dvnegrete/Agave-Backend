import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignHouseDto {
  @IsNumber()
  @ApiProperty({
    type: 'number',
    description: 'Número de la casa a asignar',
    example: 101,
  })
  house_number: number;
}
