import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { HouseUserRepository } from '@/shared/database/repositories/house-user.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { Role } from '@/shared/database/entities/enums';
import { SYSTEM_USER_ID } from '@/shared/config/business-rules.config';

@Injectable()
export class RemoveHouseUseCase {
  constructor(
    private readonly houseRepository: HouseRepository,
    private readonly houseUserRepository: HouseUserRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string, houseNumber: number): Promise<void> {
    // Validate user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Find house by number
    const house = await this.houseRepository.findByNumberHouse(houseNumber);
    if (!house) {
      throw new NotFoundException(
        `Casa con número ${houseNumber} no encontrada`,
      );
    }

    // Validate the user is actually assigned to this house
    const isAssigned = await this.houseUserRepository.isUserInHouse(
      house.id,
      userId,
    );
    if (!isAssigned) {
      throw new BadRequestException(
        `La casa ${houseNumber} no está asignada al usuario ${userId}`,
      );
    }

    // Remove from house_users junction table
    await this.houseUserRepository.removeUserFromHouse(house.id, userId);

    // If the removed user was the primary (houses.user_id), promote the next user
    if (house.user_id === userId) {
      const remaining = await this.houseUserRepository.findByHouseId(
        house.id,
        true,
      );

      // Prefer promoting an owner; fall back to any remaining user
      const nextOwner = remaining.find((hu) => hu.user.role === Role.OWNER);
      const nextUser = nextOwner ?? remaining[0];

      await this.houseRepository.update(house.id, {
        user_id: nextUser ? nextUser.user_id : SYSTEM_USER_ID,
      });
    }
  }
}
