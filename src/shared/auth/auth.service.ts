import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  SignUpDto,
  SignInDto,
  OAuthSignInDto,
  RefreshTokenDto,
  AuthResponseDto,
} from './dto/auth.dto';
import { AuthError, User } from '@supabase/supabase-js';
import { User as DbUser } from '../database/entities/user.entity';
import { Status, Role } from '../database/entities/enums';
import { JwtAuthService } from './services/jwt-auth.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabaseClient;
  private supabaseAdminClient;
  private isEnabled = false;

  constructor(
    private configService: ConfigService,
    @InjectRepository(DbUser)
    private userRepository: Repository<DbUser>,
    private jwtAuthService: JwtAuthService,
  ) {
    // Inicializar clientes de Supabase usando ConfigService
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseAnonKey) {
      this.logger.warn(
        'Configuración de Supabase incompleta. El servicio de autenticación no estará disponible.',
      );
      return;
    }

    try {
      this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

      if (supabaseServiceRoleKey) {
        this.supabaseAdminClient = createClient(
          supabaseUrl,
          supabaseServiceRoleKey,
        );
      }

      this.isEnabled = true;
      this.logger.log('Servicio de autenticación de Supabase inicializado correctamente');
    } catch (error) {
      this.logger.error('Error al inicializar el cliente de Supabase:', error);
    }
  }

  private ensureEnabled() {
    if (!this.isEnabled) {
      throw new BadRequestException('El servicio de autenticación no está disponible');
    }
  }

  async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
    this.ensureEnabled();
    try {
      const { data, error } = await this.supabaseClient.auth.signUp({
        email: signUpDto.email,
        password: signUpDto.password,
        options: {
          data: {
            first_name: signUpDto.firstName,
            last_name: signUpDto.lastName,
            claimed_house_number: signUpDto.houseNumber,
          },
        },
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      if (!data.user || !data.session) {
        throw new BadRequestException('Error al crear la cuenta');
      }

      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email!,
          firstName: data.user.user_metadata?.first_name,
          lastName: data.user.user_metadata?.last_name,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error interno del servidor');
    }
  }

  async signIn(signInDto: SignInDto, res: Response): Promise<AuthResponseDto> {
    this.ensureEnabled();
    try {
      const { data, error } = await this.supabaseClient.auth.signInWithPassword(
        {
          email: signInDto.email,
          password: signInDto.password,
        },
      );

      if (error) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      if (!data.user || !data.session) {
        throw new UnauthorizedException('Error en la autenticación');
      }

      // Get user from PostgreSQL database
      const dbUser = await this.userRepository.findOne({
        where: { email: data.user.email! },
      });

      if (!dbUser) {
        throw new BadRequestException('Usuario no encontrado en la base de datos');
      }

      // Generate backend JWT tokens
      const accessToken = await this.jwtAuthService.generateAccessToken(dbUser);
      const refreshToken = await this.jwtAuthService.generateRefreshToken(dbUser);

      // Set access token in httpOnly cookie
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      return {
        accessToken: refreshToken, // Return refresh token for client-side storage
        refreshToken: refreshToken,
        user: {
          id: dbUser.id,
          email: dbUser.email!,
          firstName: dbUser.name?.split(' ')[0],
          lastName: dbUser.name?.split(' ')[1],
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error interno del servidor');
    }
  }

  async signInWithOAuth(oAuthDto: OAuthSignInDto): Promise<{ url: string }> {
    this.ensureEnabled();
    try {
      const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
        provider: oAuthDto.provider as any,
        options: {
          redirectTo: `${this.configService.get('FRONTEND_URL')}/auth/callback`,
        },
      });

      if (error) {
        throw new BadRequestException(error.message);
      }

      return { url: data.url };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error interno del servidor');
    }
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    this.ensureEnabled();
    try {
      const { data, error } = await this.supabaseClient.auth.refreshSession({
        refresh_token: refreshTokenDto.refreshToken,
      });

      if (error) {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      if (!data.user || !data.session) {
        throw new UnauthorizedException('Error al refrescar la sesión');
      }

      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email!,
          firstName: data.user.user_metadata?.first_name,
          lastName: data.user.user_metadata?.last_name,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error interno del servidor');
    }
  }

  async signOut(): Promise<void> {
    this.ensureEnabled();
    try {
      const { error } = await this.supabaseClient.auth.signOut();
      if (error) {
        throw new BadRequestException(error.message);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error interno del servidor');
    }
  }

  async getCurrentUser(accessToken: string): Promise<User | null> {
    this.ensureEnabled();
    try {
      const {
        data: { user },
        error,
      } = await this.supabaseClient.auth.getUser(accessToken);

      if (error) {
        throw new UnauthorizedException('Token inválido');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error interno del servidor');
    }
  }

  async handleOAuthCallback(
    accessToken: string,
    res: Response,
  ): Promise<{ refreshToken: string }> {
    this.ensureEnabled();
    try {
      // Verify the access token with Supabase
      const {
        data: { user },
        error,
      } = await this.supabaseClient.auth.getUser(accessToken);

      if (error || !user) {
        throw new UnauthorizedException('Invalid Supabase access token');
      }

      // Get or create user in PostgreSQL database
      let dbUser = await this.userRepository.findOne({
        where: { email: user.email! },
      });

      if (!dbUser) {
        // Create new user if doesn't exist (OAuth auto-registration)
        dbUser = this.userRepository.create({
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.full_name || user.email!,
          status: Status.ACTIVE,
          role: Role.TENANT,
        });
        await this.userRepository.save(dbUser);
        this.logger.log(`New user created from OAuth: ${user.email}`);
      }

      // Generate backend JWT tokens
      const jwtAccessToken = await this.jwtAuthService.generateAccessToken(
        dbUser,
      );
      const refreshToken = await this.jwtAuthService.generateRefreshToken(dbUser);

      // Set access token in httpOnly cookie
      res.cookie('access_token', jwtAccessToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // Return refresh token for client-side storage
      return { refreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('OAuth callback error:', error);
      throw new BadRequestException('Error processing OAuth authentication');
    }
  }

  async refreshTokens(
    refreshTokenValue: string,
    res: Response,
  ): Promise<{ success: boolean }> {
    this.ensureEnabled();
    try {
      // Verify refresh token
      const payload = await this.jwtAuthService.verifyRefreshToken(
        refreshTokenValue,
      );

      // Get user from database
      const dbUser = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!dbUser) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // Generate new access token
      const newAccessToken = await this.jwtAuthService.generateAccessToken(
        dbUser,
      );

      // Set new access token in httpOnly cookie
      res.cookie('access_token', newAccessToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      return { success: true };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error al refrescar el token');
    }
  }
}
