import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import {
  SignUpDto,
  SignInDto,
  RefreshTokenDto,
  AuthResponseDto,
  OAuthCallbackDto,
} from './dto/auth.dto';
import { User as DbUser } from '../database/entities/user.entity';
import { Status, Role } from '../database/entities/enums';
import { JwtAuthService } from './services/jwt-auth.service';
import { FirebaseAuthConfig } from './services/firebase-auth.config';
import { UserRepository } from '../database/repositories/user.repository';
import {
  SignUpMessages,
  SignInMessages,
  OAuthMessages,
  SessionMessages,
  GenericErrorMessages,
} from '@/shared/content/messages';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private configService: ConfigService,
    private userRepository: UserRepository,
    private jwtAuthService: JwtAuthService,
    private firebaseConfig: FirebaseAuthConfig,
  ) {}

  private ensureEnabled() {
    if (!this.firebaseConfig.isEnabled()) {
      throw new BadRequestException(
        GenericErrorMessages.AUTH_SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Determina si las cookies deben ser seguras basándose en el protocolo del FRONTEND_URL
   *
   * IMPORTANTE: La seguridad de cookies NUNCA debe depender de NODE_ENV.
   * Depende del protocolo real del FRONTEND_URL:
   * - HTTPS → secure: true (Staging y Producción)
   * - HTTP → secure: false (Desarrollo local)
   *
   * @throws Error si FRONTEND_URL no está configurado
   */
  private getCookieSecureFlag(): boolean {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // ❌ CRÍTICO: FRONTEND_URL es obligatorio
    if (!frontendUrl || frontendUrl.trim() === '') {
      const errorMsg =
        `❌ FATAL: FRONTEND_URL environment variable is required but not configured.\n` +
        `   NODE_ENV: ${nodeEnv}\n` +
        `   Cookie security depends on FRONTEND_URL protocol (http:// vs https://)\n` +
        `\n` +
        `   Configure FRONTEND_URL in your environment:\n` +
        `   - Development: FRONTEND_URL=http://localhost:PORT\n` +
        `   - Staging/Production: FRONTEND_URL=https://your-frontend-domain.com`;

      this.logger.error(errorMsg);
      throw new Error(
        'FRONTEND_URL environment variable is required for cookie security configuration'
      );
    }

    // Determinar secure basándose SOLO en el protocolo, no en NODE_ENV
    const isSecure = frontendUrl.startsWith('https://');

    this.logger.log(
      `🔐 Cookie Security Config: secure=${isSecure} ` +
      `(FRONTEND_URL=${frontendUrl.replace(/\//g, '')})`
    );

    return isSecure;
  }

  /**
   * Obtiene el dominio para las cookies desde COOKIE_DOMAIN (configurable).
   *
   * IMPORTANTE: Este debe ser el dominio COMPARTIDO entre frontend y backend,
   * no el dominio del frontend o backend individual.
   *
   * Ejemplos:
   * - localhost development: undefined
   * - Staging (Railway): .up.railway.app (no .agave-frontend-development.up.railway.app)
   * - Production: .your-domain.com (no individual subdomain)
   *
   * Por seguridad, un servidor solo puede establecer cookies para su propio dominio
   * o dominios padres que lo contengan.
   */
  private getCookieDomain(): string | undefined {
    // Primero, intentar obtener COOKIE_DOMAIN configurado explícitamente
    const configuredDomain = this.configService.get<string>('COOKIE_DOMAIN');
    if (configuredDomain) {
      this.logger.debug(`Using configured COOKIE_DOMAIN: ${configuredDomain}`);
      return configuredDomain;
    }

    // Fallback: revisar si estamos en localhost
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      return undefined;
    }

    const domainWithPort = frontendUrl
      .replace(/^https?:\/\//, '')
      .split(':')[0];

    // En localhost, no especificar domain
    if (domainWithPort === 'localhost' || domainWithPort === '127.0.0.1') {
      return undefined;
    }

    // Para otros casos, retornar undefined
    // El servidor establecerá la cookie solo para su propio dominio
    // COOKIE_DOMAIN debe configurarse en ambiente para compartir entre subdominos
    this.logger.warn(
      `COOKIE_DOMAIN not configured. Cookies will only work for same domain. ` +
      `To share cookies between frontend (${domainWithPort}) and backend, ` +
      `configure COOKIE_DOMAIN environment variable (e.g., COOKIE_DOMAIN=.up.railway.app)`
    );
    return undefined;
  }

  async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
    this.ensureEnabled();
    try {
      const auth = this.firebaseConfig.getAuth();

      // 1. Verificar y decodificar idToken de Firebase
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(signUpDto.idToken);
      } catch (error) {
        this.logger.error('idToken inválido en signup:', error);
        throw new UnauthorizedException(SignUpMessages.ACCOUNT_CREATION_FAILED);
      }

      // 2. Obtener usuario completo de Firebase
      let firebaseUser;
      try {
        firebaseUser = await auth.getUser(decodedToken.uid);
      } catch (error) {
        this.logger.error('Error obteniendo usuario de Firebase:', error);
        throw new UnauthorizedException(SignUpMessages.ACCOUNT_CREATION_FAILED);
      }

      const email = firebaseUser.email!;

      // 3. Verificar si el usuario ya existe en PostgreSQL (con reintentos)
      const existingUser = await this.userRepository.findByEmail(email);

      if (existingUser) {
        this.logger.log(
          `Intento de signup con email ya registrado en DB: ${email}`,
        );
        throw new BadRequestException(
          SignUpMessages.EMAIL_ALREADY_REGISTERED,
        );
      }

      // 4. Actualizar displayName en Firebase si es necesario
      if (signUpDto.firstName || signUpDto.lastName) {
        const displayName = signUpDto.firstName && signUpDto.lastName
          ? `${signUpDto.firstName} ${signUpDto.lastName}`
          : undefined;

        if (displayName) {
          await auth.updateUser(firebaseUser.uid, { displayName });
        }
      }

      // 5. Guardar metadata en custom claims de Firebase
      if (signUpDto.firstName || signUpDto.lastName || signUpDto.houseNumber) {
        await auth.setCustomUserClaims(firebaseUser.uid, {
          firstName: signUpDto.firstName,
          lastName: signUpDto.lastName,
          claimedHouseNumber: signUpDto.houseNumber,
        });
      }

      // 6. Crear usuario en PostgreSQL con email_verified: false (con reintentos)
      const dbUser = await this.userRepository.create({
        id: firebaseUser.uid,
        email,
        name: signUpDto.firstName && signUpDto.lastName
          ? `${signUpDto.firstName} ${signUpDto.lastName}`.trim()
          : email,
        status: Status.ACTIVE,
        role: Role.TENANT,
        email_verified: false, // Email no verificado por defecto
        observations: signUpDto.houseNumber
          ? `Casa reclamada durante registro: ${signUpDto.houseNumber}`
          : undefined,
      });

      this.logger.log(
        `Usuario creado exitosamente: ${email} (firebase: ${firebaseUser.uid})`,
      );

      // 7. El cliente enviará el email de verificación usando Firebase Client SDK
      // (sendEmailVerification() se llama desde el frontend automáticamente)

      return {
        user: {
          id: dbUser.id,
          email: dbUser.email!,
          firstName: signUpDto.firstName,
          lastName: signUpDto.lastName,
          role: dbUser.role,
          status: dbUser.status,
          emailVerified: false,
        },
        requiresEmailConfirmation: true,
        message: 'Usuario creado. Por favor, verifica tu correo electrónico para activar tu cuenta.',
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
      this.logger.error('Error en signup:', errorMessage);
      throw new BadRequestException(errorMessage);
    }
  }

  async signIn(signInDto: SignInDto, res: Response): Promise<AuthResponseDto> {
    this.ensureEnabled();
    try {
      const auth = this.firebaseConfig.getAuth();

      // 1. Verificar y decodificar idToken de Firebase
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(signInDto.idToken);
      } catch (error) {
        this.logger.error('idToken inválido en signin:', error);
        throw new UnauthorizedException(SignInMessages.INVALID_CREDENTIALS);
      }

      // 2. Obtener usuario completo de Firebase
      let firebaseUser;
      try {
        firebaseUser = await auth.getUser(decodedToken.uid);
      } catch (error) {
        this.logger.error('Error obteniendo usuario de Firebase:', error);
        throw new UnauthorizedException(SignInMessages.INVALID_CREDENTIALS);
      }

      const email = firebaseUser.email!;

      // 3. Buscar/crear usuario en PostgreSQL (con reintentos)
      let dbUser = await this.userRepository.findByEmailWithHouses(email);

      if (!dbUser) {
        // Auto-crear si no existe (con reintentos)
        dbUser = await this.userRepository.create({
          id: firebaseUser.uid,
          email,
          name: firebaseUser.displayName || email,
          status: Status.ACTIVE,
          role: Role.TENANT,
          email_verified: false, // Email no verificado por defecto
        });
        this.logger.log(`Usuario auto-creado en signin: ${email}`);

        // El cliente enviará el email de verificación usando Firebase Client SDK
        return {
          user: {
            id: dbUser.id,
            email: dbUser.email!,
            firstName: dbUser.name?.split(' ')[0],
            lastName: dbUser.name?.split(' ').slice(1).join(' '),
            role: dbUser.role,
            status: dbUser.status,
            emailVerified: false,
          },
          requiresEmailConfirmation: true,
          message: 'Por favor, verifica tu correo electrónico para completar el registro.',
        };
      }

      // 4. Sincronizar estado de verificación de email con Firebase
      // Si Firebase marcó el email como verificado pero PostgreSQL no, actualizar
      if (firebaseUser.emailVerified && !dbUser.email_verified) {
        this.logger.log(
          `Sincronizando email verificado en Firebase para: ${email}`,
        );
        dbUser = await this.userRepository.update(dbUser.id, {
          email_verified: true,
          email_verified_at: new Date(),
        });
        this.logger.log(
          `Email sincronizado exitosamente para: ${email}`,
        );
      }

      // 5. Verificar si el email está verificado
      if (!dbUser.email_verified) {
        this.logger.log(
          `Intento de signin sin email verificado: ${email}`,
        );
        throw new BadRequestException(
          'Por favor, verifica tu correo electrónico antes de continuar.',
        );
      }

      // 6. Generar JWTs propios
      const accessToken = await this.jwtAuthService.generateAccessToken(dbUser);
      const refreshToken = await this.jwtAuthService.generateRefreshToken(dbUser);

      // 7. Establecer cookie de access token
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: this.getCookieSecureFlag(),
        sameSite: 'lax',
        domain: this.getCookieDomain(),
        maxAge: 15 * 60 * 1000, // 15 minutos
      });

      // 8. Extraer números de casa si existen
      const houseNumbers = dbUser.houses?.map((house) => house.number_house) || [];

      return {
        accessToken,  // Para usar en Authorization header (si cookies fallan)
        refreshToken,
        user: {
          id: dbUser.id,
          email: dbUser.email!,
          firstName: dbUser.name?.split(' ')[0],
          lastName: dbUser.name?.split(' ').slice(1).join(' '),
          role: dbUser.role,
          status: dbUser.status,
          houses: houseNumbers,
          emailVerified: dbUser.email_verified,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
      this.logger.error('Error en signin:', errorMessage);
      throw new BadRequestException(errorMessage);
    }
  }

  async signOut(): Promise<void> {
    this.ensureEnabled();
    // Firebase signOut es manejado en el cliente con firebaseAuth.signOut()
    // Backend solo limpia la cookie de access token, lo cual hace el controller
    this.logger.log('Usuario desconectado');
  }

  async handleOAuthCallback(
    callbackDto: OAuthCallbackDto,
    res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.ensureEnabled();
    try {
      const auth = this.firebaseConfig.getAuth();

      // Verificar el ID Token de Firebase
      const decodedToken = await auth.verifyIdToken(callbackDto.idToken);

      // Obtener usuario completo de Firebase
      const firebaseUser = await auth.getUser(decodedToken.uid);

      // Buscar en PostgreSQL (con reintentos)
      let dbUser = await this.userRepository.findByEmail(firebaseUser.email!);

      if (!dbUser) {
        // Crear nuevo usuario si no existe (auto-registro OAuth, con reintentos)
        // OAuth ya ha verificado el email, así que marcamos como verificado
        dbUser = await this.userRepository.create({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          name: firebaseUser.displayName || firebaseUser.email!,
          status: Status.ACTIVE,
          role: Role.TENANT,
          email_verified: true, // OAuth ya verificó el email
          email_verified_at: new Date(),
        });
        this.logger.log(`Nuevo usuario creado desde OAuth: ${firebaseUser.email}`);
      } else {
        // Actualizar last_login y marcar email como verificado (con reintentos)
        dbUser = await this.userRepository.update(dbUser.id, {
          last_login: new Date(),
          ...(dbUser.email_verified === false && {
            email_verified: true,
            email_verified_at: new Date(),
          }),
        });
      }

      // Generar JWTs propios
      const jwtAccessToken = await this.jwtAuthService.generateAccessToken(dbUser);
      const refreshToken = await this.jwtAuthService.generateRefreshToken(dbUser);

      // Establecer cookie de access token
      res.cookie('access_token', jwtAccessToken, {
        httpOnly: true,
        secure: this.getCookieSecureFlag(),
        sameSite: 'lax',
        domain: this.getCookieDomain(),
        maxAge: 15 * 60 * 1000, // 15 minutos
      });

      return { accessToken: jwtAccessToken, refreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error en callback OAuth:', error);
      const errorMessage =
        error instanceof Error ? error.message : OAuthMessages.CALLBACK_FAILED;
      throw new BadRequestException(errorMessage);
    }
  }

  async refreshTokens(
    refreshTokenValue: string,
    res: Response,
  ): Promise<{ success: boolean; accessToken?: string }> {
    this.ensureEnabled();
    try {
      // Verify refresh token
      const payload = await this.jwtAuthService.verifyRefreshToken(
        refreshTokenValue,
      );

      // Get user from database (con reintentos)
      const dbUser = await this.userRepository.findById(payload.sub);

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
        secure: this.getCookieSecureFlag(),
        sameSite: 'lax',
        domain: this.getCookieDomain(),
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      return { success: true, accessToken: newAccessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : SessionMessages.REFRESH_TOKEN_FAILED;
      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Verifica el email del usuario y genera JWTs
   * (Solo para verificación explícita si es necesaria - normalmente Firebase maneja esto)
   */
  async verifyEmailAndGenerateTokens(
    firebaseUid: string,
    res: Response,
  ): Promise<AuthResponseDto> {
    this.ensureEnabled();
    try {
      const auth = this.firebaseConfig.getAuth();

      // 1. Obtener usuario de Firebase
      const firebaseUser = await auth.getUser(firebaseUid);

      if (!firebaseUser.email) {
        throw new BadRequestException('Email no encontrado en Firebase');
      }

      // 2. Buscar usuario en PostgreSQL (con reintentos)
      const dbUser = await this.userRepository.findByIdWithHouses(firebaseUid);

      if (!dbUser) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // 3. Marcar email como verificado (con reintentos)
      const updatedUser = await this.userRepository.update(firebaseUid, {
        email_verified: true,
        email_verified_at: new Date(),
      });

      this.logger.log(`Email verificado para usuario: ${updatedUser.email}`);

      // 4. Generar JWTs propios
      const accessToken = await this.jwtAuthService.generateAccessToken(updatedUser);
      const refreshToken = await this.jwtAuthService.generateRefreshToken(updatedUser);

      // 5. Establecer cookie de access token
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: this.getCookieSecureFlag(),
        sameSite: 'lax',
        domain: this.getCookieDomain(),
        maxAge: 15 * 60 * 1000, // 15 minutos
      });

      // 6. Extraer números de casa si existen (usar dbUser que tiene relaciones)
      const houseNumbers = dbUser.houses?.map((house) => house.number_house) || [];

      return {
        refreshToken,
        user: {
          id: updatedUser.id,
          email: updatedUser.email!,
          firstName: updatedUser.name?.split(' ')[0],
          lastName: updatedUser.name?.split(' ').slice(1).join(' '),
          role: updatedUser.role,
          status: updatedUser.status,
          houses: houseNumbers,
          emailVerified: true,
        },
        message: 'Email verificado exitosamente. Bienvenido!',
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Error verificando email';
      this.logger.error('Error en email verification:', errorMessage);
      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Reenvía el email de verificación a un usuario
   * Nota: El cliente (Firebase) maneja el envío automático del email
   * Este endpoint es solo para validación/confirmación
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    this.ensureEnabled();
    try {
      // 1. Buscar usuario en PostgreSQL (con reintentos)
      const dbUser = await this.userRepository.findByEmail(email);

      if (!dbUser) {
        throw new BadRequestException('Usuario no encontrado');
      }

      // 2. Si ya está verificado, no necesita reenvío
      if (dbUser.email_verified) {
        return {
          message: 'El email ya está verificado',
        };
      }

      // 3. El reenvío de email se hace desde el cliente (Firebase Client SDK)
      // Aquí solo confirmamos que el usuario existe y no está verificado
      this.logger.log(`Reenvío de verificación solicitado para: ${email}`);

      return {
        message: 'Se ha enviado un nuevo email de verificación. Por favor, revisa tu bandeja de entrada.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Error reenviando email de verificación';
      this.logger.error('Error in resend verification email:', errorMessage);
      throw new BadRequestException(errorMessage);
    }
  }

}
