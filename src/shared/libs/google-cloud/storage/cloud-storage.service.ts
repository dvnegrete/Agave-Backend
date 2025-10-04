import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Storage, File, Bucket } from '@google-cloud/storage';
import { GoogleCloudClient } from '../google-cloud.client';
import { v4 as uuidv4 } from 'uuid';

export interface UploadFileOptions {
  /**
   * Nombre del bucket donde se subirá el archivo
   * Por defecto usa el bucket de vouchers configurado
   */
  bucketName?: string;

  /**
   * Prefijo para el nombre del archivo (ej: "vouchers/", "documents/")
   */
  prefix?: string;

  /**
   * Nombre personalizado del archivo
   * Si no se especifica, se genera uno automático con UUID
   */
  fileName?: string;

  /**
   * Si es true, genera un nombre único automáticamente
   * Si es false, usa el fileName tal cual (puede sobrescribir archivos existentes)
   */
  generateUniqueName?: boolean;

  /**
   * Metadatos adicionales para el archivo
   */
  metadata?: Record<string, string>;

  /**
   * Content-Type del archivo (MIME type)
   */
  contentType?: string;
}

export interface UploadFileResult {
  /**
   * Nombre del archivo en GCS
   */
  fileName: string;

  /**
   * URI completa del archivo (gs://bucket/path/file)
   */
  gcsUri: string;

  /**
   * URL pública del archivo (si el bucket es público)
   */
  publicUrl?: string;

  /**
   * Bucket donde se subió el archivo
   */
  bucketName: string;
}

