import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';

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
      throw new NotFoundException(`Casa con número ${houseNumber} no encontrada`);
    }

    // Validate that the house belongs to the user
    if (house.user_id !== userId) {
      throw new BadRequestException(
        `La casa ${houseNumber} no está asignada al usuario ${userId}`,
      );
    }

    // Remove house assignment by setting user_id to null
    // Note: This assumes user_id is nullable in the database
    // If not nullable, consider alternative approaches (e.g., archive, reassign to default user)
    await this.houseRepository.update(house.id, {
      user_id: null as any, // Cast to any to bypass type checking for null
    });
  }
}
