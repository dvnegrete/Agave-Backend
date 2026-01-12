/**
 * Decorador para reintentar operaciones con backoff exponencial
 * Útil para operaciones que pueden fallar temporalmente (e.g., conexión a BD)
 *
 * IMPORTANTE: Solo aplicar en capa de repositorio
 * NO aplicar en servicios que llaman a repositorios (causa cascadas de reintentos)
 *
 * Uso:
 * @Retry({ maxAttempts: 3, delayMs: 1000 })
 * async myMethod() { ... }
 */

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  retryableErrors: (error: unknown) => {
    // Reintentar SOLO errores transitorios de conexión/red
    // NO reintentar errores de configuración o permanentes
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
    ];

    // Errores que NUNCA debería reintentar
    const nonRetryableMessages = [
      'no pg_hba.conf entry',  // Config error
      'syntax error',            // SQL error
      'duplicate key',           // Constraint violation
      'permission denied',       // Auth error
      'does not exist',         // Schema error
    ];

    const errorStr = ((error as any)?.message || (error as any)?.code || '').toLowerCase();

    // Si contiene mensajes no recuperables, NO reintentar
    if (nonRetryableMessages.some(msg => errorStr.includes(msg))) {
      return false;
    }

    // Si contiene mensajes recuperables, reintentar
    return retryableMessages.some(msg => errorStr.includes(msg));
  },
};

export function Retry(options: RetryOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;
      let delay = config.delayMs!;

      // Generar ID único para rastrear reintentos de la misma llamada
      const requestId = Math.random().toString(36).substring(2, 9);
      const methodName = `${target.constructor.name}.${propertyKey}`;

      for (let attempt = 1; attempt <= config.maxAttempts!; attempt++) {
        try {
          // Log de intento
          if (this.logger?.debug) {
            this.logger.debug(
              `[${requestId}] ${methodName} - Attempt ${attempt}/${config.maxAttempts}`,
            );
          } else {
            console.debug(
              `[${requestId}] ${methodName} - Attempt ${attempt}/${config.maxAttempts}`,
            );
          }

          return await originalMethod.apply(this, args);
        } catch (error: unknown) {
          lastError = error;

          // Si no es error retryable, fallar inmediatamente
          if (!config.retryableErrors!(error)) {
            const errorMsg = (error as any)?.message || String(error);
            if (this.logger?.error) {
              this.logger.error(
                `[${requestId}] ${methodName} - Non-retryable error on attempt ${attempt}: ${errorMsg}`,
              );
            } else {
              console.error(
                `[${requestId}] ${methodName} - Non-retryable error on attempt ${attempt}: ${errorMsg}`,
              );
            }
            throw error;
          }

          // Si es el último intento, fallar
          if (attempt === config.maxAttempts) {
            const errorMsg = (error as any)?.message || String(error);
            if (this.logger?.error) {
              this.logger.error(
                `[${requestId}] ${methodName} - Failed after ${config.maxAttempts} attempts: ${errorMsg}`,
              );
            } else {
              console.error(
                `[${requestId}] ${methodName} - Failed after ${config.maxAttempts} attempts: ${errorMsg}`,
              );
            }
            throw error;
          }

          // Log de reintento
          const errorCode = (error as any)?.code || (error as any)?.message;
          if (this.logger?.warn) {
            this.logger.warn(
              `[${requestId}] ${methodName} - Transient error on attempt ${attempt} ` +
              `(${errorCode}), retrying in ${delay}ms...`,
            );
          } else {
            console.warn(
              `[${requestId}] ${methodName} - Transient error on attempt ${attempt} ` +
              `(${errorCode}), retrying in ${delay}ms...`,
            );
          }

          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= config.backoffMultiplier!;
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
