import { Injectable, Logger } from '@nestjs/common';
import { VertexAIClient } from './vertex-ai.client';
import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google-cloud/vertexai';

@Injectable()
export class VertexAIService {
  private readonly logger = new Logger(VertexAIService.name);

  constructor(private readonly vertexAIClient: VertexAIClient) {}

  async processTextWithPrompt(text: string, customPrompt?: string): Promise<any> {
    const vertexAI = this.vertexAIClient.getClient();
    if (!vertexAI) {
      this.logger.error('El cliente de Vertex AI no está disponible.');
      throw new Error('El servicio de Vertex AI no está configurado.');
    }

    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      // Ajusta los parámetros de seguridad según tus necesidades
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const prompt = customPrompt || `Eres un extractor de datos de comprobantes de pago. Responde SOLO en JSON. Campos requeridos: monto (MXN), fecha_pago (YYYY-MM-DD), referencia, hora_transaccion. Si algún campo falta o es inválido, incluye 'faltan_datos': true y 'pregunta' con texto breve para pedirlo. Si todo está correcto, 'faltan_datos': false. El texto a analizar es: \n\n${text}`;

    try {
      const resp = await generativeModel.generateContent(prompt);
      const jsonString =
        resp.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!jsonString) {
        throw new Error('La respuesta de Vertex AI no contiene contenido.');
      }

      return JSON.parse(jsonString);
    } catch (error) {
      this.logger.error('Error al procesar el texto con Vertex AI:', error);
      throw new Error(
        `Error en la comunicación con Vertex AI: ${error.message}`,
      );
    }
  }
}
