import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OcrResponseDto } from '../dto/ocr-service.dto';
import { GoogleCloudClient, CloudStorageService } from '@/shared/libs/google-cloud';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly googleCloudClient: GoogleCloudClient,
    private readonly cloudStorageService: CloudStorageService,
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
    const config = this.googleCloudClient.getConfig();
    const bucketName = config?.voucherBucketName;

    if (!visionClient || !bucketName) {
      return this.simulateOcrResult(filename, language, startTime);
    }

    try {
      // 1. Subir archivo a GCS usando CloudStorageService
      const uploadResult = await this.cloudStorageService.upload(
        imageBuffer,
        filename,
        { generateUniqueName: true },
      );

      const gcsUri = uploadResult.gcsUri;
      const gcsFileName = uploadResult.fileName;
      const fileExtension = filename.split('.').pop() || 'bin';
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

          // Obtener archivos de resultados usando CloudStorageService
          const resultFiles = await this.cloudStorageService.getAllFiles({
            prefix: outputPrefix,
          });

          for (const resultFile of resultFiles) {
            resultFilesToDelete.push(resultFile.name);
            // Descargar y procesar cada archivo de resultado usando CloudStorageService
            const contents = await this.cloudStorageService.downloadFile(
              resultFile.name,
            );
            const resultJson = JSON.parse(contents.toString());
            for (const pageResponse of resultJson.responses) {
              allText += pageResponse.fullTextAnnotation?.text || '';
            }
          }
        } finally {
          // Eliminar archivos de resultado usando CloudStorageService
          if (resultFilesToDelete.length > 0) {
            await this.cloudStorageService.deleteMultipleFiles(
              resultFilesToDelete,
            );
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
    // Simula el nombre de archivo que se generaría
    const timestamp = this.formatTimestamp(new Date());
    const extension = filename.split('.').pop() || 'bin';
    const gcsFileName = `p-${timestamp}-simulated.${extension}`;

    return {
      structuredData: {
        monto: '123.45',
        fecha_pago: '2023-10-27',
        referencia: 'SIMULATED-REF-123',
        hora_transaccion: '14:30:00',
      },
      originalFilename: filename,
      gcsFilename: gcsFileName,
    };
  }
}
