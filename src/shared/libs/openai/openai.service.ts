import { Injectable, Logger } from '@nestjs/common';
import { OpenAIClient } from './openai.client';
import { OpenAIConfigService } from './openai.config';
import { getOCRExtractionPrompt } from '@/shared/config/ocr-prompts.config';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(
    private readonly openAIClient: OpenAIClient,
    private readonly configService: OpenAIConfigService,
  ) {}

  async processTextWithPrompt(
    text: string,
    customPrompt?: string,
  ): Promise<any> {
    const client = this.openAIClient.getClient();
    if (!client) {
      this.logger.error('El cliente de OpenAI no está disponible.');
      throw new Error('El servicio de OpenAI no está configurado.');
    }

    const systemPrompt = getOCRExtractionPrompt(customPrompt);

    try {
      const completion = await client.chat.completions.create({
        model: this.configService.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('La respuesta de OpenAI no contiene contenido.');
      }

      return JSON.parse(responseContent);
    } catch (error) {
      this.logger.error('Error al procesar el texto con OpenAI:', error);
      throw new Error(`Error en la comunicación con OpenAI: ${error.message}`);
    }
  }
}
