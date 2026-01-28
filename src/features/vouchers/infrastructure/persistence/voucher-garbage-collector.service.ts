import { Injectable, Logger } from '@nestjs/common';
import { CloudStorageService } from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

/**
 * Servicio para limpiar archivos huérfanos en GCS
 * Busca archivos que NO están referenciados en la BD y son más viejos que 2 horas
 *
 * IMPORTANTE: Este servicio se ejecuta en background después de cada upload exitoso
 * No bloquea la respuesta al usuario
 */
@Injectable()
export class VoucherGarbageCollectorService {
  private readonly logger = new Logger(VoucherGarbageCollectorService.name);

  // Configuración
  private readonly FILE_RETENTION_MS = 2 * 60 * 60 * 1000; // 2 horas (7,200,000 ms)
  private readonly FILE_PATTERN_PREFIX = 'p-'; // Prefix de archivos frontend

  // Métricas
  private lastCleanupAt: Date | null = null;
  private totalFilesCleaned: number = 0;

  constructor(
    private readonly cloudStorageService: CloudStorageService,
    private readonly voucherRepository: VoucherRepository,
  ) {}

  /**
   * Ejecuta la limpieza de archivos huérfanos
   * Llamado desde upload-voucher-frontend.use-case.ts de forma async
   *
   * Algoritmo:
   * 1. Listar archivos GCS con prefix 'p-'
   * 2. Para cada archivo, extraer timestamp del nombre
   * 3. Si archivo es más viejo que 2 horas Y no está referenciado en BD → agregar a lista de borrado
   * 4. Borrar archivos en batch
   * 5. Registrar métricas
   *
   * @returns Métricas de limpieza (archivos escaneados, eliminados, errores)
   */
  async cleanup(): Promise<CleanupMetrics> {
    try {
      // 1. Listar archivos con prefix 'p-'
      const allFiles = await this.cloudStorageService.getAllFiles({
        prefix: this.FILE_PATTERN_PREFIX,
      });

      // 2-3. Filtrar archivos huérfanos y viejos
      const orphanedFiles: string[] = [];

      for (const file of allFiles) {
        const fileDate = this.parseTimestampFromFilename(file.name);

        if (!fileDate || !this.isFileOldEnough(fileDate)) {
          continue;
        }

        const isReferenced = await this.voucherRepository.isFileReferenced(
          file.name,
        );

        if (!isReferenced) {
          orphanedFiles.push(file.name);
        }
      }

      // 4. Borrar archivos en batch
      let deletedCount = 0;
      let failedCount = 0;

      for (const filename of orphanedFiles) {
        try {
          await this.cloudStorageService.deleteFile(filename);
          deletedCount++;
        } catch (error) {
          this.logger.warn(`Failed to delete orphaned file: ${filename}`);
          failedCount++;
        }
      }

      // Actualizar métricas
      if (deletedCount > 0) {
        this.lastCleanupAt = new Date();
        this.totalFilesCleaned += deletedCount;
        this.logger.log(
          `Cleanup completed: ${deletedCount} files deleted${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        );
      }

      // 5. Retornar métricas
      return {
        filesScanned: allFiles.length,
        filesDeleted: deletedCount,
        filesFailed: failedCount,
        orphanedFilesDetected: orphanedFiles.length,
      };
    } catch (error) {
      this.logger.error('Cleanup error', error.message);
      throw error;
    }
  }

  /**
   * Extrae timestamp del nombre del archivo
   * Pattern esperado: p-YYYY-MM-DD_HH-MM-SS-UUID.ext
   * Ejemplo: p-2024-01-15_14-30-45-abc123def.jpg
   *
   * @param filename Nombre del archivo
   * @returns Date si puede parsear, null si no
   */
  private parseTimestampFromFilename(filename: string): Date | null {
    const regex = /^p-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})-/;
    const match = filename.match(regex);

    if (!match) {
      return null;
    }

    try {
      const [_, year, month, day, hour, minute, second] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1, // Mes es 0-indexed en JavaScript
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
      );
    } catch {
      return null;
    }
  }

  /**
   * Verifica si un archivo es lo suficientemente viejo para ser eliminado
   * Threshold: 2 horas
   *
   * @param fileDate Fecha del archivo
   * @returns true si archivo es más viejo que 2 horas
   */
  private isFileOldEnough(fileDate: Date): boolean {
    const now = Date.now();
    const fileTime = fileDate.getTime();
    const ageMs = now - fileTime;

    return ageMs > this.FILE_RETENTION_MS;
  }

  /**
   * Retorna estadísticas del servicio
   */
  getStats(): CleanupStats {
    const nextCleanupEstimate = this.lastCleanupAt
      ? new Date(this.lastCleanupAt.getTime() + 2 * 60 * 60 * 1000) // 2 horas desde último cleanup
      : null;

    return {
      lastCleanupAt: this.lastCleanupAt,
      totalFilesCleaned: this.totalFilesCleaned,
      nextCleanupEstimate,
    };
  }
}

/**
 * Métricas retornadas por cleanup()
 */
export interface CleanupMetrics {
  filesScanned: number; // Total de archivos con prefix 'p-' en GCS
  filesDeleted: number; // Archivos eliminados exitosamente
  filesFailed: number; // Archivos que fallaron al eliminar
  orphanedFilesDetected: number; // Total de archivos huérfanos encontrados
}

/**
 * Estadísticas del servicio
 */
export interface CleanupStats {
  lastCleanupAt: Date | null; // Timestamp del último cleanup
  totalFilesCleaned: number; // Total acumulativo de archivos limpios
  nextCleanupEstimate: Date | null; // Aproximación de próximo cleanup basado en último
}
