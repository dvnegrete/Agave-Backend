import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OpenAIConfigService } from './openai.config';

@Injectable()
export class OpenAIClient implements OnModuleInit {
  private readonly logger = new Logger(OpenAIClient.name);
  private client: OpenAI;

  constructor(private readonly configService: OpenAIConfigService) {}

  onModuleInit() {
    if (this.configService.isEnabled) {
      try {
        this.client = new OpenAI({
          apiKey: this.configService.apiKey,
        });
        this.logger.log('Cliente de OpenAI inicializado correctamente.');
      } catch (error) {
        this.logger.error('Error al inicializar el cliente de OpenAI:', error);
      }
    } else {
      this.logger.warn('El servicio de OpenAI está deshabilitado. No se inicializará el cliente.');
    }
  }

  getClient(): OpenAI {
    if (!this.client) {
      this.logger.warn('Se intentó acceder al cliente de OpenAI pero no está inicializado.');
    }
    return this.client;
  }
}
