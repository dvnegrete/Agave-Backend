import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RemoveHouseUseCase } from '../remove-house.use-case';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { SYSTEM_USER_ID } from '@/shared/config/business-rules.config';

describe('RemoveHouseUseCase', () => {
  let useCase: RemoveHouseUseCase;
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
    user_id: 'user-123',
  };

  const mockHouseWithDifferentUser = {
    id: 2,
    number_house: 20,
    user_id: 'other-user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveHouseUseCase,
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

    useCase = module.get<RemoveHouseUseCase>(RemoveHouseUseCase);
    houseRepository = module.get(HouseRepository) as jest.Mocked<HouseRepository>;
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should remove house from user successfully', async () => {
      const reassignedHouse = { ...mockHouse, user_id: SYSTEM_USER_ID };
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      houseRepository.update.mockResolvedValue(reassignedHouse as any);

      await expect(useCase.execute('user-123', 10)).resolves.toBeUndefined();

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(houseRepository.findByNumberHouse).toHaveBeenCalledWith(10);
      expect(houseRepository.update).toHaveBeenCalledWith(1, {
        user_id: SYSTEM_USER_ID,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute('nonexistent-user', 10)).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute('nonexistent-user', 10)).rejects.toThrow(
        'Usuario con ID nonexistent-user no encontrado',
      );
    });

    it('should throw NotFoundException if house not found', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(null);

      await expect(useCase.execute('user-123', 999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute('user-123', 999)).rejects.toThrow(
        'Casa con número 999 no encontrada',
      );
    });

    it('should throw BadRequestException if house does not belong to user', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(
        mockHouseWithDifferentUser as any,
      );

      await expect(useCase.execute('user-123', 20)).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute('user-123', 20)).rejects.toThrow(
        'La casa 20 no está asignada al usuario user-123',
      );
    });

    it('should not call house update if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      try {
        await useCase.execute('nonexistent-user', 10);
      } catch (error) {
        // Expected error
      }

      expect(houseRepository.update).not.toHaveBeenCalled();
    });

    it('should not call house update if house not found', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(null);

      try {
        await useCase.execute('user-123', 999);
      } catch (error) {
        // Expected error
      }

      expect(houseRepository.update).not.toHaveBeenCalled();
    });

    it('should not call house update if house does not belong to user', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(
        mockHouseWithDifferentUser as any,
      );

      try {
        await useCase.execute('user-123', 20);
      } catch (error) {
        // Expected error
      }

      expect(houseRepository.update).not.toHaveBeenCalled();
    });

    it('should reassign house to system user', async () => {
      const reassignedHouse = { ...mockHouse, user_id: SYSTEM_USER_ID };
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      houseRepository.update.mockResolvedValue(reassignedHouse as any);

      await useCase.execute('user-123', 10);

      expect(houseRepository.update).toHaveBeenCalledWith(1, {
        user_id: SYSTEM_USER_ID,
      });
    });

    it('should remove multiple houses from user sequentially', async () => {
      const houseNumbers = [10, 11, 12];
      const reassignedHouse = { user_id: SYSTEM_USER_ID };

      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      houseRepository.update.mockResolvedValue(reassignedHouse as any);

      for (const houseNumber of houseNumbers) {
        await useCase.execute('user-123', houseNumber);
      }

      expect(houseRepository.findByNumberHouse).toHaveBeenCalledTimes(3);
      expect(houseRepository.update).toHaveBeenCalledTimes(3);
    });

    it('should validate house ownership before removal', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(
        mockHouseWithDifferentUser as any,
      );

      try {
        await useCase.execute('user-123', 20);
      } catch (error) {
        // Expected error
      }

      // Update should not have been called because ownership validation failed
      expect(houseRepository.update).not.toHaveBeenCalled();
    });

    it('should handle removal with different house numbers', async () => {
      const houseNumbers = [1, 10, 25, 50, 66];

      for (const houseNumber of houseNumbers) {
        const house = { id: houseNumber, number_house: houseNumber, user_id: 'user-123' };
        const reassignedHouse = { ...house, user_id: SYSTEM_USER_ID };

        userRepository.findById.mockResolvedValue(mockUser as any);
        houseRepository.findByNumberHouse.mockResolvedValue(house as any);
        houseRepository.update.mockResolvedValue(reassignedHouse as any);

        await useCase.execute('user-123', houseNumber);

        expect(houseRepository.update).toHaveBeenCalledWith(houseNumber, {
          user_id: SYSTEM_USER_ID,
        });
      }
    });

    it('should not modify other user properties when removing house', async () => {
      const reassignedHouse = { ...mockHouse, user_id: SYSTEM_USER_ID };
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      houseRepository.update.mockResolvedValue(reassignedHouse as any);

      await useCase.execute('user-123', 10);

      // Verify that only user_id was updated, not other properties
      expect(houseRepository.update).toHaveBeenCalledWith(1, {
        user_id: SYSTEM_USER_ID,
      });
    });
  });
});
