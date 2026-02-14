import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import {
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../database/repositories/user.repository';
import { JwtAuthService } from './services/jwt-auth.service';
import { FirebaseAuthConfig } from './services/firebase-auth.config';
import { Status, Role } from '../database/entities/enums';
import { Response } from 'express';

describe('AuthService (Firebase)', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtAuthService: jest.Mocked<JwtAuthService>;
  let firebaseConfig: jest.Mocked<FirebaseAuthConfig>;
  let configService: jest.Mocked<ConfigService>;
  let mockResponse: Partial<Response>;

  const mockFirebaseUser = {
    uid: 'firebase-uid-12345',
    email: 'test@example.com',
    emailVerified: false,
    displayName: 'John Doe',
    customClaims: {
      firstName: 'John',
      lastName: 'Doe',
    },
  };

  const mockDbUser = {
    id: 'firebase-uid-12345',
    email: 'test@example.com',
    name: 'John Doe',
    email_verified: false,
    email_verified_at: null,
    status: Status.ACTIVE,
    role: Role.TENANT,
    houses: [],
    last_login: null,
  };

  beforeEach(async () => {
    mockResponse = {
      cookie: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByEmailWithHouses: jest.fn(),
            findByIdWithHouses: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtAuthService,
          useValue: {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
            verifyRefreshToken: jest.fn(),
          },
        },
        {
          provide: FirebaseAuthConfig,
          useValue: {
            getAuth: jest.fn(),
            isEnabled: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                NODE_ENV: 'test',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    jwtAuthService = module.get(JwtAuthService);
    firebaseConfig = module.get(FirebaseAuthConfig);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should create a new user successfully', async () => {
      const mockAuth = {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ uid: mockFirebaseUser.uid }),
        getUser: jest.fn().mockResolvedValue(mockFirebaseUser),
        updateUser: jest.fn(),
        setCustomUserClaims: jest.fn(),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockDbUser as any);
      jwtAuthService.generateAccessToken.mockResolvedValue('access-token');
      jwtAuthService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.signUp({
        idToken: 'valid-id-token',
        firstName: 'John',
        lastName: 'Doe',
        houseNumber: 5,
      });

      expect(result).toMatchObject({
        user: {
          id: mockDbUser.id,
          email: mockDbUser.email,
          firstName: 'John',
          lastName: 'Doe',
          role: Role.TENANT,
          status: Status.ACTIVE,
          emailVerified: false,
        },
        requiresEmailConfirmation: true,
      });

      expect(userRepository.create).toHaveBeenCalled();
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith(
        mockFirebaseUser.uid,
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        }),
      );
    });

    it('should throw error if email already registered', async () => {
      const mockAuth = {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ uid: mockFirebaseUser.uid }),
        getUser: jest.fn().mockResolvedValue(mockFirebaseUser),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.findByEmail.mockResolvedValue(mockDbUser as any);

      await expect(
        service.signUp({
          idToken: 'valid-id-token',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if idToken is invalid', async () => {
      const mockAuth = {
        verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid token')),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);

      await expect(
        service.signUp({
          idToken: 'invalid-id-token',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signIn', () => {
    it('should sign in user with verified email successfully', async () => {
      const verifiedUser = { ...mockDbUser, email_verified: true };

      const mockAuth = {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ uid: mockFirebaseUser.uid }),
        getUser: jest.fn().mockResolvedValue(mockFirebaseUser),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.findByEmailWithHouses.mockResolvedValue(
        verifiedUser as any,
      );
      jwtAuthService.generateAccessToken.mockResolvedValue('access-token');
      jwtAuthService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.signIn(
        { idToken: 'valid-id-token' },
        mockResponse as Response,
      );

      expect(result).toMatchObject({
        user: {
          id: verifiedUser.id,
          email: verifiedUser.email,
          emailVerified: true,
        },
        refreshToken: 'refresh-token',
      });

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-token',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 15 * 60 * 1000,
        }),
      );
    });

    it('should sync email verification from Firebase to PostgreSQL', async () => {
      const firebaseVerifiedUser = { ...mockFirebaseUser, emailVerified: true };
      const unverifiedDbUser = { ...mockDbUser, email_verified: false };
      const syncedDbUser = {
        ...mockDbUser,
        email_verified: true,
        email_verified_at: new Date(),
      };

      const mockAuth = {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ uid: mockFirebaseUser.uid }),
        getUser: jest.fn().mockResolvedValue(firebaseVerifiedUser),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.findByEmailWithHouses.mockResolvedValue(
        unverifiedDbUser as any,
      );
      userRepository.update.mockResolvedValue(syncedDbUser as any);
      jwtAuthService.generateAccessToken.mockResolvedValue('access-token');
      jwtAuthService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.signIn(
        { idToken: 'valid-id-token' },
        mockResponse as Response,
      );

      expect(result.user.emailVerified).toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith(
        mockDbUser.id,
        expect.objectContaining({
          email_verified: true,
        }),
      );
    });

    it('should throw error if email not verified', async () => {
      const mockAuth = {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ uid: mockFirebaseUser.uid }),
        getUser: jest.fn().mockResolvedValue(mockFirebaseUser),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.findByEmailWithHouses.mockResolvedValue(mockDbUser as any);

      await expect(
        service.signIn({ idToken: 'valid-id-token' }, mockResponse as Response),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-create user if not found in database', async () => {
      const verifiedFirebaseUser = { ...mockFirebaseUser, emailVerified: true };
      const newDbUser = { ...mockDbUser, email_verified: true };

      const mockAuth = {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ uid: mockFirebaseUser.uid }),
        getUser: jest.fn().mockResolvedValue(verifiedFirebaseUser),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.findByEmailWithHouses.mockResolvedValue(null);
      userRepository.create.mockReturnValue(newDbUser as any);
      jwtAuthService.generateAccessToken.mockResolvedValue('access-token');
      jwtAuthService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.signIn(
        { idToken: 'valid-id-token' },
        mockResponse as Response,
      );

      expect(result.user.email).toBe(mockFirebaseUser.email);
      expect(userRepository.create).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      firebaseConfig.isEnabled.mockReturnValue(true);

      await expect(service.signOut()).resolves.not.toThrow();
    });
  });

  describe('verifyEmailAndGenerateTokens', () => {
    it('should verify email and generate tokens', async () => {
      const mockAuth = {
        getUser: jest.fn().mockResolvedValue(mockFirebaseUser),
      };

      firebaseConfig.isEnabled.mockReturnValue(true);
      firebaseConfig.getAuth.mockReturnValue(mockAuth as any);
      userRepository.findByIdWithHouses.mockResolvedValue(mockDbUser as any);
      userRepository.update.mockResolvedValue({
        ...mockDbUser,
        email_verified: true,
        email_verified_at: new Date(),
      } as any);
      jwtAuthService.generateAccessToken.mockResolvedValue('access-token');
      jwtAuthService.generateRefreshToken.mockResolvedValue('refresh-token');

      const result = await service.verifyEmailAndGenerateTokens(
        mockFirebaseUser.uid,
        mockResponse as Response,
      );

      expect(result.user.emailVerified).toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith(
        mockFirebaseUser.uid,
        expect.objectContaining({
          email_verified: true,
        }),
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-token',
        expect.any(Object),
      );
    });
  });

  describe('resendVerificationEmail', () => {
    it('should return message when email needs verification', async () => {
      firebaseConfig.isEnabled.mockReturnValue(true);
      userRepository.findByEmail.mockResolvedValue(mockDbUser as any);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(result.message).toContain('nuevo email de verificación');
    });

    it('should return message when email already verified', async () => {
      firebaseConfig.isEnabled.mockReturnValue(true);
      const verifiedUser = { ...mockDbUser, email_verified: true };
      userRepository.findByEmail.mockResolvedValue(verifiedUser as any);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(result.message).toContain('ya está verificado');
    });

    it('should throw error when user not found', async () => {
      firebaseConfig.isEnabled.mockReturnValue(true);
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.resendVerificationEmail('nonexistent@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      firebaseConfig.isEnabled.mockReturnValue(true);
      jwtAuthService.verifyRefreshToken.mockResolvedValue({
        sub: mockDbUser.id,
      } as any);
      userRepository.findById.mockResolvedValue(mockDbUser as any);
      jwtAuthService.generateAccessToken.mockResolvedValue('new-access-token');

      const result = await service.refreshTokens(
        'valid-refresh-token',
        mockResponse as Response,
      );

      expect(result.success).toBe(true);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'new-access-token',
        expect.any(Object),
      );
    });

    it('should throw error when refresh token is invalid', async () => {
      firebaseConfig.isEnabled.mockReturnValue(true);
      jwtAuthService.verifyRefreshToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      await expect(
        service.refreshTokens(
          'invalid-refresh-token',
          mockResponse as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
