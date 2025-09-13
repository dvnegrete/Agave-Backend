import { Injectable, Logger } from '@nestjs/common';
import { OpenAIClient } from './openai.client';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private readonly openAIClient: OpenAIClient) {}

  async processTextWithPrompt(text: string): Promise<any> {
    const client = this.openAIClient.getClient();
    if (!client) {
      this.logger.error('El cliente de OpenAI no está disponible.');
      throw new Error('El servicio de OpenAI no está configurado.');
    }

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              "Eres un extractor de datos de comprobantes de pago. Responde SOLO en JSON. Campos requeridos: monto (MXN), fecha_pago (YYYY-MM-DD), referencia, banco, emisor. Si algún campo falta o es inválido, incluye 'faltan_datos': true y 'pregunta' con texto breve para pedirlo. Si todo está correcto, 'faltan_datos': false.",
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
