import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get supabaseUrl(): string {
    const url = this.configService.get<string>('SUPABASE_URL');
    if (!url) {
      throw new Error('SUPABASE_URL no está configurada');
    }
    return url;
  }

  get supabaseAnonKey(): string {
    const key = this.configService.get<string>('SUPABASE_ANON_KEY');
    if (!key) {
      throw new Error('SUPABASE_ANON_KEY no está configurada');
    }
    return key;
  }

  get supabaseServiceRoleKey(): string {
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada');
    }
    return key;
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }
}
