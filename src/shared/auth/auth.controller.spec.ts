import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    signUp: jest.fn(),
    signIn: jest.fn(),
    handleOAuthCallback: jest.fn(),
    refreshTokens: jest.fn(),
    signOut: jest.fn(),
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
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
        idToken: 'firebase-id-token',
        firstName: 'John',
        lastName: 'Doe',
        houseNumber: 5,
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
        requiresEmailConfirmation: true,
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
        idToken: 'firebase-id-token',
      };

      const mockResponse = {
        cookie: jest.fn().mockReturnThis(),
      } as any;

      const expectedResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          emailVerified: true,
        },
      };

      mockAuthService.signIn.mockResolvedValue(expectedResult);

      const result = await controller.signIn(signInDto, mockResponse);

      expect(authService.signIn).toHaveBeenCalledWith(signInDto, mockResponse);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('handleOAuthCallback', () => {
    it('should handle OAuth callback', async () => {
      const oAuthCallbackDto = {
        idToken: 'oauth-id-token',
      };

      const mockResponse = {
        cookie: jest.fn().mockReturnThis(),
      } as any;

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

      const result = await controller.handleOAuthCallback(oAuthCallbackDto, mockResponse);

      expect(authService.handleOAuthCallback).toHaveBeenCalledWith(oAuthCallbackDto, mockResponse);
      expect(result).toEqual(expectedResult);
    });
  });


  describe('refreshToken', () => {
    it('should refresh token', async () => {
      const refreshTokenDto = {
        refreshToken: 'refresh-token',
      };

      const mockResponse = {
        cookie: jest.fn().mockReturnThis(),
      } as any;

      const expectedResult = {
        success: true,
      };

      mockAuthService.refreshTokens.mockResolvedValue(expectedResult);

      const result = await controller.refreshToken(refreshTokenDto, mockResponse);

      expect(authService.refreshTokens).toHaveBeenCalledWith('refresh-token', mockResponse);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('signOut', () => {
    it('should sign out user', async () => {
      const mockResponse = {
        clearCookie: jest.fn().mockReturnThis(),
      } as any;

      const result = await controller.signOut(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(result).toBeUndefined();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'John Doe',
        email_verified: true,
        email_verified_at: new Date('2023-01-01'),
        status: 'ACTIVE' as any,
        role: 'TENANT' as any,
        houses: [],
        last_login: new Date('2023-01-01'),
      };

      const result = await controller.getCurrentUser(mockUser as any);

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
