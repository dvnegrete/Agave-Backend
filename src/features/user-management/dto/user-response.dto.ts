import { ApiProperty } from '@nestjs/swagger';
import { Role, Status } from '@/shared/database/entities/enums';

export class UserResponseDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    description: 'ID único del usuario',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    enum: Role,
    description: 'Rol del usuario',
    example: Role.TENANT,
  })
  role: Role;

  @ApiProperty({
    enum: Status,
    description: 'Estado del usuario',
    example: Status.ACTIVE,
  })
  status: Status;

  @ApiProperty({
    type: 'string',
    nullable: true,
    description: 'Nombre del usuario',
    example: 'Juan Pérez',
  })
  name: string | null;

  @ApiProperty({
    type: 'string',
    format: 'email',
    nullable: true,
    description: 'Email del usuario',
    example: 'juan@example.com',
  })
  email: string | null;

  @ApiProperty({
    type: 'number',
    nullable: true,
    description: 'Teléfono celular del usuario',
    example: 3001234567,
  })
  cel_phone: number | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'number' },
    description: 'Lista de números de casas asignadas al usuario',
    example: [101, 102, 201],
  })
  houses: number[];

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Fecha de creación del usuario',
  })
  created_at: Date;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Fecha de última actualización del usuario',
  })
  updated_at: Date;
}
