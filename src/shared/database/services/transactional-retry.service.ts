import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Servicio para ejecutar operaciones dentro de transacciones con reintentos seguros
 *
 * PROBLEMA RESUELTO:
 * Los reintentos a nivel de transacción pueden causar leaks de conexiones si el
 * QueryRunner no se libera correctamente. Este servicio garantiza:
 * 1. Un QueryRunner por intento (se libera después del rollback)
 * 2. Sin reintentos anidados (el decorator @Retry no se aplica aquí)
 * 3. Transacción completa reintentada como unidad atómica
 *
 * PATRÓN DE USO:
 * const result = await this.transactionalRetryService.executeWithRetry(
 *   async (queryRunner) => {
 *     // TODO: Toda la lógica dentro del queryRunner proporcionado
 *     const record = await queryRunner.manager.save(entity);
 *     return record;
 *   },
 *   3,    // maxAttempts
 *   2000, // delayMs
 * );
 */
@Injectable()
export class TransactionalRetryService {
  private readonly logger = new Logger(TransactionalRetryService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Ejecuta una operación dentro de una transacción con reintentos seguros
   *
   * @param operation Función que ejecuta la lógica dentro de queryRunner
   * @param maxAttempts Número máximo de intentos (default: 3)
   * @param delayMs Delay inicial en ms (default: 2000)
   * @returns Resultado de la operación
   * @throws Error si se agoten los reintentos
   *
   * @example
   * ```typescript
   * const result = await this.transactionalRetryService.executeWithRetry(
   *   async (queryRunner) => {
   *     const entity = queryRunner.manager.create(MyEntity, data);
   *     return await queryRunner.manager.save(entity);
   *   },
   *   3,
   *   2000,
   * );
   * ```
   */
  async executeWithRetry<T>(
    operation: (queryRunner: QueryRunner) => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 2000,
  ): Promise<T> {
    let lastError: any;
    let delay = delayMs;
    const requestId = Math.random().toString(36).substring(2, 9);

    // Errores que SIEMPRE deberían reintentarse a nivel de transacción
    const isRetryable = (error: any): boolean => {
      const retryableMessages = [
        // Network errors
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EHOSTUNREACH',
        'connect ENOENT',
        'Connection refused',
        'Connection reset',
        'Connection timeout',
        'Network is unreachable',
        'socket hang up',
        'EPIPE',
        'ENOTFOUND',
        // Database transient errors
        'too many connections',
        // Deadlock (puede recuperarse reintentando)
        'deadlock',
        'was aborted',
      ];

      // Errores que NUNCA deberían reintentarse
      const nonRetryableMessages = [
        'syntax error',
        'duplicate key',
        'permission denied',
        'does not exist',
        'invalid',
        'constraint violation',
        'not null violation',
      ];

      const errorStr = (error?.message || error?.code || '').toLowerCase();

      // Si contiene mensajes no recuperables, NO reintentar
      if (nonRetryableMessages.some((msg) => errorStr.includes(msg))) {
        return false;
      }

      // Si contiene mensajes recuperables, reintentar
      return retryableMessages.some((msg) => errorStr.includes(msg));
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();

      try {
        this.logger.debug(
          `[${requestId}] Transaction attempt ${attempt}/${maxAttempts}`,
        );

        // Conectar y comenzar transacción
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Ejecutar la operación del usuario dentro de la transacción
        const result = await operation(queryRunner);

        // Commit si fue exitoso
        await queryRunner.commitTransaction();
        this.logger.debug(
          `[${requestId}] Transaction committed on attempt ${attempt}`,
        );
        return result;
      } catch (error: any) {
        // Rollback si falló
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          this.logger.warn(
            `[${requestId}] Rollback failed on attempt ${attempt}: ${rollbackError.message}`,
          );
        }

        lastError = error;

        // Si no es error retryable, fallar inmediatamente
        if (!isRetryable(error)) {
          const errorMsg = error?.message || String(error);
          this.logger.error(
            `[${requestId}] Non-retryable error on attempt ${attempt}: ${errorMsg}`,
          );
          throw error;
        }

        // Si es el último intento, fallar
        if (attempt === maxAttempts) {
          const errorMsg = error?.message || String(error);
          this.logger.error(
            `[${requestId}] Transaction failed after ${maxAttempts} attempts: ${errorMsg}`,
          );
          throw error;
        }

        // Esperar antes de reintentar
        const errorCode = error?.code || error?.message;
        this.logger.warn(
          `[${requestId}] Transient error on attempt ${attempt} ` +
            `(${errorCode}), retrying transaction in ${delay}ms...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } finally {
        // CRÍTICO: Liberar conexión en cada intento
        try {
          await queryRunner.release();
        } catch (releaseError) {
          this.logger.warn(
            `[${requestId}] Failed to release queryRunner on attempt ${attempt}: ${releaseError.message}`,
          );
        }
      }
    }

    throw lastError;
  }
}
