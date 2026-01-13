import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      const supabaseUser = await this.authService.getCurrentUser(token);
      if (!supabaseUser) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // Lookup user in PostgreSQL by email to get role information
      const dbUser = await this.userRepository.findOne({
        where: { email: supabaseUser.email },
      });

      if (!dbUser) {
        throw new UnauthorizedException('Usuario no registrado en el sistema');
      }

      // Merge Supabase user data with database user data
      // Database user has role and status information
      request.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        role: dbUser.role,
        status: dbUser.status,
        user_metadata: supabaseUser.user_metadata,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token inválido');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
