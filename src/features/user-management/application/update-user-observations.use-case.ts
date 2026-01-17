import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { UpdateUserObservationsDto } from '../dto';
import { User } from '@/shared/database/entities/user.entity';

@Injectable()
export class UpdateUserObservationsUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string, dto: UpdateUserObservationsDto): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // Handle observations: null to clear, undefined to skip, or string value
    const updateData: any = {};
    if (dto.observations !== undefined) {
      updateData.observations = dto.observations;
    }

    const updated = await this.userRepository.update(userId, updateData);

    return updated;
  }
}
