import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FirebaseAuthConfig } from './firebase-auth.config';
import * as admin from 'firebase-admin';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
  auth: jest.fn(),
}));

describe('FirebaseAuthConfig', () => {
  let config: FirebaseAuthConfig;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirebaseAuthConfig,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                PROJECT_ID_GCP: 'test-project',
                CLIENT_EMAIL_GCP: 'test@project.iam.gserviceaccount.com',
                PRIVATE_KEY_GCP:
                  '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----\n',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    config = module.get<FirebaseAuthConfig>(FirebaseAuthConfig);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(config).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize Firebase successfully when config is complete', () => {
      expect(admin.initializeApp).toHaveBeenCalled();
      expect(admin.credential.cert).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test-project',
          clientEmail: 'test@project.iam.gserviceaccount.com',
        }),
      );
    });

    it('should be enabled when fully configured', () => {
      expect(config.isEnabled()).toBe(true);
    });
  });

  describe('getAuth', () => {
    it('should return auth instance', () => {
      const mockAuth = { verifyIdToken: jest.fn() };
      (admin.auth as jest.Mock).mockReturnValue(mockAuth);

      expect(config.getAuth()).toBeDefined();
    });

    it('should throw error when Firebase not initialized', () => {
      const incompleteConfig = new FirebaseAuthConfig(configService);
      // Simulate Firebase not initialized by setting private field
      Object.defineProperty(incompleteConfig, 'firebaseApp', {
        value: null,
        writable: true,
      });

      expect(() => incompleteConfig.getAuth()).toThrow(
        'Firebase not initialized',
      );
    });
  });

  describe('isEnabled', () => {
    it('should return false when Firebase not initialized', async () => {
      configService.get.mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FirebaseAuthConfig,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const incompleteConfig =
        module.get<FirebaseAuthConfig>(FirebaseAuthConfig);
      expect(incompleteConfig.isEnabled()).toBe(false);
    });
  });
});
