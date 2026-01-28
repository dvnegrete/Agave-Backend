import { Injectable, Logger } from '@nestjs/common';
import { VertexAIClient } from './vertex-ai.client';
import { getOCRExtractionPromptWithDocument } from '@/shared/config/ocr-prompts.config';
import {
  VertexAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google-cloud/vertexai';

@Injectable()
export class VertexAIService {
  private readonly logger = new Logger(VertexAIService.name);

  constructor(private readonly vertexAIClient: VertexAIClient) {}

  async processTextWithPrompt(
    text: string,
    customPrompt?: string,
  ): Promise<any> {
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

    const prompt = customPrompt || getOCRExtractionPromptWithDocument(text);

    try {
      const resp = await generativeModel.generateContent(prompt);
      const jsonString =
        resp.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!jsonString) {
        throw new Error('La respuesta de Vertex AI no contiene contenido.');
      }

      let parsedData = JSON.parse(jsonString);

      // IMPORTANTE: Vertex AI a veces retorna un array con un objeto dentro [{}]
      // en lugar de un objeto directo {}. Detectar y corregir esto.
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        this.logger.log(
          'Vertex AI retornó un array, extrayendo primer elemento',
        );
        parsedData = parsedData[0];
      }

      return parsedData;
    } catch (error) {
      this.logger.error('Error al procesar el texto con Vertex AI:', error);
      throw new Error(
        `Error en la comunicación con Vertex AI: ${error.message}`,
      );
    }
  }
}
