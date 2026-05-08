import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { HouseUserRepository } from '@/shared/database/repositories/house-user.repository';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { AssignHouseToUserDto } from '../dto';
import { House } from '@/shared/database/entities/house.entity';
import { Role } from '@/shared/database/entities/enums';
import { SYSTEM_USER_ID } from '@/shared/config/business-rules.config';

const MAX_OWNERS_PER_HOUSE = 2;

@Injectable()
export class AssignHouseUseCase {
  constructor(
    private readonly houseRepository: HouseRepository,
    private readonly houseUserRepository: HouseUserRepository,
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

    // Check if user is already assigned to this house
    const alreadyAssigned = await this.houseUserRepository.isUserInHouse(
      house.id,
      userId,
    );
    if (alreadyAssigned) {
      throw new BadRequestException(
        `El usuario ya está asignado a la casa ${dto.house_number}`,
      );
    }

    // Enforce max-owners rule only for owner role
    if (user.role === Role.OWNER) {
      const assignments = await this.houseUserRepository.findByHouseId(
        house.id,
        true,
      );
      const ownerCount = assignments.filter(
        (hu) => hu.user.role === Role.OWNER,
      ).length;

      if (ownerCount >= MAX_OWNERS_PER_HOUSE) {
        throw new ConflictException(
          `La casa ${dto.house_number} ya tiene ${MAX_OWNERS_PER_HOUSE} propietarios asignados. ` +
            `Desasigna a uno de ellos antes de asignar a este usuario.`,
        );
      }
    }

    // Add to house_users junction table
    await this.houseUserRepository.addUserToHouse(house.id, userId);

    // If house has no real primary user, promote this user as primary
    if (house.user_id === SYSTEM_USER_ID) {
      return this.houseRepository.update(house.id, { user_id: userId });
    }

    return house;
  }
}
