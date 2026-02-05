import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from './config.service';

/**
 * Servicio de configuración de bootstrap
 * Centraliza todas las validaciones de variables de entorno críticas para el startup
 * Proporciona acceso a configuración necesaria durante la inicialización de la aplicación
 */
@Injectable()
export class BootstrapConfigService {
  private readonly logger = new Logger(BootstrapConfigService.name);

  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * Getter para NODE_ENV (delegado a AppConfigService)
   */
  get nodeEnv(): string {
    return this.appConfigService.nodeEnv;
  }

  /**
   * Getter para FRONTEND_URL (delegado a AppConfigService)
   */
  get frontendUrl(): string {
    return this.appConfigService.frontendUrl;
  }

  /**
   * Getter para PORT (delegado a AppConfigService)
   */
  get port(): number {
    return this.appConfigService.port;
  }

  /**
   * Getter para verificar si está en desarrollo (delegado a AppConfigService)
   */
  get isDevelopment(): boolean {
    return this.appConfigService.isDevelopment;
  }

  /**
   * Getter para verificar si está en staging (delegado a AppConfigService)
   */
  get isStaging(): boolean {
    return this.appConfigService.isStaging;
  }

  /**
   * Getter para verificar si está en producción (delegado a AppConfigService)
   */
  get isProduction(): boolean {
    return this.appConfigService.isProduction;
  }

  /**
   * Valida que NODE_ENV tenga un valor reconocido
   * @throws Error si NODE_ENV no es válido
   */
  private validateNodeEnv(): void {
    const nodeEnv = this.nodeEnv;
    const validNodeEnvs = ['development', 'staging', 'production', 'test'];

    if (!validNodeEnvs.includes(nodeEnv)) {
      this.logger.warn(
        `⚠️  Warning: NODE_ENV="${nodeEnv}" is not standard. ` +
        `Expected: ${validNodeEnvs.join(', ')}`,
      );
    }
  }

  /**
   * Valida que FRONTEND_URL esté configurada y sea válida
   * CRÍTICO: FRONTEND_URL es obligatorio en TODOS los ambientes
   * @throws Error si FRONTEND_URL falta o es inválido
   */
  private validateFrontendUrl(): void {
    const frontendUrl = this.frontendUrl;

    // ❌ CRÍTICO: FRONTEND_URL es obligatorio en TODOS los ambientes
    if (!frontendUrl || frontendUrl.trim() === '') {
      const errorMsg =
        `\n❌ FATAL ERROR: FRONTEND_URL environment variable is missing!\n\n` +
        `This is REQUIRED in all environments for cookie security configuration.\n\n` +
        `   Current NODE_ENV: ${this.nodeEnv}\n\n` +
        `Configure FRONTEND_URL in your .env:\n` +
        `   - Development: FRONTEND_URL=http://localhost:PORT\n` +
        `   - Staging/Production: FRONTEND_URL=https://your-frontend-domain.com\n\n` +
        `Without FRONTEND_URL, authentication will fail!\n`;

      this.logger.error(errorMsg);
      throw new Error('FRONTEND_URL is required');
    }

    this.logger.log(`✅ FRONTEND_URL: ${frontendUrl}`);

    // ✅ Validar que FRONTEND_URL tenga protocolo correcto
    if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
      const errorMsg =
        `\n❌ FATAL ERROR: FRONTEND_URL must start with http:// or https://\n\n` +
        `   Current: ${frontendUrl}\n` +
        `   Invalid!\n\n` +
        `Correct examples:\n` +
        `   - http://localhost:PORT\n` +
        `   - https://your-frontend-domain.com\n`;

      this.logger.error(errorMsg);
      throw new Error('FRONTEND_URL must start with http:// or https://');
    }
  }

  /**
   * Valida coherencia entre NODE_ENV y protocolo FRONTEND_URL
   * Production/Staging deben usar HTTPS
   * @throws Error si hay conflicto crítico
   */
  private validateEnvironmentCoherence(): void {
    const frontendUrl = this.frontendUrl;
    const isHttps = frontendUrl.startsWith('https://');

    if (this.isDevelopment && isHttps) {
      this.logger.warn(
        `⚠️  Warning: NODE_ENV=development but FRONTEND_URL is HTTPS. ` +
        `This is unusual but OK if using HTTPS in development.`,
      );
    }

    if ((this.isProduction || this.isStaging) && !isHttps) {
      const errorMsg =
        `\n❌ FATAL ERROR: NODE_ENV="${this.nodeEnv}" requires HTTPS but FRONTEND_URL is HTTP!\n\n` +
        `   Current: ${frontendUrl}\n\n` +
        `For ${this.nodeEnv} environment, FRONTEND_URL must be HTTPS.\n` +
        `This is required for cookie security (secure flag).\n`;

      this.logger.error(errorMsg);
      throw new Error(
        `NODE_ENV="${this.nodeEnv}" requires HTTPS but FRONTEND_URL is HTTP`,
      );
    }
  }

  /**
   * Ejecuta TODAS las validaciones de variables de entorno
   * Fail-fast: Lanza errores para config crítica
   * @throws Error si hay validaciones críticas que fallan
   */
  validateAll(): void {
    this.logger.log(`📋 Environment: ${this.nodeEnv}`);

    try {
      this.validateNodeEnv();
      this.validateFrontendUrl();
      this.validateEnvironmentCoherence();
      this.logger.log(`✅ All environment variables validated successfully!\n`);
    } catch (error) {
      this.logger.error(`Validation failed: ${error.message}`);
      throw error;
    }
  }
}
