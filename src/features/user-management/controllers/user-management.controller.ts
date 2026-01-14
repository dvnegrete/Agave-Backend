import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { RoleGuard } from '@/shared/auth/guards/roles.guard';
import { Roles } from '@/shared/auth/decorators/roles.decorator';
import { Role } from '@/shared/database/entities/enums';
import {
  GetUsersUseCase,
  UpdateUserRoleUseCase,
  UpdateUserStatusUseCase,
  AssignHouseUseCase,
  RemoveHouseUseCase,
} from '../application';
import {
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  AssignHouseDto,
  UserResponseDto,
} from '../dto';

@ApiTags('User Management')
@Controller('user-management')
@UseGuards(AuthGuard, RoleGuard)
@Roles(Role.ADMIN)
export class UserManagementController {
  constructor(
    private readonly getUsersUseCase: GetUsersUseCase,
    private readonly updateUserRoleUseCase: UpdateUserRoleUseCase,
    private readonly updateUserStatusUseCase: UpdateUserStatusUseCase,
    private readonly assignHouseUseCase: AssignHouseUseCase,
    private readonly removeHouseUseCase: RemoveHouseUseCase,
  ) {}

  /**
   * GET /user-management/users
   * Obtiene la lista de todos los usuarios con sus casas asignadas
   */
  @Get('users')
  @ApiOperation({
    summary: 'Listar todos los usuarios',
    description:
      'Obtiene una lista completa de usuarios con sus roles, estados y casas asignadas. Solo accesible para administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - se requiere rol de administrador',
  })
  async getUsers(): Promise<UserResponseDto[]> {
    return this.getUsersUseCase.execute();
  }

  /**
   * PATCH /user-management/users/:userId/role
   * Actualiza el rol de un usuario
   */
  @Patch('users/:userId/role')
  @ApiOperation({
    summary: 'Actualizar rol de usuario',
    description:
      'Cambia el rol de un usuario existente (admin, owner, tenant). Solo accesible para administradores.',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID único del usuario a actualizar',
  })
  @ApiBody({
    type: UpdateUserRoleDto,
    description: 'Nuevo rol para el usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Rol actualizado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserRoleUseCase.execute(userId, dto);

    // Transform to response DTO
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      name: user.name,
      email: user.email,
      cel_phone: user.cel_phone,
      houses: (user.houses || []).map((house) => house.number_house),
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * PATCH /user-management/users/:userId/status
   * Actualiza el estado de un usuario
   */
  @Patch('users/:userId/status')
  @ApiOperation({
    summary: 'Actualizar estado de usuario',
    description:
      'Cambia el estado de un usuario existente (active, suspend, inactive). Solo accesible para administradores.',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID único del usuario a actualizar',
  })
  @ApiBody({
    type: UpdateUserStatusDto,
    description: 'Nuevo estado para el usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserStatusUseCase.execute(userId, dto);

    // Transform to response DTO
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      name: user.name,
      email: user.email,
      cel_phone: user.cel_phone,
      houses: (user.houses || []).map((house) => house.number_house),
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * POST /user-management/users/:userId/houses
   * Asigna una casa a un usuario
   */
  @Post('users/:userId/houses')
  @ApiOperation({
    summary: 'Asignar casa a usuario',
    description:
      'Asigna una casa existente a un usuario. Si la casa ya está asignada a otro usuario, se reasignará. Solo accesible para administradores.',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID único del usuario',
  })
  @ApiBody({
    type: AssignHouseDto,
    description: 'Número de la casa a asignar',
  })
  @ApiResponse({
    status: 201,
    description: 'Casa asignada exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Casa asignada exitosamente' },
        house_number: { type: 'number', example: 101 },
        user_id: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario o casa no encontrados',
  })
  async assignHouse(
    @Param('userId') userId: string,
    @Body() dto: AssignHouseDto,
  ): Promise<{ message: string; house_number: number; user_id: string }> {
    const house = await this.assignHouseUseCase.execute(userId, dto);

    return {
      message: 'Casa asignada exitosamente',
      house_number: house.number_house,
      user_id: house.user_id,
    };
  }

  /**
   * DELETE /user-management/users/:userId/houses/:houseNumber
   * Remueve una casa de un usuario
   */
  @Delete('users/:userId/houses/:houseNumber')
  @ApiOperation({
    summary: 'Remover casa de usuario',
    description:
      'Desasigna una casa de un usuario. Solo accesible para administradores.',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID único del usuario',
  })
  @ApiParam({
    name: 'houseNumber',
    type: 'number',
    description: 'Número de la casa a remover',
  })
  @ApiResponse({
    status: 200,
    description: 'Casa removida exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Casa 101 removida del usuario exitosamente',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario o casa no encontrados',
  })
  @ApiResponse({
    status: 400,
    description: 'La casa no pertenece al usuario',
  })
  async removeHouse(
    @Param('userId') userId: string,
    @Param('houseNumber', ParseIntPipe) houseNumber: number,
  ): Promise<{ message: string }> {
    await this.removeHouseUseCase.execute(userId, houseNumber);

    return {
      message: `Casa ${houseNumber} removida del usuario exitosamente`,
    };
  }
}
