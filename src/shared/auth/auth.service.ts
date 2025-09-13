import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import {
  SignUpDto,
  SignInDto,
  OAuthSignInDto,
  RefreshTokenDto,
  AuthResponseDto,
} from './dto/auth.dto';
import { AuthError, User } from '@supabase/supabase-js';

@Injectable()
export class AuthService {
  private supabaseClient;
  private supabaseAdminClient;

  constructor(private configService: ConfigService) {
    // Inicializar clientes de Supabase usando ConfigService
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuración de Supabase incompleta');
    }

    this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    if (supabaseServiceRoleKey) {
      this.supabaseAdminClient = createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
      );
    }
  }

  async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
    try {
      const { data, error } = await this.supabaseClient.auth.signUp({
        email: signUpDto.email,
        password: signUpDto.password,
        options: {
          data: {
            first_name: signUpDto.firstName,
            last_name: signUpDto.lastName,
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

  async signIn(signInDto: SignInDto): Promise<AuthResponseDto> {
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

  async signInWithOAuth(oAuthDto: OAuthSignInDto): Promise<{ url: string }> {
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

  async handleOAuthCallback(code: string): Promise<AuthResponseDto> {
    try {
      const { data, error } =
        await this.supabaseClient.auth.exchangeCodeForSession(code);

      if (error) {
        throw new BadRequestException(error.message);
      }

      if (!data.user || !data.session) {
        throw new BadRequestException('Error en el callback de OAuth');
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
}
