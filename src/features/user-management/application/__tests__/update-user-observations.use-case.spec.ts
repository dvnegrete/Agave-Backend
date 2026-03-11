import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateUserObservationsUseCase } from '../update-user-observations.use-case';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { User } from '@/shared/database/entities';

describe('UpdateUserObservationsUseCase', () => {
  let useCase: UpdateUserObservationsUseCase;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-123',
    role: 'USER',
    status: 'ACTIVE',
    name: 'Test User',
    email: 'test@example.com',
    observations: 'Original observation',
    cel_phone: '+1234567890',
    houses: [],
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-15'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserObservationsUseCase,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<UpdateUserObservationsUseCase>(
      UpdateUserObservationsUseCase,
    );
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should set observations to a new value', async () => {
      const updatedUser = { ...mockUser, observations: 'Updated observation' };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', {
        observations: 'Updated observation',
      });

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        observations: 'Updated observation',
      });
      expect(result.observations).toBe('Updated observation');
    });

    it('should clear observations when null is provided', async () => {
      const updatedUser = { ...mockUser, observations: null };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', { observations: null });

      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        observations: null,
      });
      expect(result.observations).toBeNull();
    });

    it('should skip update when observations is undefined', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(mockUser as any);

      await useCase.execute('user-123', { observations: undefined });

      expect(userRepository.update).toHaveBeenCalledWith('user-123', {});
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('nonexistent-user', { observations: 'Some note' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        useCase.execute('nonexistent-user', { observations: 'Some note' }),
      ).rejects.toThrow('Usuario con ID nonexistent-user no encontrado');
    });

    it('should not call update if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      try {
        await useCase.execute('nonexistent-user', { observations: 'Some note' });
      } catch (error) {
        // Expected error
      }

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it('should handle empty string observations', async () => {
      const updatedUser = { ...mockUser, observations: '' };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', { observations: '' });

      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        observations: '',
      });
      expect(result.observations).toBe('');
    });

    it('should return updated user with all properties', async () => {
      const updatedUser = {
        ...mockUser,
        observations: 'New observation',
        updated_at: new Date('2025-01-20'),
      };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', {
        observations: 'New observation',
      });

      expect(result).toEqual(updatedUser);
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@example.com');
      expect(result.observations).toBe('New observation');
    });

    it('should handle long text observations', async () => {
      const longObservation = 'A'.repeat(500);
      const updatedUser = { ...mockUser, observations: longObservation };
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await useCase.execute('user-123', {
        observations: longObservation,
      });

      expect(result.observations).toBe(longObservation);
      expect(result.observations.length).toBe(500);
    });
  });
});
