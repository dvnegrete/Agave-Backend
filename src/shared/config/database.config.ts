import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export interface DatabaseConfig {
  url: string;
  provider: 'postgresql' | 'mysql' | 'sqlite';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
}

@Injectable()
export class DatabaseConfigService {
  constructor(private configService: ConfigService) {}

  getDatabaseConfig(): DatabaseConfig {
    const databaseProvider = this.configService.get<string>(
      'DATABASE_PROVIDER',
      'postgresql',
    );

    switch (databaseProvider) {
      case 'supabase':
        return this.getSupabaseConfig();
      case 'local':
        return this.getLocalConfig();
      case 'production':
        return this.getProductionConfig();
      default:
        return this.getDefaultConfig();
    }
  }

  private getSupabaseConfig(): DatabaseConfig {
    return {
      url: this.configService.get<string>('DATABASE_URL') || '',
      provider: 'postgresql',
      ssl: true,
    };
  }

  private getLocalConfig(): DatabaseConfig {
    return {
      url:
        this.configService.get<string>('DATABASE_URL') ||
        'postgresql://user:password@localhost:5432/agave_db',
      provider: 'postgresql',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'user'),
      password: this.configService.get<string>('DB_PASSWORD', 'password'),
      database: this.configService.get<string>('DB_NAME', 'agave_db'),
      ssl: false,
    };
  }

  private getProductionConfig(): DatabaseConfig {
    return {
      url: this.configService.get<string>('DATABASE_URL') || '',
      provider: 'postgresql',
      ssl: true,
    };
  }

  private getDefaultConfig(): DatabaseConfig {
    return {
      url: this.configService.get<string>('DATABASE_URL') || '',
      provider: 'postgresql',
      ssl: false,
    };
  }

  getConnectionString(): string {
    const config = this.getDatabaseConfig();

    if (config.url) {
      return config.url;
    }

    // Construir URL de conexión si no se proporciona directamente
    const { host, port, username, password, database, ssl } = config;

    if (config.provider === 'postgresql') {
      const sslParam = ssl ? '?sslmode=require' : '';
      return `postgresql://${username}:${password}@${host}:${port}/${database}${sslParam}`;
    }

    throw new Error(`Unsupported database provider: ${config.provider}`);
  }

  getTypeOrmConfig(): TypeOrmModuleOptions {
    const config = this.getDatabaseConfig();

    return {
      type: 'postgres',
      url: config.url || this.getConnectionString(),
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      entities: [__dirname + '/../database/entities/*.entity{.ts,.js}'],
      autoLoadEntities: true,
      synchronize: this.configService.get<string>('NODE_ENV') === 'development',
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      migrations: [__dirname + '/../../database/migrations/*{.ts,.js}'],
      migrationsRun: false,
    };
  }
}
