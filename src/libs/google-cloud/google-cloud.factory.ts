import { Logger } from '@nestjs/common';
import { GoogleCloudClient } from './google-cloud.client';
import { GoogleCloudConfigService } from './google-cloud.config';

const logger = new Logger('GoogleCloudFactory');

let googleCloudClientInstance: GoogleCloudClient | null = null;

/**
 * Función de fábrica para crear una instancia única del cliente de Google Cloud
 * Implementa el patrón Singleton para evitar múltiples instancias
 */
export function createGoogleCloudClient(configService: GoogleCloudConfigService): GoogleCloudClient {
  if (!googleCloudClientInstance) {
    logger.log('Creando nueva instancia del cliente de Google Cloud');
    googleCloudClientInstance = new GoogleCloudClient(configService);
  } else {
    logger.log('Reutilizando instancia existente del cliente de Google Cloud');
  }
  
  return googleCloudClientInstance;
}

/**
 * Función para obtener la instancia actual del cliente
 */
export function getGoogleCloudClient(): GoogleCloudClient | null {
  return googleCloudClientInstance;
}

/**
 * Función para limpiar la instancia (útil para testing)
 */
export function clearGoogleCloudClient(): void {
  if (googleCloudClientInstance) {
    googleCloudClientInstance.clearServices();
    googleCloudClientInstance = null;
    logger.log('Instancia del cliente de Google Cloud limpiada');
  }
}

/**
 * Función para verificar si existe una instancia
 */
export function hasGoogleCloudClient(): boolean {
  return googleCloudClientInstance !== null;
}
