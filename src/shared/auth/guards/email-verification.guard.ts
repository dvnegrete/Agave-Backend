import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';

/**
 * Guard que verifica si el email del usuario está verificado
 * Usar en endpoints sensibles que requieren email verificado
 *
 * @example
 * @UseGuards(AuthGuard, EmailVerificationGuard)
 * @Post('claim-house')
 * claimHouse() { ... }
 */
@Injectable()
export class EmailVerificationGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user || !user.id) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Obtener usuario actual de la BD
    const dbUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new ForbiddenException('Usuario no encontrado');
    }

    if (!dbUser.email_verified) {
      throw new ForbiddenException(
        'Por favor, verifica tu correo electrónico antes de acceder a esta función.',
      );
    }

    return true;
  }
}
