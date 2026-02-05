import { Injectable, Logger } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppConfigService } from './config.service';

/**
 * Servicio de configuración CORS
 * Centraliza la lógica de validación de origen y generación de opciones CORS
 */
@Injectable()
export class CorsConfigService {
  private readonly logger = new Logger(CorsConfigService.name);

  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * Extrae el dominio (sin protocolo ni puerto) de una URL
   * Utilidad para comparar orígenes CORS
   *
   * @param url - URL completa (ej: https://example.com:3000)
   * @returns Dominio sin protocolo ni puerto (ej: example.com)
   */
  private extractDomain(url: string): string {
    return url
      .replace(/^https?:\/\//, '') // Remover protocolo
      .replace(/\/$/, '') // Remover trailing slash
      .split(':')[0]; // Extraer solo el dominio (sin puerto)
  }

  /**
   * Valida si un origen es permitido
   * Compara el origen completo y también por dominio (en caso de puertos diferentes)
   *
   * @param origin - Header 'origin' de la petición CORS
   * @returns true si el origen es permitido, false en caso contrario
   */
  private isOriginAllowed(origin: string): boolean {
    const frontendUrl = this.appConfigService.frontendUrl;

    // En desarrollo local (sin origin en peticiones same-origin)
    if (!origin) {
      return true;
    }

    // Comparar el origin completo (incluyendo protocolo)
    if (origin === frontendUrl) {
      return true;
    }

    // Alternativa: comparar solo dominios (para casos con puertos diferentes)
    const originDomain = this.extractDomain(origin);
    const expectedDomain = this.extractDomain(frontendUrl);

    if (expectedDomain && originDomain === expectedDomain) {
      return true;
    }

    return false;
  }

  /**
   * Genera las opciones de CORS completas para la aplicación
   * @returns CorsOptions configuradas según FRONTEND_URL
   */
  getCorsOptions(): CorsOptions {
    return {
      origin: (origin, callback) => {
        const isAllowed = this.isOriginAllowed(origin);

        if (!isAllowed) {
          this.logger.warn(
            `❌ CORS rejected origin: ${origin} (expected: ${this.appConfigService.frontendUrl})`,
          );
        }

        callback(null, isAllowed);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    };
  }
}
