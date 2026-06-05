import { Injectable, Logger } from '@nestjs/common';
import { GoogleCloudConfigService } from '../google-cloud/google-cloud.config';
import { VertexAI } from '@google-cloud/vertexai';

@Injectable()
export class VertexAIClient {
  private readonly logger = new Logger(VertexAIClient.name);
  private client: VertexAI | null = null;

  constructor(private readonly configService: GoogleCloudConfigService) {
    if (!this.configService.isEnabled) {
      this.logger.warn(
        'El servicio de Google Cloud no está habilitado. El cliente de Vertex AI no estará disponible.',
      );
      return;
    }

    try {
      const config = this.configService.getConfig();
      this.client = new VertexAI({
        project: config.projectId,
        // Los modelos Gemini 2.5+/3.x solo existen en el endpoint 'global', no en
        // regiones (us-central1 → 404). Es un valor estructural estable, no por entorno.
        location: 'global',
        // El SDK arma el host como `${location}-aiplatform.googleapis.com`, lo que con
        // 'global' daría 'global-aiplatform.googleapis.com' (host inexistente → responde
        // HTML de error y rompe el JSON.parse). El host global correcto omite el prefijo.
        apiEndpoint: 'aiplatform.googleapis.com',
        googleAuthOptions: {
          credentials: JSON.parse(config.applicationCredentials),
        },
      });
    } catch (error) {
      this.logger.error('Error al inicializar el cliente de Vertex AI:', error);
      this.client = null;
    }
  }

  getClient(): VertexAI | null {
    return this.client;
  }
}
