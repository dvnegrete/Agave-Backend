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
  constructor(private configService: ConfigService) { }

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
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    // Configuración optimizada del pool según ambiente
    const poolConfig = isProduction
      ? this.getProductionPoolConfig()
      : isDevelopment
        ? this.getDevelopmentPoolConfig()
        : this.getDefaultPoolConfig();

    return {
      type: 'postgres',
      url: config.url || this.getConnectionString(),
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      // Usar solo autoLoadEntities en lugar de especificar el patrón entities
      // Esto evita la carga duplicada y problemas con dependencias circulares
      autoLoadEntities: true,
      synchronize: isDevelopment,
      logging: isDevelopment,
      migrations: [__dirname + '/../../database/migrations/*{.ts,.js}'],
      migrationsRun: false,

      // ✅ Configuración optimizada del Connection Pool
      // TypeORM utiliza pg (node-postgres) bajo el hood, por lo que estos settings van en 'extra'
      extra: {
        max: poolConfig.maxConnections, // Max 20 (production) / 5 (development)
        maxQueue: poolConfig.maxQueryQueue, // Max queries en queue
        idleTimeoutMillis: poolConfig.idleTimeoutMillis, // 30s (prod) / 10s (dev)
        connectionTimeoutMillis: poolConfig.connectionTimeoutMillis, // 5s (prod) / 3s (dev)
        allowExitOnIdle: false, // Mantener conexiones vivas en el pool
        // Validación periódica de conexiones vivas
        statement_timeout: 30000, // Statement timeout en ms
      },
    };
  }

  /**
   * Configuración de pool para producción
   * Optimizada para alto rendimiento y confiabilidad
   */
  private getProductionPoolConfig(): {
    maxConnections: number;
    maxQueryQueue: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  } {
    return {
      maxConnections: 20, // Max 20 conexiones simultáneas
      maxQueryQueue: 100, // Max 100 queries esperando
      idleTimeoutMillis: 30000, // 30 segundos de timeout idle
      connectionTimeoutMillis: 5000, // 5 segundos para conectar
    };
  }

  /**
   * Configuración de pool para desarrollo
   * Optimizada para menor consumo de recursos
   */
  private getDevelopmentPoolConfig(): {
    maxConnections: number;
    maxQueryQueue: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  } {
    return {
      maxConnections: 5, // Max 5 conexiones (menos recursos)
      maxQueryQueue: 50,
      idleTimeoutMillis: 10000, // 10 segundos
      connectionTimeoutMillis: 3000, // 3 segundos
    };
  }

  /**
   * Configuración de pool por defecto
   * Punto medio entre producción y desarrollo
   */
  private getDefaultPoolConfig(): {
    maxConnections: number;
    maxQueryQueue: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  } {
    return {
      maxConnections: 10,
      maxQueryQueue: 50,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 4000,
    };
  }
}
