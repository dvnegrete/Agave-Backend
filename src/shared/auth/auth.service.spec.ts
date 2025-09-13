import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Mock de Supabase createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockClient: any;
  let mockAdminClient: any;
  const { createClient } = jest.requireMock('@supabase/supabase-js');

  beforeEach(async () => {
    mockClient = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signInWithOAuth: jest.fn(),
        refreshSession: jest.fn(),
        signOut: jest.fn(),
        getUser: jest.fn(),
        exchangeCodeForSession: jest.fn(),
      },
    };

    mockAdminClient = {
      auth: {
        admin: { getUserById: jest.fn() },
      },
    };

    (createClient as jest.Mock)
      .mockReset()
      .mockReturnValueOnce(mockClient)
      .mockReturnValueOnce(mockAdminClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              switch (key) {
                case 'SUPABASE_URL':
                  return 'https://example.supabase.co';
                case 'SUPABASE_ANON_KEY':
                  return 'anon-key';
                case 'SUPABASE_SERVICE_ROLE_KEY':
                  return 'service-role-key';
                case 'FRONTEND_URL':
                  return 'https://frontend.example.com';
                default:
                  return undefined;
              }
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };

      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      (mockClient.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await service.signUp({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });
    });

    it('should throw BadRequestException when signup fails', async () => {
      (mockClient.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already exists' },
      });

      await expect(
        service.signUp({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };

      const mockSession = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      };

      (mockClient.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await service.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      (mockClient.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      await expect(
        service.signIn({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signInWithOAuth', () => {
    it('should return OAuth URL successfully', async () => {
      (mockClient.auth.signInWithOAuth as jest.Mock).mockResolvedValue({
        data: { url: 'https://oauth-provider.com/auth' },
        error: null,
      });

      const result = await service.signInWithOAuth({
        provider: 'google',
      });

      expect(result).toEqual({
        url: 'https://oauth-provider.com/auth',
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };

      const mockSession = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      };

      (mockClient.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await service.refreshToken({
        refreshToken: 'old-refresh-token',
      });

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      });
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      (mockClient.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid refresh token' },
      });

      await expect(
        service.refreshToken({
          refreshToken: 'invalid-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      (mockClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await service.getCurrentUser('valid-token');

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      (mockClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await expect(service.getCurrentUser('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
