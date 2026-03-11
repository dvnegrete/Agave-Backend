import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleGuard } from './roles.guard';
import { Role } from '../../database/entities/enums';
import { Request } from 'express';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RoleGuard>(RoleGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    userRole: Role,
    requiredRoles?: Role[],
  ) => {
    const request = {
      user: {
        sub: 'user-123',
        email: 'test@example.com',
        role: userRole,
      },
    };

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getHandler: jest.fn().mockReturnValue(() => {}),
    } as unknown as ExecutionContext;

    reflector.get.mockReturnValue(requiredRoles);

    return { mockContext, request };
  };

  describe('canActivate', () => {
    it('should allow access when no specific roles are required', () => {
      const { mockContext } = createMockExecutionContext(
        Role.TENANT,
        undefined,
      );

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access when user has required role', () => {
      const { mockContext } = createMockExecutionContext(Role.ADMIN, [
        Role.ADMIN,
      ]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access when user has one of required roles', () => {
      const { mockContext } = createMockExecutionContext(Role.ADMIN, [
        Role.TENANT,
        Role.ADMIN,
      ]);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required role', () => {
      const { mockContext } = createMockExecutionContext(Role.TENANT, [
        Role.ADMIN,
      ]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user does not have any required role', () => {
      const { mockContext } = createMockExecutionContext(Role.TENANT, [
        Role.ADMIN,
      ]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should handle missing user in request', () => {
      const request = {};

      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(request),
        }),
        getHandler: jest.fn().mockReturnValue(() => {}),
      } as unknown as ExecutionContext;

      reflector.get.mockReturnValue([Role.ADMIN]);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
