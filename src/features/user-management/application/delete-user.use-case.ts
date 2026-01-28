import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { FirebaseAuthConfig } from '@/shared/auth/services/firebase-auth.config';
import { SYSTEM_USER_ID } from '@/shared/config/business-rules.config';

@Injectable()
export class DeleteUserUseCase {
  private readonly logger = new Logger(DeleteUserUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly houseRepository: HouseRepository,
    private readonly firebaseConfig: FirebaseAuthConfig,
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

    // 5. Eliminar del registro de Firebase
    try {
      await this.firebaseConfig.getAuth().deleteUser(userId);
      this.logger.log(`Usuario eliminado de Firebase: ${userId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(
        `No se pudo eliminar usuario de Firebase ${userId}: ${errorMessage}. Continuando con eliminación de BD.`,
      );
      // No lanzar excepción, solo advertir - permitir que continúe
    }

    // 6. Eliminar de la base de datos PostgreSQL
    try {
      await this.userRepository.delete(userId);
      this.logger.log(`Usuario eliminado de la base de datos: ${userId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error eliminando usuario de BD ${userId}: ${errorMessage}`);
      throw new BadRequestException(
        `No se pudo eliminar el usuario. Detalles: ${errorMessage}`,
      );
    }
  }
}
