import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { AssignHouseToUserDto } from '../dto';
import { House } from '@/shared/database/entities/house.entity';

@Injectable()
export class AssignHouseUseCase {
  constructor(
    private readonly houseRepository: HouseRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(userId: string, dto: AssignHouseToUserDto): Promise<House> {
    // Validate user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Validate house exists
    const house = await this.houseRepository.findByNumberHouse(dto.house_number);
    if (!house) {
      throw new NotFoundException(
        `Casa con número ${dto.house_number} no encontrada`,
      );
    }

    // Assign house to user (will reassign if already assigned to another user)
    const updated = await this.houseRepository.update(house.id, {
      user_id: userId,
    });

    return updated;
  }
}
