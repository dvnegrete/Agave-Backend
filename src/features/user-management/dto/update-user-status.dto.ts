import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Status } from '@/shared/database/entities/enums';

export class UpdateUserStatusDto {
  @IsEnum(Status)
  @ApiProperty({
    enum: Status,
    description: 'Nuevo estado del usuario',
    example: Status.ACTIVE,
  })
  status: Status;
}
