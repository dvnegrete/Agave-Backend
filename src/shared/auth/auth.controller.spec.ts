import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Mock de Supabase
jest.mock('../config/supabase.config', () => ({
  supabaseClient: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      refreshSession: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
  },
  supabaseAdminClient: {
    auth: {
      admin: {
        getUserById: jest.fn(),
      },
    },
  },
}));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signUp: jest.fn(),
    signIn: jest.fn(),
    signInWithOAuth: jest.fn(),
    handleOAuthCallback: jest.fn(),
    refreshToken: jest.fn(),
    signOut: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signUp', () => {
    it('should create a new user', async () => {
      const signUpDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const expectedResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockAuthService.signUp.mockResolvedValue(expectedResult);

      const result = await controller.signUp(signUpDto);

      expect(authService.signUp).toHaveBeenCalledWith(signUpDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('signIn', () => {
    it('should sign in user', async () => {
      const signInDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const expectedResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockAuthService.signIn.mockResolvedValue(expectedResult);

      const result = await controller.signIn(signInDto);

      expect(authService.signIn).toHaveBeenCalledWith(signInDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('signInWithOAuth', () => {
    it('should return OAuth URL', async () => {
      const oAuthDto = {
        provider: 'google' as const,
      };

      const expectedResult = {
        url: 'https://oauth-provider.com/auth',
      };

      mockAuthService.signInWithOAuth.mockResolvedValue(expectedResult);

      const result = await controller.signInWithOAuth(oAuthDto);

      expect(authService.signInWithOAuth).toHaveBeenCalledWith(oAuthDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('handleOAuthCallback', () => {
    it('should handle OAuth callback', async () => {
      const code = 'oauth-code';
      const expectedResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockAuthService.handleOAuthCallback.mockResolvedValue(expectedResult);

      const result = await controller.handleOAuthCallback(code);

      expect(authService.handleOAuthCallback).toHaveBeenCalledWith(code);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token', async () => {
      const refreshTokenDto = {
        refreshToken: 'refresh-token',
      };

      const expectedResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      mockAuthService.refreshToken.mockResolvedValue(expectedResult);

      const result = await controller.refreshToken(refreshTokenDto);

      expect(authService.refreshToken).toHaveBeenCalledWith(refreshTokenDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('signOut', () => {
    it('should sign out user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        phone: undefined,
        confirmed_at: '2023-01-01T00:00:00Z',
        email_change_confirm_status: 0,
        banned_until: undefined,
        reauthentication_sent_at: undefined,
        recovery_sent_at: undefined,
        email_change_sent_at: undefined,
        phone_change: undefined,
        phone_change_sent_at: undefined,
        email_change: undefined,
        reauthentication_confirm_status: 0,
        factors: undefined,
        identities: [],
        created_at_utc: '2023-01-01T00:00:00Z',
        updated_at_utc: '2023-01-01T00:00:00Z',
        banned_until_utc: undefined,
        reauthentication_sent_at_utc: undefined,
        recovery_sent_at_utc: undefined,
        email_change_sent_at_utc: undefined,
        phone_change_sent_at_utc: undefined,
        last_sign_in_at_utc: '2023-01-01T00:00:00Z',
        email_confirmed_at_utc: '2023-01-01T00:00:00Z',
        confirmed_at_utc: '2023-01-01T00:00:00Z',
        phone_change_confirm_status: 0,
        email_change_confirm_status_utc: 0,
        reauthentication_confirm_status_utc: 0,
        phone_change_confirm_status_utc: 0,
      };

      mockAuthService.signOut.mockResolvedValue(undefined);

      const result = await controller.signOut(mockUser);

      expect(result).toBeUndefined();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        phone: undefined,
        confirmed_at: '2023-01-01T00:00:00Z',
        email_change_confirm_status: 0,
        banned_until: undefined,
        reauthentication_sent_at: undefined,
        recovery_sent_at: undefined,
        email_change_sent_at: undefined,
        phone_change: undefined,
        phone_change_sent_at: undefined,
        email_change: undefined,
        reauthentication_confirm_status: 0,
        factors: undefined,
        identities: [],
        created_at_utc: '2023-01-01T00:00:00Z',
        updated_at_utc: '2023-01-01T00:00:00Z',
        banned_until_utc: undefined,
        reauthentication_sent_at_utc: undefined,
        recovery_sent_at_utc: undefined,
        email_change_sent_at_utc: undefined,
        phone_change_sent_at_utc: undefined,
        last_sign_in_at_utc: '2023-01-01T00:00:00Z',
        email_confirmed_at_utc: '2023-01-01T00:00:00Z',
        confirmed_at_utc: '2023-01-01T00:00:00Z',
        phone_change_confirm_status: 0,
        email_change_confirm_status_utc: 0,
        reauthentication_confirm_status_utc: 0,
        phone_change_confirm_status_utc: 0,
      };

      const result = await controller.getCurrentUser(mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers', () => {
      const result = controller.getAvailableProviders();

      expect(result).toEqual({
        providers: ['google', 'facebook', 'github', 'twitter', 'discord'],
      });
    });
  });
}); 