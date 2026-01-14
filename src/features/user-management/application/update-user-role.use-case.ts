import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { UpdateUserRoleDto } from '../dto';
import { User } from '@/shared/database/entities/user.entity';

@Injectable()
export class UpdateUserRoleUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string, dto: UpdateUserRoleDto): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const updated = await this.userRepository.update(userId, {
      role: dto.role,
    });

    return updated;
  }
}
