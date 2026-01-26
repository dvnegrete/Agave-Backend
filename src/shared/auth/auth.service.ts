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
    @InjectRepository(DbUser)
    private userRepository: Repository<DbUser>,
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

      // 3. Verificar si el usuario ya existe en PostgreSQL
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

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

      // 6. Crear usuario en PostgreSQL
      const dbUser = this.userRepository.create({
        id: firebaseUser.uid,
        email,
        name: signUpDto.firstName && signUpDto.lastName
          ? `${signUpDto.firstName} ${signUpDto.lastName}`.trim()
          : email,
        status: Status.ACTIVE,
        role: Role.TENANT,
        observations: signUpDto.houseNumber
          ? `Casa reclamada durante registro: ${signUpDto.houseNumber}`
          : undefined,
      });

      await this.userRepository.save(dbUser);
      this.logger.log(
        `Usuario creado exitosamente: ${email} (firebase: ${firebaseUser.uid})`,
      );

      // 7. Generar JWTs propios (no del proveedor)
      const accessToken = await this.jwtAuthService.generateAccessToken(dbUser);
      const refreshToken = await this.jwtAuthService.generateRefreshToken(dbUser);

      return {
        refreshToken,
        user: {
          id: dbUser.id,
          email: dbUser.email!,
          firstName: signUpDto.firstName,
          lastName: signUpDto.lastName,
          role: dbUser.role,
          status: dbUser.status,
        },
        requiresEmailConfirmation: false,
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

      // 3. Buscar/crear usuario en PostgreSQL
      let dbUser = await this.userRepository.findOne({
        where: { email },
        relations: { houses: true },
      });

      if (!dbUser) {
        // Auto-crear si no existe
        dbUser = this.userRepository.create({
          id: firebaseUser.uid,
          email,
          name: firebaseUser.displayName || email,
          status: Status.ACTIVE,
          role: Role.TENANT,
        });
        await this.userRepository.save(dbUser);
        this.logger.log(`Usuario auto-creado en signin: ${email}`);
      }

      // 4. Generar JWTs propios
      const accessToken = await this.jwtAuthService.generateAccessToken(dbUser);
      const refreshToken = await this.jwtAuthService.generateRefreshToken(dbUser);

      // 5. Establecer cookie de access token
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutos
      });

      // 6. Extraer números de casa si existen
      const houseNumbers = dbUser.houses?.map((house) => house.number_house) || [];

      return {
        refreshToken,
        user: {
          id: dbUser.id,
          email: dbUser.email!,
          firstName: dbUser.name?.split(' ')[0],
          lastName: dbUser.name?.split(' ').slice(1).join(' '),
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
  ): Promise<{ refreshToken: string }> {
    this.ensureEnabled();
    try {
      const auth = this.firebaseConfig.getAuth();

      // Verificar el ID Token de Firebase
      const decodedToken = await auth.verifyIdToken(callbackDto.idToken);

      // Obtener usuario completo de Firebase
      const firebaseUser = await auth.getUser(decodedToken.uid);

      // Buscar en PostgreSQL
      let dbUser = await this.userRepository.findOne({
        where: { email: firebaseUser.email! },
      });

      if (!dbUser) {
        // Crear nuevo usuario si no existe (auto-registro OAuth)
        dbUser = this.userRepository.create({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          name: firebaseUser.displayName || firebaseUser.email!,
          status: Status.ACTIVE,
          role: Role.TENANT,
        });
        await this.userRepository.save(dbUser);
        this.logger.log(`Nuevo usuario creado desde OAuth: ${firebaseUser.email}`);
      } else {
        // Actualizar last_login
        dbUser.last_login = new Date();
        await this.userRepository.save(dbUser);
      }

      // Generar JWTs propios
      const jwtAccessToken = await this.jwtAuthService.generateAccessToken(dbUser);
      const refreshToken = await this.jwtAuthService.generateRefreshToken(dbUser);

      // Establecer cookie de access token
      res.cookie('access_token', jwtAccessToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutos
      });

      return { refreshToken };
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
