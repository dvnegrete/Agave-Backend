import { Test, TestingModule } from '@nestjs/testing';
import { UserManagementController } from '../user-management.controller';
import {
  GetUsersUseCase,
  UpdateUserRoleUseCase,
  UpdateUserStatusUseCase,
  UpdateUserObservationsUseCase,
  AssignHouseUseCase,
  RemoveHouseUseCase,
  DeleteUserUseCase,
} from '../../application';
import {
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpdateUserObservationsDto,
  AssignHouseToUserDto,
  UserResponseDto,
} from '../../dto';
import { Role, Status } from '@/shared/database/entities/enums';
import { User, House } from '@/shared/database/entities';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';

describe('UserManagementController', () => {
  let controller: UserManagementController;
  let getUsersUseCase: jest.Mocked<GetUsersUseCase>;
  let updateUserRoleUseCase: jest.Mocked<UpdateUserRoleUseCase>;
  let updateUserStatusUseCase: jest.Mocked<UpdateUserStatusUseCase>;
  let updateUserObservationsUseCase: jest.Mocked<UpdateUserObservationsUseCase>;
  let assignHouseUseCase: jest.Mocked<AssignHouseUseCase>;
  let removeHouseUseCase: jest.Mocked<RemoveHouseUseCase>;
  let deleteUserUseCase: jest.Mocked<DeleteUserUseCase>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockHouseNumber = 1;

  const mockUserEntity = {
    id: mockUserId,
    name: 'Juan Pérez',
    email: 'juan@example.com',
    role: Role.OWNER,
    status: Status.ACTIVE,
    cel_phone: 3001234567,
    houses: [{ number_house: mockHouseNumber, user_id: mockUserId }] as any,
    observations: 'Observaciones del usuario',
    created_at: new Date(),
    updated_at: new Date(),
    avatar: null,
    last_login: null,
    email_verified: false,
    email_verified_at: null,
    manualValidationApprovals: [],
  } as any;

  const mockUserResponseDto: UserResponseDto = {
    id: mockUserId,
    name: 'Juan Pérez',
    email: 'juan@example.com',
    role: Role.OWNER,
    status: Status.ACTIVE,
    cel_phone: 3001234567,
    houses: [mockHouseNumber],
    observations: 'Observaciones del usuario',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserManagementController],
      providers: [
        {
          provide: GetUsersUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: UpdateUserRoleUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: UpdateUserStatusUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: UpdateUserObservationsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: AssignHouseUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: RemoveHouseUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: DeleteUserUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserManagementController>(
      UserManagementController,
    );
    getUsersUseCase = module.get(GetUsersUseCase) as jest.Mocked<GetUsersUseCase>;
    updateUserRoleUseCase = module.get(UpdateUserRoleUseCase) as jest.Mocked<
      UpdateUserRoleUseCase
    >;
    updateUserStatusUseCase = module.get(
      UpdateUserStatusUseCase,
    ) as jest.Mocked<UpdateUserStatusUseCase>;
    updateUserObservationsUseCase = module.get(
      UpdateUserObservationsUseCase,
    ) as jest.Mocked<UpdateUserObservationsUseCase>;
    assignHouseUseCase = module.get(AssignHouseUseCase) as jest.Mocked<
      AssignHouseUseCase
    >;
    removeHouseUseCase = module.get(RemoveHouseUseCase) as jest.Mocked<
      RemoveHouseUseCase
    >;
    deleteUserUseCase = module.get(DeleteUserUseCase) as jest.Mocked<
      DeleteUserUseCase
    >;
  });

  describe('getUsers', () => {
    it('should return list of users', async () => {
      const mockUserEntities = [mockUserEntity];
      getUsersUseCase.execute.mockResolvedValue(mockUserEntities as any);

      const result = await controller.getUsers();

      expect(result).toBeDefined();
      expect(getUsersUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should return empty list when no users exist', async () => {
      getUsersUseCase.execute.mockResolvedValue([]);

      const result = await controller.getUsers();

      expect(result).toEqual([]);
      expect(getUsersUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle errors from use case', async () => {
      const error = new Error('Database connection failed');
      getUsersUseCase.execute.mockRejectedValue(error);

      await expect(controller.getUsers()).rejects.toThrow(error);
      expect(getUsersUseCase.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const dto: UpdateUserRoleDto = { role: Role.ADMIN };
      updateUserRoleUseCase.execute.mockResolvedValue({
        ...mockUserEntity,
        role: Role.ADMIN,
      });

      const result = await controller.updateUserRole(mockUserId, dto);

      expect(result).toBeDefined();
      expect(result.role).toBe(Role.ADMIN);
      expect(updateUserRoleUseCase.execute).toHaveBeenCalledWith(
        mockUserId,
        dto,
      );
    });

    it('should return transformed UserResponseDto', async () => {
      const dto: UpdateUserRoleDto = { role: Role.TENANT };
      updateUserRoleUseCase.execute.mockResolvedValue({
        ...mockUserEntity,
        role: Role.TENANT,
      });

      const result = await controller.updateUserRole(mockUserId, dto);

      expect(result.id).toBe(mockUserId);
      expect(result.houses).toEqual([mockHouseNumber]);
      expect(result.role).toBe(Role.TENANT);
    });

    it('should handle user not found error', async () => {
      const dto: UpdateUserRoleDto = { role: Role.ADMIN };
      updateUserRoleUseCase.execute.mockRejectedValue(
        new Error('User not found'),
      );

      await expect(
        controller.updateUserRole('invalid-id', dto),
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      const dto: UpdateUserStatusDto = { status: Status.SUSPEND };
      updateUserStatusUseCase.execute.mockResolvedValue({
        ...mockUserEntity,
        status: Status.SUSPEND,
      });

      const result = await controller.updateUserStatus(mockUserId, dto);

      expect(result).toBeDefined();
      expect(result.status).toBe(Status.SUSPEND);
      expect(updateUserStatusUseCase.execute).toHaveBeenCalledWith(
        mockUserId,
        dto,
      );
    });

    it('should handle status transitions', async () => {
      const statuses = [Status.ACTIVE, Status.SUSPEND, Status.INACTIVE];

      for (const status of statuses) {
        const dto: UpdateUserStatusDto = { status };
        updateUserStatusUseCase.execute.mockResolvedValue({
          ...mockUserEntity,
          status,
        });

        const result = await controller.updateUserStatus(mockUserId, dto);
        expect(result.status).toBe(status);
      }
    });

    it('should handle invalid status', async () => {
      const dto: UpdateUserStatusDto = { status: Status.ACTIVE };
      updateUserStatusUseCase.execute.mockRejectedValue(
        new Error('Invalid status'),
      );

      await expect(
        controller.updateUserStatus(mockUserId, dto),
      ).rejects.toThrow('Invalid status');
    });
  });

  describe('updateUserObservations', () => {
    it('should update user observations successfully', async () => {
      const dto: UpdateUserObservationsDto = { observations: 'Nuevas notas' };
      const updatedUser = {
        ...mockUserEntity,
        observations: 'Nuevas notas',
      };
      updateUserObservationsUseCase.execute.mockResolvedValue(updatedUser);

      const result = await controller.updateUserObservations(mockUserId, dto);

      expect(result).toBeDefined();
      expect(result.observations).toBe('Nuevas notas');
      expect(updateUserObservationsUseCase.execute).toHaveBeenCalledWith(
        mockUserId,
        dto,
      );
    });

    it('should handle empty observations', async () => {
      const dto: UpdateUserObservationsDto = { observations: '' };
      const updatedUser = {
        ...mockUserEntity,
        observations: '',
      };
      updateUserObservationsUseCase.execute.mockResolvedValue(updatedUser);

      const result = await controller.updateUserObservations(mockUserId, dto);

      expect(result.observations).toBe('');
    });
  });

  describe('assignHouse', () => {
    it('should assign house to user successfully', async () => {
      const dto: AssignHouseToUserDto = { house_number: mockHouseNumber };
      const mockHouseEntity = {
        id: 1,
        number_house: mockHouseNumber,
        user_id: mockUserId,
        user: null,
        created_at: new Date(),
        updated_at: new Date(),
        houseRecords: [],
        recordAllocations: [],
        houseBalance: null,
        housePeriodOverrides: [],
        housePeriodCharges: [],
        statusSnapshot: null,
      } as any;
      assignHouseUseCase.execute.mockResolvedValue(mockHouseEntity);

      const result = await controller.assignHouse(mockUserId, dto);

      expect(result.message).toBe('Casa asignada exitosamente');
      expect(result.house_number).toBe(mockHouseNumber);
      expect(result.user_id).toBe(mockUserId);
      expect(assignHouseUseCase.execute).toHaveBeenCalledWith(mockUserId, dto);
    });

    it('should handle house already assigned', async () => {
      const dto: AssignHouseToUserDto = { house_number: mockHouseNumber };
      assignHouseUseCase.execute.mockRejectedValue(
        new Error('Casa ya asignada'),
      );

      await expect(
        controller.assignHouse(mockUserId, dto),
      ).rejects.toThrow('Casa ya asignada');
    });

    it('should handle user not found', async () => {
      const dto: AssignHouseToUserDto = { house_number: mockHouseNumber };
      assignHouseUseCase.execute.mockRejectedValue(
        new Error('Usuario no encontrado'),
      );

      await expect(
        controller.assignHouse('invalid-id', dto),
      ).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('removeHouse', () => {
    it('should remove house from user successfully', async () => {
      removeHouseUseCase.execute.mockResolvedValue(undefined);

      const result = await controller.removeHouse(
        mockUserId,
        mockHouseNumber,
      );

      expect(result.message).toBe(
        `Casa ${mockHouseNumber} removida del usuario exitosamente`,
      );
      expect(removeHouseUseCase.execute).toHaveBeenCalledWith(
        mockUserId,
        mockHouseNumber,
      );
    });

    it('should handle house not owned by user', async () => {
      removeHouseUseCase.execute.mockRejectedValue(
        new Error('La casa no pertenece al usuario'),
      );

      await expect(
        controller.removeHouse(mockUserId, mockHouseNumber),
      ).rejects.toThrow('La casa no pertenece al usuario');
    });

    it('should handle user not found', async () => {
      removeHouseUseCase.execute.mockRejectedValue(
        new Error('Usuario no encontrado'),
      );

      await expect(
        controller.removeHouse('invalid-id', mockHouseNumber),
      ).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      deleteUserUseCase.execute.mockResolvedValue(undefined);

      const result = await controller.deleteUser(mockUserId);

      expect(result.message).toBe('Usuario eliminado exitosamente');
      expect(deleteUserUseCase.execute).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle user not found', async () => {
      deleteUserUseCase.execute.mockRejectedValue(
        new Error('Usuario no encontrado'),
      );

      await expect(controller.deleteUser('invalid-id')).rejects.toThrow(
        'Usuario no encontrado',
      );
    });

    it('should handle user with assigned houses', async () => {
      deleteUserUseCase.execute.mockRejectedValue(
        new Error('No se puede eliminar usuario con casas asignadas'),
      );

      await expect(controller.deleteUser(mockUserId)).rejects.toThrow(
        'No se puede eliminar usuario con casas asignadas',
      );
    });

    it('should handle system user deletion attempt', async () => {
      deleteUserUseCase.execute.mockRejectedValue(
        new Error('No se puede eliminar el usuario del sistema'),
      );

      const systemUserId = '00000000-0000-0000-0000-000000000000';
      await expect(controller.deleteUser(systemUserId)).rejects.toThrow(
        'No se puede eliminar el usuario del sistema',
      );
    });
  });
});
