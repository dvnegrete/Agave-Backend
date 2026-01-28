import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthService } from '../services/jwt-auth.service';
import { User } from '../../database/entities/user.entity';
import { Status } from '../../database/entities/enums';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtAuthService: JwtAuthService,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Intentar obtener token de cookie o Authorization header
    let token = this.extractTokenFromCookie(request);
    if (!token) {
      token = this.extractTokenFromAuthorizationHeader(request);
    }

    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      // Verify and decode JWT token
      const payload = await this.jwtAuthService.verifyAccessToken(token);

      // Verify user still exists in database
      const dbUser = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!dbUser) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // Check if user is active
      if (dbUser.status !== Status.ACTIVE) {
        throw new UnauthorizedException('Usuario inactivo');
      }

      // Attach user data to request from JWT payload
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        houseIds: payload.houseIds, // Include houseIds from JWT
        firstName: payload.firstName,
        lastName: payload.lastName,
        avatar: payload.avatar,
        status: dbUser.status,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token inválido');
    }
  }

  private extractTokenFromCookie(request: any): string | undefined {
    return request.cookies?.access_token;
  }

  /**
   * Extrae el token del header Authorization: Bearer TOKEN
   * Usado cuando cookies no están disponibles (dominios diferentes)
   */
  private extractTokenFromAuthorizationHeader(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      return undefined;
    }

    // Formato: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return undefined;
    }

    return parts[1];
  }
}
