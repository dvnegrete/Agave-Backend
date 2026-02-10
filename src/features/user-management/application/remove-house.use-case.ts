import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { SYSTEM_USER_ID } from '@/shared/config/business-rules.config';

@Injectable()
export class RemoveHouseUseCase {
  constructor(
    private readonly houseRepository: HouseRepository,
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

    // Validate that the house belongs to the user
    if (house.user_id !== userId) {
      throw new BadRequestException(
        `La casa ${houseNumber} no está asignada al usuario ${userId}`,
      );
    }

    // Reassign house to system user to maintain referential integrity
    // This makes the house available for manual assignment or automatic reconciliation
    await this.houseRepository.update(house.id, {
      user_id: SYSTEM_USER_ID,
    });
  }
}
