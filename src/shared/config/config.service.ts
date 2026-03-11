import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get frontendUrl(): string {
    return this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isStaging(): boolean {
    return this.nodeEnv === 'staging';
  }

  get googleApplicationCredentials(): string {
    const credentials = this.configService.get<string>(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
    if (!credentials) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS no está configurada');
    }
    return credentials;
  }

  get googleProjectId(): string {
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID no está configurada');
    }
    return projectId;
  }
}
