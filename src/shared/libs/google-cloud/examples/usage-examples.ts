import { Injectable } from '@nestjs/common';
import { GoogleCloudClient } from '../google-cloud.client';

/**
 * Ejemplos de uso de la librería de Google Cloud
 * Estos son ejemplos de cómo usar los diferentes servicios
 */
@Injectable()
export class GoogleCloudUsageExamples {
  constructor(private readonly googleCloudClient: GoogleCloudClient) {}

  /**
   * Ejemplo: Extraer texto de una imagen usando Vision API
   */
  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    const visionClient = this.googleCloudClient.getVisionClient();
    if (!visionClient) {
      throw new Error('Vision API no está disponible');
    }

    try {
      const [result] = await visionClient.annotateImage({
        image: { content: imageBuffer.toString('base64') },
        features: [{ type: 'TEXT_DETECTION' }],
      });

      const textAnnotations = result.textAnnotations;
      if (!textAnnotations || textAnnotations.length === 0) {
        return 'No se detectó texto en la imagen';
      }

      return (textAnnotations[0] as any).text || '';
    } catch (error) {
      throw new Error(`Error al procesar imagen: ${error.message}`);
    }
  }

  /**
   * Ejemplo: Subir archivo a Cloud Storage
   */
  async uploadFileToStorage(
    bucketName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<string> {
    const storageClient = this.googleCloudClient.getStorageClient();
    if (!storageClient) {
      throw new Error('Cloud Storage no está disponible');
    }

    try {
      const bucket = storageClient.bucket(bucketName);
      const file = bucket.file(fileName);

      await file.save(fileBuffer, {
        metadata: {
          contentType: 'application/octet-stream',
        },
      });

      return `gs://${bucketName}/${fileName}`;
    } catch (error) {
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
  }

  /**
   * Ejemplo: Traducir texto usando Cloud Translate
   */
  async translateText(text: string, targetLanguage: string): Promise<string> {
    const translateClient = this.googleCloudClient.getTranslateClient();
    if (!translateClient) {
      throw new Error('Cloud Translate no está disponible');
    }

    try {
      const [translation] = await translateClient.translate(
        text,
        targetLanguage,
      );
      return translation;
    } catch (error) {
      throw new Error(`Error al traducir texto: ${error.message}`);
    }
  }

  /**
   * Ejemplo: Convertir texto a audio usando Text-to-Speech
   */
  async textToSpeech(
    text: string,
    languageCode: string = 'es-ES',
  ): Promise<Buffer> {
    const textToSpeechClient = this.googleCloudClient.getTextToSpeechClient();
    if (!textToSpeechClient) {
      throw new Error('Text-to-Speech no está disponible');
    }

    try {
      const request = {
        input: { text },
        voice: { languageCode, ssmlGender: 'NEUTRAL' as const },
        audioConfig: { audioEncoding: 'MP3' as const },
      };

      const [response] = await textToSpeechClient.synthesizeSpeech(request);
      return Buffer.from(response.audioContent || '');
    } catch (error) {
      throw new Error(`Error al convertir texto a audio: ${error.message}`);
    }
  }

  /**
   * Ejemplo: Convertir audio a texto usando Speech-to-Text
   */
  async speechToText(
    audioBuffer: Buffer,
    languageCode: string = 'es-ES',
  ): Promise<string> {
    const speechClient = this.googleCloudClient.getSpeechClient();
    if (!speechClient) {
      throw new Error('Speech-to-Text no está disponible');
    }

    try {
      const request = {
        audio: { content: audioBuffer.toString('base64') },
        config: {
          encoding: 'MP3' as const,
          sampleRateHertz: 16000,
          languageCode,
        },
      };

      const [response] = await speechClient.recognize(request);
      const transcription = response.results
        ?.map((result) => result.alternatives?.[0]?.transcript)
        .join(' ');

      return transcription || '';
    } catch (error) {
      throw new Error(`Error al convertir audio a texto: ${error.message}`);
    }
  }

  /**
   * Ejemplo: Análisis completo de imagen usando Vision API
   */
  async analyzeImage(imageBuffer: Buffer) {
    const visionClient = this.googleCloudClient.getVisionClient();
    if (!visionClient) {
      throw new Error('Vision API no está disponible');
    }

    try {
      const [result] = await visionClient.annotateImage({
        image: { content: imageBuffer.toString('base64') },
        features: [
          { type: 'TEXT_DETECTION' },
          { type: 'LABEL_DETECTION' },
          { type: 'FACE_DETECTION' },
          { type: 'OBJECT_LOCALIZATION' },
        ],
      });

      return {
        text: (result.textAnnotations?.[0] as any)?.text || '',
        labels:
          result.labelAnnotations?.map((label) => ({
            description: label.description,
            confidence: label.confidence,
          })) || [],
        faces: result.faceAnnotations?.length || 0,
        objects:
          result.localizedObjectAnnotations?.map((obj) => ({
            name: obj.name,
            confidence: obj.score,
          })) || [],
      };
    } catch (error) {
      throw new Error(`Error al analizar imagen: ${error.message}`);
    }
  }

  /**
   * Ejemplo: Verificar estado de los servicios
   */
  getServicesStatus() {
    return {
      isReady: this.googleCloudClient.isReady(),
      vision: !!this.googleCloudClient.getVisionClient(),
      storage: !!this.googleCloudClient.getStorageClient(),
      translate: !!this.googleCloudClient.getTranslateClient(),
      textToSpeech: !!this.googleCloudClient.getTextToSpeechClient(),
      speech: !!this.googleCloudClient.getSpeechClient(),
    };
  }
}
