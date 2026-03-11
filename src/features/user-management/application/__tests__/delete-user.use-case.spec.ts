import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeleteUserUseCase } from '../delete-user.use-case';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { FirebaseAuthConfig } from '@/shared/auth/services/firebase-auth.config';
import { SYSTEM_USER_ID } from '@/shared/config/business-rules.config';

describe('DeleteUserUseCase', () => {
  let useCase: DeleteUserUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let houseRepository: jest.Mocked<HouseRepository>;
  let firebaseConfig: jest.Mocked<FirebaseAuthConfig>;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUserUseCase,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: HouseRepository,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: FirebaseAuthConfig,
          useValue: {
            getAuth: jest.fn().mockReturnValue({
              deleteUser: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    useCase = module.get<DeleteUserUseCase>(DeleteUserUseCase);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
    houseRepository = module.get(HouseRepository) as jest.Mocked<HouseRepository>;
    firebaseConfig = module.get(FirebaseAuthConfig) as jest.Mocked<FirebaseAuthConfig>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should delete user successfully when all conditions are met', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByUserId.mockResolvedValue([]);
      const mockAuth = { deleteUser: jest.fn().mockResolvedValue(undefined) };
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.delete.mockResolvedValue(undefined);

      await expect(useCase.execute('user-123')).resolves.toBeUndefined();

      expect(userRepository.findById).toHaveBeenCalledWith('user-123');
      expect(houseRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('user-123');
      expect(userRepository.delete).toHaveBeenCalledWith('user-123');
    });

    it('should throw BadRequestException if trying to delete system user', async () => {
      await expect(useCase.execute(SYSTEM_USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute(SYSTEM_USER_ID)).rejects.toThrow(
        'No se puede eliminar el usuario del sistema',
      );
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute('nonexistent-user')).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute('nonexistent-user')).rejects.toThrow(
        'Usuario con ID nonexistent-user no encontrado',
      );
    });

    it('should throw BadRequestException if user has assigned houses', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByUserId.mockResolvedValue([mockHouse as any]);

      await expect(useCase.execute('user-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute('user-123')).rejects.toThrow(
        'No se puede eliminar el usuario porque tiene 1 casa(s) asignada(s)',
      );
      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user has multiple houses assigned', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      const houses = [
        { id: 1, number_house: 10, user_id: 'user-123' },
        { id: 2, number_house: 20, user_id: 'user-123' },
        { id: 3, number_house: 30, user_id: 'user-123' },
      ];
      houseRepository.findByUserId.mockResolvedValue(houses as any);

      await expect(useCase.execute('user-123')).rejects.toThrow(
        'No se puede eliminar el usuario porque tiene 3 casa(s) asignada(s)',
      );
    });

    it('should continue with DB deletion if Firebase deletion fails', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByUserId.mockResolvedValue([]);
      const mockAuth = {
        deleteUser: jest.fn().mockRejectedValue(new Error('Firebase error')),
      };
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.delete.mockResolvedValue(undefined);

      await expect(useCase.execute('user-123')).resolves.toBeUndefined();

      expect(userRepository.delete).toHaveBeenCalledWith('user-123');
    });

    it('should throw BadRequestException if DB deletion fails', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByUserId.mockResolvedValue([]);
      const mockAuth = { deleteUser: jest.fn().mockResolvedValue(undefined) };
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      const dbError = new Error('Database constraint violation');
      userRepository.delete.mockRejectedValue(dbError);

      await expect(useCase.execute('user-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute('user-123')).rejects.toThrow(
        'No se pudo eliminar el usuario',
      );
    });

    it('should validate user existence before checking houses', async () => {
      userRepository.findById.mockResolvedValue(null);

      try {
        await useCase.execute('user-123');
      } catch (error) {
        // Expected error
      }

      expect(houseRepository.findByUserId).not.toHaveBeenCalled();
    });

    it('should validate no houses before Firebase deletion', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      houseRepository.findByUserId.mockResolvedValue([mockHouse as any]);
      const mockAuth = { deleteUser: jest.fn() };
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);

      try {
        await useCase.execute('user-123');
      } catch (error) {
        // Expected error
      }

      expect(mockAuth.deleteUser).not.toHaveBeenCalled();
    });
  });
});
