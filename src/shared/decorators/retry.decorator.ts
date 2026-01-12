/**
 * Decorador para reintentar operaciones con backoff exponencial
 * Útil para operaciones que pueden fallar temporalmente (e.g., conexión a BD)
 *
 * Uso:
 * @Retry({ maxAttempts: 3, delayMs: 1000 })
 * async myMethod() { ... }
 */

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  retryableErrors: (error: any) => {
    // Reintentar solo para errores de conexión, no de validación
    const retryableMessages = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'connect ENOENT',
      'no pg_hba.conf entry',
      'too many connections',
      'database is locked',
      'Connection refused',
      'Connection reset',
      'Connection timeout',
      'Network is unreachable',
      'socket hang up',
      'EPIPE',
      'ENOTFOUND',
    ];

    const errorStr = error?.message || error?.code || '';
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

      for (let attempt = 1; attempt <= config.maxAttempts!; attempt++) {
        try {
          console.log(
            `[${target.constructor.name}.${propertyKey}] Intento ${attempt}/${config.maxAttempts}`,
          );
          return await originalMethod.apply(this, args);
        } catch (error: any) {
          lastError = error;

          // Si no es error retryable, falla inmediatamente
          if (!config.retryableErrors!(error)) {
            console.error(
              `[${target.constructor.name}.${propertyKey}] Error no recuperable:`,
              error.message,
            );
            throw error;
          }

          // Si es el último intento, fallar
          if (attempt === config.maxAttempts) {
            console.error(
              `[${target.constructor.name}.${propertyKey}] Fallo después de ${config.maxAttempts} intentos`,
            );
            throw error;
          }

          // Esperar con backoff exponencial
          console.warn(
            `[${target.constructor.name}.${propertyKey}] Error temporal (${error.code || error.message}), reintentando en ${delay}ms...`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= config.backoffMultiplier!;
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
