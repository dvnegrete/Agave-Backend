import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateUserRoleUseCase } from '../update-user-role.use-case';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { User } from '@/shared/database/entities';
import { Role, Status } from '@/shared/database/entities/enums';

describe('UpdateUserRoleUseCase', () => {
  let useCase: UpdateUserRoleUseCase;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-123',
    role: Role.TENANT,
    status: Status.ACTIVE,
    name: 'Test User',
    email: 'test@example.com',
    observations: null,
    cel_phone: '+1234567890',
    houses: [],
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-15'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserRoleUseCase,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<UpdateUserRoleUseCase>(UpdateUserRoleUseCase);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should update user role successfully', async () => {
      const updatedUser = { ...mockUser, role: Role.ADMIN };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', { role: Role.ADMIN });

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        role: Role.ADMIN,
      });
      expect(result.role).toBe(Role.ADMIN);
      expect(result.id).toBe('user-123');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute('nonexistent-user', { role: Role.ADMIN })).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute('nonexistent-user', { role: Role.ADMIN })).rejects.toThrow(
        'Usuario con ID nonexistent-user no encontrado',
      );
    });

    it('should not call update if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      try {
        await useCase.execute('nonexistent-user', { role: Role.ADMIN });
      } catch (error) {
        // Expected error
      }

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('should handle different role values', async () => {
      const roles = [Role.TENANT, Role.ADMIN, Role.OWNER];

      for (const role of roles) {
        userRepository.findById.mockResolvedValue(mockUser as any);
        const updatedUser = { ...mockUser, role };
        userRepository.update.mockResolvedValue(updatedUser as any);

        const result = await useCase.execute('user-123', { role });

        expect(result.role).toBe(role);
      }
    });

    it('should demote admin to tenant', async () => {
      const adminUser = { ...mockUser, role: Role.ADMIN };
      const demotedUser = { ...adminUser, role: Role.TENANT };

      userRepository.findById.mockResolvedValue(adminUser as any);
      userRepository.update.mockResolvedValue(demotedUser as any);

      const result = await useCase.execute('user-123', { role: Role.TENANT });

      expect(result.role).toBe(Role.TENANT);
      expect(result.id).toBe('user-123');
    });

    it('should return updated user with all properties', async () => {
      const updatedUser = {
        ...mockUser,
        role: Role.OWNER,
        updated_at: new Date('2025-01-20'),
      };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', { role: Role.OWNER });

      expect(result).toEqual(updatedUser);
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@example.com');
      expect(result.status).toBe(Status.ACTIVE);
    });
  });
});
