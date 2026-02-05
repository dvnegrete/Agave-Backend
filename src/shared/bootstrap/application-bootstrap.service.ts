import { Injectable, Logger, ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { BootstrapConfigService } from '../config/bootstrap.config';
import { CorsConfigService } from '../config/cors.config';
import { SwaggerConfigService } from '../config/swagger.config';
import { DatabaseHealthService } from '../health/database-health.service';

/**
 * Servicio de bootstrap de la aplicación
 * Orquesta todos los pasos de configuración e inicialización
 * Responsable de: validación, CORS, cookies, Swagger, health checks
 */
@Injectable()
export class ApplicationBootstrapService {
  private readonly logger = new Logger(ApplicationBootstrapService.name);

  constructor(
    private readonly bootstrapConfigService: BootstrapConfigService,
    private readonly corsConfigService: CorsConfigService,
    private readonly swaggerConfigService: SwaggerConfigService,
    private readonly databaseHealthService: DatabaseHealthService,
  ) {}

  /**
   * Configura el ValidationPipe global
   * Habilita: whitelist, forbidNonWhitelisted, transform
   *
   * @param app - Instancia de la aplicación NestJS
   */
  setupGlobalValidation(app: INestApplication): void {
    this.logger.log('Configurando ValidationPipe global...');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
  }

  /**
   * Configura CORS usando CorsConfigService
   * Valida dinámicamente el origen basado en FRONTEND_URL
   *
   * @param app - Instancia de la aplicación NestJS
   */
  setupCors(app: INestApplication): void {
    this.logger.log('Configurando CORS...');
    const corsOptions = this.corsConfigService.getCorsOptions();
    app.enableCors(corsOptions);
  }

  /**
   * Configura cookie-parser middleware
   * Habilita la lectura de cookies en las peticiones
   *
   * @param app - Instancia de la aplicación NestJS
   */
  setupCookies(app: INestApplication): void {
    this.logger.log('Configurando cookie-parser...');
    app.use(cookieParser());
  }

  /**
   * Configura Swagger/OpenAPI en endpoints /api/docs y /api/docs-json
   * Usa SwaggerConfigService para generar la configuración
   *
   * @param app - Instancia de la aplicación NestJS
   */
  setupSwagger(app: INestApplication): void {
    this.logger.log('Configurando Swagger...');

    // Crear configuración
    const swaggerConfig = this.swaggerConfigService
      .createSwaggerConfig()
      .build();

    // Crear documento
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    // Exponer en /api/docs (UI interactiva)
    SwaggerModule.setup(
      'api/docs',
      app,
      document,
      this.swaggerConfigService.getSwaggerSetupOptions(),
    );

    // Exponer JSON en /api/docs-json para generación de cliente
    SwaggerModule.setup('api/docs-json', app, document, {
      jsonDocumentUrl: '/api/docs-json',
    });
  }

  /**
   * Espera a que la Base de Datos esté disponible
   * Usa DatabaseHealthService con 3 reintentos y delay de 3 segundos
   *
   * @throws Error si la BD no se conecta después de maxAttempts
   */
  async waitForDatabase(): Promise<void> {
    this.logger.log('Verificando conectividad con la Base de Datos...');
    try {
      await this.databaseHealthService.waitForDatabase(3, 3000);
    } catch (error) {
      this.logger.error(
        '❌ No se puede conectar a la Base de Datos. Deteniendo aplicación.',
      );
      throw error;
    }
  }

  /**
   * Orquestador principal: ejecuta TODOS los pasos de bootstrap en orden
   * Este es el método que main.ts debe invocar
   *
   * @param app - Instancia de la aplicación NestJS
   */
  async configure(app: INestApplication): Promise<void> {
    // Configurar en orden
    this.setupGlobalValidation(app);
    this.setupCors(app);
    this.setupCookies(app);
    this.setupSwagger(app);

    this.logger.log('Aplicación configurada exitosamente');
  }
}