export interface CloudStorageFile {
  name: string;
  size: number;
  contentType: string;
  created: Date;
  updated: Date;
  bucket: string;
  gcsUri: string;
  publicUrl?: string;
}

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);

  constructor(private readonly googleCloudClient: GoogleCloudClient) {}

  /**
   * Obtiene el cliente de Storage
   */
  private getStorageClient(): Storage {
    const storageClient = this.googleCloudClient.getStorageClient();
    if (!storageClient) {
      throw new BadRequestException(
        'Google Cloud Storage no está configurado correctamente',
      );
    }
    return storageClient;
  }

  /**
   * Obtiene el nombre del bucket por defecto
   */
  private getDefaultBucketName(): string {
    const config = this.googleCloudClient.getConfig();
    const bucketName = config?.voucherBucketName;
    if (!bucketName) {
      throw new BadRequestException(
        'No se ha configurado un bucket por defecto para Cloud Storage',
      );
    }
    return bucketName;
  }

  /**
   * Genera un nombre de archivo único con timestamp y UUID
   */
  private generateUniqueFileName(originalFileName: string): string {
    const timestamp = this.formatTimestamp(new Date());
    const extension = originalFileName.split('.').pop() || 'bin';
    const uuid = uuidv4();
    return `p-${timestamp}-${uuid}.${extension}`;
  }

  /**
   * Formatea una fecha como timestamp para nombres de archivo
   */
  private formatTimestamp(date: Date): string {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  }

  /**
   * Sube un archivo a Google Cloud Storage
   *
   * @param buffer - Buffer del archivo a subir
   * @param originalFileName - Nombre original del archivo
   * @param options - Opciones de configuración para la subida
   * @returns Información del archivo subido
   *
   * @example
   * ```typescript
   * const result = await cloudStorageService.upload(
   *   fileBuffer,
   *   'comprobante.jpg',
   *   { prefix: 'vouchers/', generateUniqueName: true }
   * );
   * console.log(result.gcsUri); // gs://bucket/vouchers/p-2024-10-03_14-30-00-uuid.jpg
   * ```
   */
  async upload(
    buffer: Buffer,
    originalFileName: string,
    options: UploadFileOptions = {},
  ): Promise<UploadFileResult> {
    try {
      const storageClient = this.getStorageClient();
      const bucketName = options.bucketName || this.getDefaultBucketName();

      // Generar nombre del archivo
      let fileName: string;
      if (options.fileName && !options.generateUniqueName) {
        fileName = options.fileName;
      } else if (options.generateUniqueName !== false) {
        // Por defecto genera nombre único
        fileName = this.generateUniqueFileName(originalFileName);
      } else {
        fileName = originalFileName;
      }

      // Agregar prefijo si existe
      if (options.prefix) {
        fileName = `${options.prefix}${fileName}`;
      }

      const file = storageClient.bucket(bucketName).file(fileName);

      // Preparar opciones de subida
      const uploadOptions: any = {
        resumable: false,
        metadata: {
          contentType: options.contentType,
          metadata: options.metadata || {},
        },
      };

      // Subir archivo
      await file.save(buffer, uploadOptions);

      const gcsUri = `gs://${bucketName}/${fileName}`;

      this.logger.log(`Archivo subido exitosamente: ${gcsUri}`);

      return {
        fileName,
        gcsUri,
        bucketName,
        publicUrl: `https://storage.googleapis.com/${bucketName}/${fileName}`,
      };
    } catch (error) {
      this.logger.error(`Error al subir archivo a GCS: ${error.message}`, error);
      throw new BadRequestException(
        `Error al subir archivo a Cloud Storage: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene todos los archivos de un bucket o con un prefijo específico
   *
   * @param options - Opciones de filtrado
   * @returns Lista de archivos encontrados
   *
   * @example
   * ```typescript
   * // Obtener todos los archivos del bucket por defecto
   * const files = await cloudStorageService.getAllFiles();
   *
   * // Obtener archivos con prefijo específico
   * const voucherFiles = await cloudStorageService.getAllFiles({
   *   prefix: 'vouchers/'
   * });
   * ```
   */
  async getAllFiles(options: {
    bucketName?: string;
    prefix?: string;
    maxResults?: number;
  } = {}): Promise<CloudStorageFile[]> {
    try {
      const storageClient = this.getStorageClient();
      const bucketName = options.bucketName || this.getDefaultBucketName();

      const [files] = await storageClient.bucket(bucketName).getFiles({
        prefix: options.prefix,
        maxResults: options.maxResults,
      });

      return files.map((file) => this.mapFileToCloudStorageFile(file, bucketName));
    } catch (error) {
      this.logger.error(`Error al obtener archivos de GCS: ${error.message}`, error);
      throw new BadRequestException(
        `Error al obtener archivos de Cloud Storage: ${error.message}`,
      );
    }
  }

  /**
   * Elimina un archivo de Google Cloud Storage
   *
   * @param fileName - Nombre del archivo a eliminar
   * @param bucketName - Nombre del bucket (opcional, usa el default si no se especifica)
   *
   * @example
   * ```typescript
   * await cloudStorageService.deleteFile('vouchers/p-2024-10-03_14-30-00-uuid.jpg');
   * ```
   */
  async deleteFile(fileName: string, bucketName?: string): Promise<void> {
    try {
      const storageClient = this.getStorageClient();
      const bucket = bucketName || this.getDefaultBucketName();

      await storageClient.bucket(bucket).file(fileName).delete();

      this.logger.log(`Archivo eliminado exitosamente: gs://${bucket}/${fileName}`);
    } catch (error) {
      this.logger.error(`Error al eliminar archivo de GCS: ${error.message}`, error);
      throw new BadRequestException(
        `Error al eliminar archivo de Cloud Storage: ${error.message}`,
      );
    }
  }

  /**
   * Elimina múltiples archivos en paralelo
   *
   * @param fileNames - Array de nombres de archivos a eliminar
   * @param bucketName - Nombre del bucket (opcional)
   *
   * @example
   * ```typescript
   * await cloudStorageService.deleteMultipleFiles([
   *   'ocr-results/file1.json',
   *   'ocr-results/file2.json'
   * ]);
   * ```
   */
  async deleteMultipleFiles(
    fileNames: string[],
    bucketName?: string,
  ): Promise<void> {
    try {
      const storageClient = this.getStorageClient();
      const bucket = bucketName || this.getDefaultBucketName();

      await Promise.all(
        fileNames.map((fileName) =>
          storageClient
            .bucket(bucket)
            .file(fileName)
            .delete()
            .catch((err) =>
              this.logger.error(
                `Error al eliminar archivo ${fileName}: ${err.message}`,
              ),
            ),
        ),
      );

      this.logger.log(`${fileNames.length} archivos eliminados exitosamente`);
    } catch (error) {
      this.logger.error(`Error al eliminar archivos de GCS: ${error.message}`, error);
      throw new BadRequestException(
        `Error al eliminar archivos de Cloud Storage: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si un archivo existe en Cloud Storage
   *
   * @param fileName - Nombre del archivo
   * @param bucketName - Nombre del bucket (opcional)
   * @returns true si el archivo existe, false en caso contrario
   */
  async fileExists(fileName: string, bucketName?: string): Promise<boolean> {
    try {
      const storageClient = this.getStorageClient();
      const bucket = bucketName || this.getDefaultBucketName();

      const [exists] = await storageClient
        .bucket(bucket)
        .file(fileName)
        .exists();

      return exists;
    } catch (error) {
      this.logger.error(`Error al verificar existencia de archivo: ${error.message}`);
      return false;
    }
  }

  /**
   * Descarga el contenido de un archivo desde Cloud Storage
   *
   * @param fileName - Nombre del archivo a descargar
   * @param bucketName - Nombre del bucket (opcional)
   * @returns Buffer con el contenido del archivo
   *
   * @example
   * ```typescript
   * const fileContent = await cloudStorageService.downloadFile('vouchers/file.json');
   * const jsonData = JSON.parse(fileContent.toString());
   * ```
   */
  async downloadFile(fileName: string, bucketName?: string): Promise<Buffer> {
    try {
      const storageClient = this.getStorageClient();
      const bucket = bucketName || this.getDefaultBucketName();

      const [contents] = await storageClient
        .bucket(bucket)
        .file(fileName)
        .download();

      this.logger.log(`Archivo descargado exitosamente: ${fileName}`);
      return contents;
    } catch (error) {
      this.logger.error(`Error al descargar archivo de GCS: ${error.message}`, error);
      throw new BadRequestException(
        `Error al descargar archivo de Cloud Storage: ${error.message}`,
      );
    }
  }

  /**
   * Genera una URL firmada para acceso temporal a un archivo privado
   *
   * @param fileName - Nombre del archivo
   * @param options - Opciones de configuración
   * @returns URL firmada con acceso temporal
   *
   * @example
   * ```typescript
   * // URL válida por 1 hora
   * const signedUrl = await cloudStorageService.getSignedUrl('vouchers/file.jpg', {
   *   expiresInMinutes: 60
   * });
   * ```
   */
  async getSignedUrl(
    fileName: string,
    options: {
      bucketName?: string;
      expiresInMinutes?: number;
      action?: 'read' | 'write' | 'delete';
    } = {},
  ): Promise<string> {
    try {
      const storageClient = this.getStorageClient();
      const bucket = options.bucketName || this.getDefaultBucketName();
      const expiresInMinutes = options.expiresInMinutes || 60; // Default: 1 hora
      const action = options.action || 'read';

      const file = storageClient.bucket(bucket).file(fileName);

      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action,
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      this.logger.log(
        `URL firmada generada para ${fileName} (válida por ${expiresInMinutes} minutos)`,
      );

      return signedUrl;
    } catch (error) {
      this.logger.error(
        `Error al generar URL firmada: ${error.message}`,
        error,
      );
      throw new BadRequestException(
        `Error al generar URL de acceso: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene la URL pública de un archivo
   *
   * @param fileName - Nombre del archivo
   * @param bucketName - Nombre del bucket (opcional)
   * @returns URL pública del archivo
   */
  getPublicUrl(fileName: string, bucketName?: string): string {
    const bucket = bucketName || this.getDefaultBucketName();
    return `https://storage.googleapis.com/${bucket}/${fileName}`;
  }

  /**
   * Obtiene la URI de GCS de un archivo
   *
   * @param fileName - Nombre del archivo
   * @param bucketName - Nombre del bucket (opcional)
   * @returns URI de GCS (gs://bucket/file)
   */
  getGcsUri(fileName: string, bucketName?: string): string {
    const bucket = bucketName || this.getDefaultBucketName();
    return `gs://${bucket}/${fileName}`;
  }

  /**
   * Mapea un objeto File de GCS a CloudStorageFile
   */
  private mapFileToCloudStorageFile(
    file: File,
    bucketName: string,
  ): CloudStorageFile {
    const size = file.metadata.size;
    const sizeNumber = typeof size === 'string' ? parseInt(size) : (size || 0);

    return {
      name: file.name,
      size: sizeNumber,
      contentType: file.metadata.contentType || 'application/octet-stream',
      created: new Date(file.metadata.timeCreated || Date.now()),
      updated: new Date(file.metadata.updated || Date.now()),
      bucket: bucketName,
      gcsUri: `gs://${bucketName}/${file.name}`,
      publicUrl: `https://storage.googleapis.com/${bucketName}/${file.name}`,
    };
  }
}
