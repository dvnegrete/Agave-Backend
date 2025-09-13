import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OcrResponseDto } from '../dto/ocr-service.dto';
import { GoogleCloudClient } from '@/shared/libs/google-cloud';
import { v4 as uuidv4 } from 'uuid';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly googleCloudClient: GoogleCloudClient,
    private readonly openAIService: OpenAIService,
    private readonly vertexAIService: VertexAIService,
  ) {}

  private formatTimestamp(date: Date): string {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  }

  async extractTextFromImage(
    imageBuffer: Buffer,
    filename: string,
    language?: string,
  ): Promise<OcrResponseDto> {
    const startTime = Date.now();

    const visionClient = this.googleCloudClient.getVisionClient();
    const storageClient = this.googleCloudClient.getStorageClient();
    const config = this.googleCloudClient.getConfig();
    const bucketName = config?.voucherBucketName;

    if (!visionClient || !storageClient || !bucketName) {
      return this.simulateOcrResult(filename, language, startTime);
    }

    // 1. Subir archivo a GCS (común para todos los tipos)
    const fileExtension = filename.split('.').pop() || 'bin';
    const gcsFileName = `p-${this.formatTimestamp(new Date())}-${uuidv4()}.${fileExtension}`;
    const file = storageClient.bucket(bucketName).file(gcsFileName);

    try {
      await file.save(imageBuffer, { resumable: false });

      const gcsUri = `gs://${bucketName}/${gcsFileName}`;
      const mimeType = this.getMimeType(fileExtension);
      const isAsyncSupported = [
        'application/pdf',
        'image/gif',
        'image/tiff',
      ].includes(mimeType);

      let allText = '';

      if (isAsyncSupported) {
        // RUTA ASÍNCRONA para PDF, GIF, TIFF

        const outputPrefix = `ocr-results/${gcsFileName}`;
        const gcsDestinationUri = `gs://${bucketName}/${outputPrefix}/`;

        const request = {
          requests: [
            {
              inputConfig: { gcsSource: { uri: gcsUri }, mimeType },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const }],
              imageContext: language
                ? { languageHints: [language] }
                : undefined,
              outputConfig: {
                gcsDestination: { uri: gcsDestinationUri },
                batchSize: 100,
              },
            },
          ],
        };

        const resultFilesToDelete: string[] = [];
        try {
          const [operation] = await visionClient.asyncBatchAnnotateFiles(
            request as any,
          );
          await operation.promise();

          const [resultFiles] = await storageClient
            .bucket(bucketName)
            .getFiles({ prefix: outputPrefix });
          for (const resultFile of resultFiles) {
            resultFilesToDelete.push(resultFile.name);
            const [contents] = await resultFile.download();
            const resultJson = JSON.parse(contents.toString());
            for (const pageResponse of resultJson.responses) {
              allText += pageResponse.fullTextAnnotation?.text || '';
            }
          }
        } finally {
          if (resultFilesToDelete.length > 0) {
            for (const fileName of resultFilesToDelete) {
              await storageClient
                .bucket(bucketName)
                .file(fileName)
                .delete()
                .catch((err) =>
                  this.logger.error(
                    `Error al eliminar el archivo de resultado ${fileName}: ${err.message}`,
                  ),
                );
            }
          }
        }
      } else {
        // RUTA SÍNCRONA para JPG, PNG, etc.

        const request = {
          image: { source: { imageUri: gcsUri } },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const }],
          imageContext: language ? { languageHints: [language] } : undefined,
        };

        const [result] = await visionClient.annotateImage(request);
        allText = result.fullTextAnnotation?.text || '';
      }

      // const structuredData = await this.openAIService.processTextWithPrompt(allText);
      const structuredData =
        await this.vertexAIService.processTextWithPrompt(allText);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Procesamiento de archivo (Vision + VertexAI) completado en ${processingTime}ms para: ${filename}`,
      );

      return {
        structuredData,
        originalFilename: filename,
        gcsFilename: gcsFileName,
      };
    } catch (error) {
      this.logger.error(`Error en el flujo de OCR para ${filename}:`, error);
      // El archivo subido es permanente y no debe eliminarse en caso de error.
      throw new BadRequestException(
        `Error al procesar el archivo: ${error.message}`,
      );
    }
  }

  private getMimeType(extension: string): string {
    switch (extension.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      case 'webp':
        return 'image/webp';
      case 'tiff':
        return 'image/tiff';
      default:
        return 'application/octet-stream';
    }
  }

  async validateImageFormat(buffer: Buffer, filename: string): Promise<void> {
    const validHeaders = [
      Buffer.from([0xff, 0xd8, 0xff]), // JPEG
      Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
      Buffer.from([0x47, 0x49, 0x46]), // GIF
      Buffer.from([0x42, 0x4d]), // BMP
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // WEBP
      Buffer.from([0x49, 0x49, 0x2a, 0x00]), // TIFF (little endian)
      Buffer.from([0x4d, 0x4d, 0x00, 0x2a]), // TIFF (big endian)
      Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF
    ];

    const isValid = validHeaders.some((header) =>
      buffer.subarray(0, header.length).equals(header),
    );

    if (!isValid) {
      throw new BadRequestException(
        `Formato de archivo no válido para: ${filename}. Formatos soportados: JPEG, PNG, GIF, BMP, WEBP, TIFF, PDF`,
      );
    }
  }

  private simulateOcrResult(
    filename: string,
    language?: string,
    startTime?: number,
  ): OcrResponseDto {
    const gcsFileName = `p-${this.formatTimestamp(new Date())}-${uuidv4()}.${filename.split('.').pop()}`;
    return {
      structuredData: {
        monto: '123.45',
        fecha_pago: '2023-10-27',
        referencia: 'SIMULATED-REF-123',
        banco: 'Banco Simulado',
        emisor: 'Emisor Simulado',
        faltan_datos: false,
      },
      originalFilename: filename,
      gcsFilename: gcsFileName,
    };
  }
}
