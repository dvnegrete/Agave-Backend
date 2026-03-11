import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../database/entities/enums';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.get<Role[]>(
      'roles',
      context.getHandler(),
    );

    // If no @Roles decorator is present, allow access
    if (!allowedRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If user is not authenticated, deny access
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // If user's role is not in allowed roles, deny access
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}, but user has role: ${user.role}`,
      );
    }

    return true;
  }
}
