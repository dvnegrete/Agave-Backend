import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@/shared/database/entities/enums';

export class UpdateUserRoleDto {
  @IsEnum(Role)
  @ApiProperty({
    enum: Role,
    description: 'Nuevo rol del usuario',
    example: Role.OWNER,
  })
  role: Role;
}
