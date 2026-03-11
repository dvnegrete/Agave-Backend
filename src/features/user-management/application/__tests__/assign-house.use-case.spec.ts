import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssignHouseUseCase } from '../assign-house.use-case';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { House } from '@/shared/database/entities';

describe('AssignHouseUseCase', () => {
  let useCase: AssignHouseUseCase;
  let houseRepository: jest.Mocked<HouseRepository>;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: 'user-123',
    role: 'USER',
    status: 'ACTIVE',
    name: 'Test User',
    email: 'test@example.com',
    observations: null,
    cel_phone: '+1234567890',
  };

  const mockHouse = {
    id: 1,
    number_house: 10,
    user_id: null,
  };

  const mockHouseAssigned = {
    id: 2,
    number_house: 20,
    user_id: 'other-user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignHouseUseCase,
        {
          provide: HouseRepository,
          useValue: {
            findByNumberHouse: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<AssignHouseUseCase>(AssignHouseUseCase);
    houseRepository = module.get(HouseRepository) as jest.Mocked<HouseRepository>;
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should assign house to user successfully', async () => {
      const assignedHouse = { ...mockHouse, user_id: 'user-123' };
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      houseRepository.update.mockResolvedValue(assignedHouse as any);

      const result = await useCase.execute('user-123', { house_number: 10 });

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(houseRepository.findByNumberHouse).toHaveBeenCalledWith(10);
      expect(houseRepository.update).toHaveBeenCalledWith(1, {
        user_id: 'user-123',
      });
      expect(result.user_id).toBe('user-123');
      expect(result.number_house).toBe(10);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute('nonexistent-user', { house_number: 10 }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        useCase.execute('nonexistent-user', { house_number: 10 }),
      ).rejects.toThrow('Usuario con ID nonexistent-user no encontrado');
    });

    it('should throw NotFoundException if house not found', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(null);

      await expect(useCase.execute('user-123', { house_number: 999 })).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute('user-123', { house_number: 999 })).rejects.toThrow(
        'Casa con número 999 no encontrada',
      );
    });

    it('should not call house update if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      try {
        await useCase.execute('nonexistent-user', { house_number: 10 });
      } catch (error) {
        // Expected error
      }

      expect(houseRepository.update).not.toHaveBeenCalled();
    });

    it('should not call house update if house not found', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(null);

      try {
        await useCase.execute('user-123', { house_number: 999 });
      } catch (error) {
        // Expected error
      }

      expect(houseRepository.update).not.toHaveBeenCalled();
    });

    it('should reassign house from one user to another', async () => {
      const reassignedHouse = { ...mockHouseAssigned, user_id: 'user-123' };
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouseAssigned as any);
      houseRepository.update.mockResolvedValue(reassignedHouse as any);

      const result = await useCase.execute('user-123', { house_number: 20 });

      expect(houseRepository.update).toHaveBeenCalledWith(2, {
        user_id: 'user-123',
      });
      expect(result.user_id).toBe('user-123');
      expect(result.number_house).toBe(20);
    });

    it('should return updated house with all properties', async () => {
      const assignedHouse = {
        id: 1,
        number_house: 10,
        user_id: 'user-123',
        status: 'ACTIVE',
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-15'),
      };
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      houseRepository.update.mockResolvedValue(assignedHouse as any);

      const result = await useCase.execute('user-123', { house_number: 10 });

      expect(result).toEqual(assignedHouse);
      expect(result.id).toBe(1);
      expect(result.number_house).toBe(10);
    });

    it('should assign house with different house numbers', async () => {
      const houseNumbers = [1, 10, 25, 50, 66];

      for (const houseNumber of houseNumbers) {
        const house = { id: houseNumber, number_house: houseNumber, user_id: null };
        const assignedHouse = { ...house, user_id: 'user-123' };

        userRepository.findById.mockResolvedValue(mockUser as any);
        houseRepository.findByNumberHouse.mockResolvedValue(house as any);
        houseRepository.update.mockResolvedValue(assignedHouse as any);

        const result = await useCase.execute('user-123', {
          house_number: houseNumber,
        });

        expect(result.number_house).toBe(houseNumber);
        expect(result.user_id).toBe('user-123');
      }
    });
  });
});
