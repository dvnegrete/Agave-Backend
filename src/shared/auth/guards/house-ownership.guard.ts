import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../../database/entities/enums';

@Injectable()
export class HouseOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If user is not authenticated, deny access
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Admin users can access any house
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Extract houseId from route parameters
    // The parameter is named 'houseId' but represents 'number_house'
    const houseId = parseInt(request.params.houseId, 10);

    if (!houseId) {
      throw new ForbiddenException('House ID not provided');
    }

    // Check if user's houseIds (from JWT) includes this house
    if (!user.houseIds || !user.houseIds.includes(houseId)) {
      throw new ForbiddenException('You do not have access to this house');
    }

    return true;
  }
}
