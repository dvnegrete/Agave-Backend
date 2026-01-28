import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Obtiene la URL de conexión a PostgreSQL
   * Prioriza DATABASE_URL (para Railway/producción)
   * Fallback a componentes individuales (desarrollo local)
   */
  getConnectionString(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (databaseUrl) {
      return databaseUrl;
    }

    // Fallback para desarrollo local usando componentes individuales
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<number>('DB_PORT', 5432);
    const username = this.configService.get<string>('DB_USERNAME', 'user');
    const password = this.configService.get<string>('DB_PASSWORD', 'password');
    const database = this.configService.get<string>('DB_NAME', 'agave_db');

    return `postgresql://${username}:${password}@${host}:${port}/${database}`;
  }

  /**
   * Determina si SSL debe estar habilitado basado en NODE_ENV
   * - staging y production (Railway) requieren SSL
   * - development (local) no requiere SSL
   */
  private isSslEnabled(): boolean {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    return nodeEnv === 'staging' || nodeEnv === 'production';
  }

  /**
   * Configuración de TypeORM con optimización de pool según ambiente
   */
  getTypeOrmConfig(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isDevelopment = nodeEnv === 'development';
    const isStaging = nodeEnv === 'staging';
    const isProduction = nodeEnv === 'production';

    // Configuración optimizada del pool según ambiente
    let poolConfig;
    if (isProduction) {
      poolConfig = this.getProductionPoolConfig();
    } else if (isStaging) {
      poolConfig = this.getStagingPoolConfig();
    } else if (isDevelopment) {
      poolConfig = this.getDevelopmentPoolConfig();
    } else {
      poolConfig = this.getDefaultPoolConfig();
    }

    // Determinar configuración SSL basada en NODE_ENV
    const sslConfig = this.isSslEnabled()
      ? { rejectUnauthorized: false }
      : false;

    return {
      type: 'postgres',
      url: this.getConnectionString(),
      ssl: sslConfig,
      // Usar solo autoLoadEntities en lugar de especificar el patrón entities
      // Esto evita la carga duplicada y problemas con dependencias circulares
      autoLoadEntities: true,
      // Auto-sync solo en desarrollo (cambios de esquema en tiempo real)
      synchronize: isDevelopment,
      // Query logging solo en desarrollo (overhead en otros ambientes)
      logging: isDevelopment,
      migrations: [__dirname + '/../../database/migrations/*{.ts,.js}'],
      migrationsRun: false,

      // ✅ Configuración optimizada del Connection Pool
      // TypeORM utiliza pg (node-postgres) bajo the hood, por lo que estos settings van en 'extra'
      extra: {
        max: poolConfig.maxConnections, // Max 20 (production) / 10 (staging) / 5 (development)
        maxQueue: poolConfig.maxQueryQueue, // Max queries en queue
        idleTimeoutMillis: poolConfig.idleTimeoutMillis, // 30s (prod) / 20s (staging) / 10s (dev)
        connectionTimeoutMillis: poolConfig.connectionTimeoutMillis, // 5s (prod) / 4s (staging) / 3s (dev)
        allowExitOnIdle: false, // Mantener conexiones vivas en el pool
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
   * Configuración de pool para staging
   * Equilibrio entre desarrollo y producción
   * Usado para testing y validación pre-producción
   */
  private getStagingPoolConfig(): {
    maxConnections: number;
    maxQueryQueue: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  } {
    return {
      maxConnections: 10, // Max 10 conexiones (intermedio)
      maxQueryQueue: 75,
      idleTimeoutMillis: 20000, // 20 segundos
      connectionTimeoutMillis: 4000, // 4 segundos
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
