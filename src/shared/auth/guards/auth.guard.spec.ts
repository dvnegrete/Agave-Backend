import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthGuard } from './auth.guard';
import { JwtAuthService } from '../services/jwt-auth.service';
import { User } from '../../database/entities/user.entity';
import { Status } from '../../database/entities/enums';
import { Repository } from 'typeorm';
import { Request } from 'express';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtAuthService: jest.Mocked<JwtAuthService>;
  let userRepository: jest.Mocked<Repository<User>>;

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
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    jwtAuthService = module.get(JwtAuthService);
    userRepository = module.get(getRepositoryToken(User));
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

    it('should allow access with valid access token in cookie', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'TENANT',
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        status: Status.ACTIVE,
      };

      const request = {
        cookies: {
          access_token: 'valid-token',
        },
      };

      jwtAuthService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      userRepository.findOne.mockResolvedValue(mockDbUser as any);

      const context = createMockExecutionContext(request);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtAuthService.verifyAccessToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw UnauthorizedException when access token is missing', async () => {
      const request = {
        cookies: {},
      };

      const context = createMockExecutionContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when access token is invalid', async () => {
      const request = {
        cookies: {
          access_token: 'invalid-token',
        },
      };

      jwtAuthService.verifyAccessToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      const context = createMockExecutionContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const request = {
        cookies: {
          access_token: 'expired-token',
        },
      };

      jwtAuthService.verifyAccessToken.mockRejectedValue(
        new Error('Token expired'),
      );

      const context = createMockExecutionContext(request);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should attach decoded token to request.user', async () => {
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'TENANT',
      };

      const mockDbUser = {
        id: 'user-123',
        email: 'test@example.com',
        status: Status.ACTIVE,
      };

      const request = {
        cookies: {
          access_token: 'valid-token',
        },
      } as any;

      jwtAuthService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      userRepository.findOne.mockResolvedValue(mockDbUser as any);

      const context = createMockExecutionContext(request);
      await guard.canActivate(context);

      expect(request.user).toHaveProperty('id', 'user-123');
      expect(request.user).toHaveProperty('email', 'test@example.com');
    });
  });
});
