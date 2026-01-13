import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { House } from '../../database/entities/house.entity';
import { Role } from '../../database/entities/enums';

@Injectable()
export class HouseOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(House) private houseRepository: Repository<House>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const houseId = request.params.houseId;

    if (!houseId) {
      throw new ForbiddenException('House ID not provided');
    }

    // Lookup house by number_house and check ownership
    const house = await this.houseRepository.findOne({
      where: { number_house: parseInt(houseId, 10) },
      relations: ['user'],
    });

    if (!house) {
      throw new ForbiddenException('House not found');
    }

    // Check if user owns this house
    if (house.user_id !== user.id) {
      throw new ForbiddenException('You do not have access to this house');
    }

    return true;
  }
}
