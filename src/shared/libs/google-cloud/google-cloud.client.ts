import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import { Translate } from '@google-cloud/translate/build/src/v2';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { SpeechClient } from '@google-cloud/speech';
import {
  GoogleCloudConfigService,
  GoogleCloudConfig,
} from './google-cloud.config';

export interface GoogleCloudServices {
  vision?: ImageAnnotatorClient;
  storage?: Storage;
  translate?: Translate;
  textToSpeech?: TextToSpeechClient;
  speech?: SpeechClient;
}

@Injectable()
export class GoogleCloudClient implements OnModuleInit {
  private readonly logger = new Logger(GoogleCloudClient.name);
  private services: GoogleCloudServices = {};
  private config: GoogleCloudConfig | null = null;
  private isInitialized = false;

  constructor(private readonly configService: GoogleCloudConfigService) {}

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (!this.configService.isEnabled) {
        this.logger.warn(
          'Google Cloud no está configurado. Los servicios no estarán disponibles.',
        );
        return;
      }

      this.config = this.configService.getConfig();

      // Inicializar servicios según sea necesario
      // Los servicios se inicializan bajo demanda para optimizar recursos

      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Error al inicializar Google Cloud client:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Obtiene el cliente de Vision API
   */
  getVisionClient(): ImageAnnotatorClient | null {
    if (!this.isInitialized || !this.config) {
      this.logger.warn('Google Cloud no está inicializado');
      return null;
    }

    if (!this.services.vision) {
      try {
        this.services.vision = new ImageAnnotatorClient({
          credentials: JSON.parse(this.config.applicationCredentials),
          projectId: this.config.projectId,
        });
      } catch (error) {
        this.logger.error('Error al inicializar Vision API client:', error);
        return null;
      }
    }

    return this.services.vision;
  }

  /**
   * Obtiene el cliente de Cloud Storage
   */
  getStorageClient(): Storage | null {
    if (!this.isInitialized || !this.config) {
      this.logger.warn('Google Cloud no está inicializado');
      return null;
    }

    if (!this.services.storage) {
      try {
        this.services.storage = new Storage({
          credentials: JSON.parse(this.config.applicationCredentials),
          projectId: this.config.projectId,
        });
      } catch (error) {
        this.logger.error('Error al inicializar Cloud Storage client:', error);
        return null;
      }
    }

    return this.services.storage;
  }

  /**
   * Obtiene el cliente de Cloud Translate
   */
  getTranslateClient(): Translate | null {
    if (!this.isInitialized || !this.config) {
      this.logger.warn('Google Cloud no está inicializado');
      return null;
    }

    if (!this.services.translate) {
      try {
        this.services.translate = new Translate({
          credentials: JSON.parse(this.config.applicationCredentials),
          projectId: this.config.projectId,
        });
      } catch (error) {
        this.logger.error(
          'Error al inicializar Cloud Translate client:',
          error,
        );
        return null;
      }
    }

    return this.services.translate;
  }

  /**
   * Obtiene el cliente de Text-to-Speech
   */
  getTextToSpeechClient(): TextToSpeechClient | null {
    if (!this.isInitialized || !this.config) {
      this.logger.warn('Google Cloud no está inicializado');
      return null;
    }

    if (!this.services.textToSpeech) {
      try {
        this.services.textToSpeech = new TextToSpeechClient({
          credentials: JSON.parse(this.config.applicationCredentials),
          projectId: this.config.projectId,
        });
      } catch (error) {
        this.logger.error('Error al inicializar Text-to-Speech client:', error);
        return null;
      }
    }

    return this.services.textToSpeech;
  }

  /**
   * Obtiene el cliente de Speech-to-Text
   */
  getSpeechClient(): SpeechClient | null {
    if (!this.isInitialized || !this.config) {
      this.logger.warn('Google Cloud no está inicializado');
      return null;
    }

    if (!this.services.speech) {
      try {
        this.services.speech = new SpeechClient({
          credentials: JSON.parse(this.config.applicationCredentials),
          projectId: this.config.projectId,
        });
      } catch (error) {
        this.logger.error('Error al inicializar Speech-to-Text client:', error);
        return null;
      }
    }

    return this.services.speech;
  }

  /**
   * Verifica si el cliente está inicializado
   */
  isReady(): boolean {
    return this.isInitialized && this.config !== null;
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): GoogleCloudConfig | null {
    return this.config;
  }

  /**
   * Limpia todos los servicios (útil para testing)
   */
  clearServices(): void {
    this.services = {};
  }
}
