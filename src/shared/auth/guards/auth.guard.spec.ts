import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { JwtAuthService } from '../services/jwt-auth.service';
import { Request } from 'express';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtAuthService: jest.Mocked<JwtAuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JwtAuthService,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtAuthService = module.get(JwtAuthService) as jest.Mocked<JwtAuthService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    const createMockExecutionContext = (request: Partial<Request>) => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(request),
        }),
      } as unknown as ExecutionContext;

      return mockContext;
    };

    it('should allow access with valid access token in cookie', () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      const request = {
        cookies: {
          access_token: 'valid-token',
        },
      };

      jwtAuthService.verifyAccessToken.mockReturnValue(mockPayload as any);

      const context = createMockExecutionContext(request);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtAuthService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect((request as any).user).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException when access token is missing', () => {
      const request = {
        cookies: {},
      };

      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when access token is invalid', () => {
      const request = {
        cookies: {
          access_token: 'invalid-token',
        },
      };

      jwtAuthService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is expired', () => {
      const request = {
        cookies: {
          access_token: 'expired-token',
        },
      };

      jwtAuthService.verifyAccessToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const context = createMockExecutionContext(request);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should attach decoded token to request.user', () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'TENANT',
      };

      const request = {
        cookies: {
          access_token: 'valid-token',
        },
      } as any;

      jwtAuthService.verifyAccessToken.mockReturnValue(mockPayload as any);

      const context = createMockExecutionContext(request);
      guard.canActivate(context);

      expect(request.user).toEqual(mockPayload);
    });
  });
});
