import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { UpdateUserStatusDto } from '../dto';
import { User } from '@/shared/database/entities/user.entity';

@Injectable()
export class UpdateUserStatusUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string, dto: UpdateUserStatusDto): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const updated = await this.userRepository.update(userId, {
      status: dto.status,
    });

    return updated;
  }
}
