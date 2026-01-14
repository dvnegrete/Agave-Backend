import { Injectable } from '@nestjs/common';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { UserResponseDto } from '../dto';

@Injectable()
export class GetUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll();

    return users.map((user) => ({
      id: user.id,
      role: user.role,
      status: user.status,
      name: user.name,
      email: user.email,
      cel_phone: user.cel_phone,
      houses: (user.houses || []).map((house) => house.number_house),
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));
  }
}
