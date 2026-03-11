import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateUserStatusUseCase } from '../update-user-status.use-case';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { User } from '@/shared/database/entities';
import { Role, Status } from '@/shared/database/entities/enums';

describe('UpdateUserStatusUseCase', () => {
  let useCase: UpdateUserStatusUseCase;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-123',
    role: Role.ADMIN,
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
        UpdateUserStatusUseCase,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<UpdateUserStatusUseCase>(UpdateUserStatusUseCase);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should update user status successfully', async () => {
      const updatedUser = { ...mockUser, status: Status.INACTIVE };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', { status: Status.INACTIVE });

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        status: Status.INACTIVE,
      });
      expect(result.status).toBe(Status.INACTIVE);
      expect(result.id).toBe('user-123');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('nonexistent-user', { status: Status.INACTIVE }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        useCase.execute('nonexistent-user', { status: Status.INACTIVE }),
      ).rejects.toThrow('Usuario con ID nonexistent-user no encontrado');
    });

    it('should not call update if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      try {
        await useCase.execute('nonexistent-user', { status: Status.INACTIVE });
      } catch (error) {
        // Expected error
      }

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('should handle different status values', async () => {
      const statuses = [Status.ACTIVE, Status.INACTIVE, Status.SUSPEND];

      for (const status of statuses) {
        userRepository.findById.mockResolvedValue(mockUser as any);
        const updatedUser = { ...mockUser, status };
        userRepository.update.mockResolvedValue(updatedUser as any);

        const result = await useCase.execute('user-123', { status });

        expect(result.status).toBe(status);
      }
    });

    it('should return updated user with all properties', async () => {
      const updatedUser = {
        ...mockUser,
        status: Status.SUSPEND,
        updated_at: new Date('2025-01-20'),
      };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', { status: Status.SUSPEND });

      expect(result).toEqual(updatedUser);
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@example.com');
    });
  });
});
