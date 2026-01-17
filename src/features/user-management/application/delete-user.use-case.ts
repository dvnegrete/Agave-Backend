import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { SYSTEM_USER_ID } from '@/shared/config/business-rules.config';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly houseRepository: HouseRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    // 1. Validar que NO sea el usuario sistema
    if (userId === SYSTEM_USER_ID) {
      throw new BadRequestException(
        'No se puede eliminar el usuario del sistema',
      );
    }

    // 2. Validar que el usuario exista
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    // 3. Validar que no tenga casas asignadas
    const houses = await this.houseRepository.findByUserId(userId);

    if (houses.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar el usuario porque tiene ${houses.length} casa(s) asignada(s). Primero debe remover todas las casas.`,
      );
    }

    // 4. Validar que no tenga aprobaciones manuales (onDelete: RESTRICT)
    // Note: This validation would require loading the relationship separately
    // For now, we let the database constraint handle this error
    // and return a meaningful error message if it occurs

    // 5. Eliminar el usuario
    await this.userRepository.delete(userId);
  }
}
