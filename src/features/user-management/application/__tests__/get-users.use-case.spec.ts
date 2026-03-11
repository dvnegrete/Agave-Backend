import { Test, TestingModule } from '@nestjs/testing';
import { GetUsersUseCase } from '../get-users.use-case';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { SYSTEM_USER_EMAIL } from '@/shared/config/business-rules.config';
import { User } from '@/shared/database/entities';

describe('GetUsersUseCase', () => {
  let useCase: GetUsersUseCase;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser1 = {
    id: 'user-1',
    role: 'ADMIN',
    status: 'ACTIVE',
    name: 'Admin User',
    email: 'admin@example.com',
    observations: 'Test admin',
    cel_phone: '+1234567890',
    houses: [{ number_house: 10 }, { number_house: 20 }],
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-15'),
  };

  const mockUser2 = {
    id: 'user-2',
    role: 'USER',
    status: 'ACTIVE',
    name: 'Regular User',
    email: 'user@example.com',
    observations: null,
    cel_phone: '+0987654321',
    houses: [{ number_house: 30 }],
    created_at: new Date('2025-01-05'),
    updated_at: new Date('2025-01-10'),
  };

  const mockSystemUser = {
    id: 'system-user',
    role: 'SYSTEM',
    status: 'ACTIVE',
    name: 'System User',
    email: SYSTEM_USER_EMAIL,
    observations: null,
    cel_phone: null,
    houses: [],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUsersUseCase,
        {
          provide: UserRepository,
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetUsersUseCase>(GetUsersUseCase);
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all users except system user', async () => {
      userRepository.findAll.mockResolvedValue([
        mockUser1 as any,
        mockUser2 as any,
        mockSystemUser as any,
      ]);

      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      expect(result.every((u) => u.email !== SYSTEM_USER_EMAIL)).toBe(true);
      expect(userRepository.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no users exist', async () => {
      userRepository.findAll.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result).toEqual([]);
    });

    it('should map user properties correctly to DTOs', async () => {
      userRepository.findAll.mockResolvedValue([mockUser1 as any]);

      const result = await useCase.execute();

      expect(result[0].id).toBe('user-1');
      expect(result[0].role).toBe('ADMIN');
      expect(result[0].status).toBe('ACTIVE');
      expect(result[0].name).toBe('Admin User');
      expect(result[0].email).toBe('admin@example.com');
      expect(result[0].observations).toBe('Test admin');
      expect(result[0].cel_phone).toBe('+1234567890');
      expect(result[0].created_at).toEqual(new Date('2025-01-01'));
      expect(result[0].updated_at).toEqual(new Date('2025-01-15'));
    });

    it('should map house numbers correctly from houses array', async () => {
      userRepository.findAll.mockResolvedValue([mockUser1 as any]);

      const result = await useCase.execute();

      expect(result[0].houses).toEqual([10, 20]);
    });

    it('should handle users with no houses', async () => {
      const userNoHouses = { ...mockUser2, houses: [] };
      userRepository.findAll.mockResolvedValue([userNoHouses as any]);

      const result = await useCase.execute();

      expect(result[0].houses).toEqual([]);
    });

    it('should handle users with null houses property', async () => {
      const userNullHouses = { ...mockUser2, houses: null };
      userRepository.findAll.mockResolvedValue([userNullHouses as any]);

      const result = await useCase.execute();

      expect(result[0].houses).toEqual([]);
    });

    it('should only filter out system user by email', async () => {
      userRepository.findAll.mockResolvedValue([
        mockUser1 as any,
        mockSystemUser as any,
        mockUser2 as any,
      ]);

      const result = await useCase.execute();

      expect(result).toHaveLength(2);
      expect(result).not.toContainEqual(expect.objectContaining({
        email: SYSTEM_USER_EMAIL,
      }));
    });
  });
});
