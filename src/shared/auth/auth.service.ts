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
import { User } from '@supabase/supabase-js';
import { User as DbUser } from '../database/entities/user.entity';
import { Status, Role } from '../database/entities/enums';
import { JwtAuthService } from './services/jwt-auth.service';
import {
  mapSupabaseErrorToSpanish,
  SignUpMessages,
  SignInMessages,
  OAuthMessages,
  SessionMessages,
  GenericErrorMessages,
} from '@/shared/content/messages';

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
      throw new BadRequestException(
        GenericErrorMessages.AUTH_SERVICE_UNAVAILABLE,
      );
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
        // Map Supabase errors to Spanish messages
        const errorMessage = mapSupabaseErrorToSpanish(error.message);
        throw new BadRequestException(errorMessage);
      }

      // User creation succeeded - data.user will exist
      if (!data.user) {
        throw new BadRequestException(SignUpMessages.ACCOUNT_CREATION_FAILED);
      }

      // If session is not available (e.g., email confirmation required),
      // still return success with user data. User will need to confirm email first.
      if (!data.session) {
        this.logger.log(
          `User created but session not available (email confirmation may be required): ${data.user.email}`,
        );
        return {
          refreshToken: '', // Empty until user confirms email
          user: {
            id: data.user.id,
            email: data.user.email!,
            firstName: data.user.user_metadata?.first_name,
            lastName: data.user.user_metadata?.last_name,
          },
          requiresEmailConfirmation: true,
        };
      }

      return {
        refreshToken: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email!,
          firstName: data.user.user_metadata?.first_name,
          lastName: data.user.user_metadata?.last_name,
        },
        requiresEmailConfirmation: false,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
      throw new BadRequestException(errorMessage);
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
        throw new UnauthorizedException(SignInMessages.INVALID_CREDENTIALS);
      }

      if (!data.user || !data.session) {
        throw new UnauthorizedException(SignInMessages.AUTH_FAILED);
      }

      // Get user from PostgreSQL database with houses
      const dbUser = await this.userRepository.findOne({
        where: { email: data.user.email! },
        relations: { houses: true },
      });

      if (!dbUser) {
        throw new BadRequestException(SignInMessages.USER_NOT_FOUND);
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

      // Extract house numbers from houses relationship
      const houseNumbers = dbUser.houses?.map((house) => house.number_house) || [];

      return {
        refreshToken: refreshToken,
        user: {
          id: dbUser.id,
          email: dbUser.email!,
          firstName: dbUser.name?.split(' ')[0],
          lastName: dbUser.name?.split(' ')[1],
          role: dbUser.role,
          status: dbUser.status,
          houses: houseNumbers,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
      throw new BadRequestException(errorMessage);
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
        const errorMessage = mapSupabaseErrorToSpanish(error.message);
        throw new BadRequestException(errorMessage);
      }

      return { url: data.url };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : OAuthMessages.SIGNIN_FAILED;
      throw new BadRequestException(errorMessage);
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
        throw new UnauthorizedException(SessionMessages.TOKEN_EXPIRED);
      }

      if (!data.user || !data.session) {
        throw new UnauthorizedException(SessionMessages.REFRESH_FAILED);
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
      const errorMessage =
        error instanceof Error ? error.message : SessionMessages.REFRESH_TOKEN_FAILED;
      throw new BadRequestException(errorMessage);
    }
  }

  async signOut(): Promise<void> {
    this.ensureEnabled();
    try {
      const { error } = await this.supabaseClient.auth.signOut();
      if (error) {
        const errorMessage = mapSupabaseErrorToSpanish(error.message);
        throw new BadRequestException(errorMessage);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : SessionMessages.SIGNOUT_FAILED;
      throw new BadRequestException(errorMessage);
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
        throw new UnauthorizedException(SessionMessages.INVALID_TOKEN);
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : SessionMessages.CURRENT_USER_FETCH_FAILED;
      throw new BadRequestException(errorMessage);
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
        throw new UnauthorizedException(OAuthMessages.INVALID_TOKEN);
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
      const errorMessage =
        error instanceof Error ? error.message : OAuthMessages.CALLBACK_FAILED;
      throw new BadRequestException(errorMessage);
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
        throw new UnauthorizedException(SessionMessages.INVALID_TOKEN);
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
      const errorMessage =
        error instanceof Error ? error.message : SessionMessages.REFRESH_TOKEN_FAILED;
      throw new BadRequestException(errorMessage);
    }
  }
}
