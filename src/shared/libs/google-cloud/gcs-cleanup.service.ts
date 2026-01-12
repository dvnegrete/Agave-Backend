import { Injectable, Logger } from '@nestjs/common';
import { CloudStorageService } from './storage/cloud-storage.service';

export interface GcsCleanupOptions {
  /**
   * Razón por la cual se está eliminando el archivo (para logging)
   * Ejemplos: 'error-en-ocr', 'duplicado-detectado', 'validacion-fallida'
   */
  reason?: string;

  /**
   * Si es true, lanza excepción si la eliminación falla
   * Si es false, solo loguea el error (default)
   */
  blocking?: boolean;

  /**
   * Tipo de archivo siendo eliminado para mejor contexto
   * 'temporal': Archivo subido para procesamiento (se borra si hay error/duplicado)
   * 'permanente': Archivo registrado en BD (normalmente no se borra)
   */
  fileType?: 'temporal' | 'permanente';
}

/**
 * Servicio centralizado para limpieza de archivos en Google Cloud Storage
 * Proporciona métodos consistentes para eliminar archivos con manejo de errores
 *
 * IMPORTANTE - Tipos de archivos:
 * - TEMPORAL: Subidos durante procesamiento OCR, se eliminan si hay error/duplicado
 * - PERMANENTE: Registrados en BD (voucher.url), nunca se borran automáticamente
 */
@Injectable()
export class GcsCleanupService {
  private readonly logger = new Logger(GcsCleanupService.name);

  constructor(private readonly cloudStorageService: CloudStorageService) {}

  /**
   * Elimina un archivo de Google Cloud Storage de forma segura (non-blocking)
   * Si la eliminación falla, solo loguea el error sin lanzar excepción
   *
   * @param filename - Nombre del archivo a eliminar
   * @param options - Opciones de limpieza (razón, tipo de archivo, etc)
   * @returns true si se eliminó exitosamente, false si falló
   */
  async deleteFile(
    filename: string,
    options: GcsCleanupOptions = {},
  ): Promise<boolean> {
    const {
      reason = 'sin-especificar',
      blocking = false,
      fileType = 'temporal',
    } = options;

    try {
      this.logger.log(
        `Eliminando archivo ${fileType} de GCS por: ${reason}`,
      );
      this.logger.debug(`Archivo: ${filename}`);

      await this.cloudStorageService.deleteFile(filename);

      this.logger.log(
        `✅ Archivo ${fileType} eliminado exitosamente: ${filename}`,
      );
      return true;
    } catch (error) {
      const errorMessage = `⚠️ No se pudo eliminar archivo ${fileType} del bucket (${reason}): ${error.message}`;

      if (blocking) {
        // En modo blocking, lanzar excepción
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      } else {
        // En modo non-blocking (default), solo loguear warning
        this.logger.warn(errorMessage);
        return false;
      }
    }
  }

  /**
   * Elimina múltiples archivos de forma paralela
   *
   * @param filenames - Array de nombres de archivos a eliminar
   * @param options - Opciones de limpieza
   * @returns Objeto con resultados: { successful: filenames[], failed: filenames[] }
   */
  async deleteMultipleFiles(
    filenames: string[],
    options: GcsCleanupOptions = {},
  ): Promise<{ successful: string[]; failed: string[] }> {
    if (!filenames || filenames.length === 0) {
      return { successful: [], failed: [] };
    }

    this.logger.log(`Eliminando ${filenames.length} archivos de GCS...`);

    const results = await Promise.allSettled(
      filenames.map((filename) => this.deleteFile(filename, options)),
    );

    const successful: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successful.push(filenames[index]);
      } else {
        failed.push(filenames[index]);
      }
    });

    this.logger.log(
      `✅ Eliminación completada: ${successful.length} exitosos, ${failed.length} fallidos`,
    );

    return { successful, failed };
  }

  /**
   * Elimina un archivo temporal subido durante procesamiento OCR
   * Estos archivos se eliminan si hay error durante el procesamiento
   * o si se detecta un duplicado
   *
   * @param filename - Nombre del archivo temporal
   * @param reason - Razón de la eliminación
   * @returns true si se eliminó exitosamente
   */
  async deleteTemporaryProcessingFile(
    filename: string,
    reason: string = 'procesamiento-fallido',
  ): Promise<boolean> {
    return this.deleteFile(filename, {
      reason,
      fileType: 'temporal',
      blocking: false,
    });
  }

  /**
   * Método documentado para énfasis: Archivos permanentes NUNCA se eliminan automáticamente
   * Estos son archivos registrados en BD (voucher.url)
   * Solo un administrador o el usuario puede eliminarlos manualmente
   *
   * @param filename - Nombre del archivo permanente
   * @deprecated Use deleteFile() instead with fileType: 'permanente' if needed
   */
  async deletePermanentFile(filename: string): Promise<void> {
    this.logger.warn(
      `⚠️ ADVERTENCIA: Intento de eliminar archivo permanente. Esto no debería suceder automáticamente.`,
    );
    this.logger.warn(
      `⚠️ Archivo: ${filename} - Contacta a un administrador si esto fue intencional`,
    );
    // No se ejecuta la eliminación automáticamente
  }
}
