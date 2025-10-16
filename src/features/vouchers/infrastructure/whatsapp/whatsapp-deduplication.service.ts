import { Injectable } from '@nestjs/common';

/**
 * Servicio de Deduplicación de Mensajes de WhatsApp
 *
 * WhatsApp puede reintentar enviar mensajes si:
 * - No recibe respuesta en 20 segundos
 * - Recibe un error 5xx
 * - Hay problemas de red
 *
 * Este servicio mantiene un registro en memoria de mensajes ya procesados
 * para evitar procesarlos múltiples veces.
 */
@Injectable()
export class WhatsAppDeduplicationService {
  // Map de messageId -> timestamp de procesamiento
  private processedMessages = new Map<string, number>();

  // Tiempo de retención: 24 horas (en milisegundos)
  private readonly RETENTION_TIME_MS = 24 * 60 * 60 * 1000;

  // Intervalo de limpieza: cada hora
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

  constructor() {
    // Iniciar limpieza periódica de mensajes antiguos
    this.startCleanupInterval();
  }

  /**
   * Verifica si un mensaje ya fue procesado
   * @param messageId ID único del mensaje de WhatsApp
   * @returns true si ya fue procesado, false si es nuevo
   */
  isDuplicate(messageId: string): boolean {
    if (!messageId) {
      // Si no hay ID, no podemos deduplicar
      return false;
    }

    return this.processedMessages.has(messageId);
  }

  /**
   * Marca un mensaje como procesado
   * @param messageId ID único del mensaje de WhatsApp
   */
  markAsProcessed(messageId: string): void {
    if (!messageId) {
      return;
    }

    this.processedMessages.set(messageId, Date.now());
  }

  /**
   * Limpia mensajes antiguos de la cache
   */
  private cleanup(): void {
    const now = Date.now();
    const sizeBefore = this.processedMessages.size;
    let deletedCount = 0;

    for (const [messageId, timestamp] of this.processedMessages.entries()) {
      if (now - timestamp > this.RETENTION_TIME_MS) {
        this.processedMessages.delete(messageId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(
        `🧹 Limpieza de cache: ${deletedCount} mensajes eliminados (${sizeBefore} -> ${this.processedMessages.size})`,
      );
    }
  }

  /**
   * Inicia el intervalo de limpieza automática
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);

    console.log(
      '🔄 Servicio de deduplicación de WhatsApp iniciado (limpieza cada hora)',
    );
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats(): {
    totalProcessed: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    const timestamps = Array.from(this.processedMessages.values());

    return {
      totalProcessed: this.processedMessages.size,
      oldestTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }
}
