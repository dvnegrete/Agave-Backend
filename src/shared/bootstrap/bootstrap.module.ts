import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from '../health/health.module';
import { AppConfigService } from '../config/config.service';
import { BootstrapConfigService } from '../config/bootstrap.config';
import { CorsConfigService } from '../config/cors.config';
import { SwaggerConfigService } from '../config/swagger.config';
import { ApplicationBootstrapService } from './application-bootstrap.service';

/**
 * Módulo de Bootstrap
 * Encapsula todos los servicios necesarios para inicializar la aplicación
 * Proporciona DI de servicios de configuración y orquestación
 */
@Module({
  imports: [ConfigModule, HealthModule],
  providers: [
    AppConfigService,
    BootstrapConfigService,
    CorsConfigService,
    SwaggerConfigService,
    ApplicationBootstrapService,
  ],
  exports: [ApplicationBootstrapService, BootstrapConfigService],
})
export class BootstrapModule {}
