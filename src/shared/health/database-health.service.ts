import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Servicio para verificar la salud de la conexión a la Base de Datos
 * Proporciona métodos para validar conectividad y esperar a que la BD esté disponible
 */
@Injectable()
export class DatabaseHealthService {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Verifica si la BD está disponible ejecutando una query simple
   * @returns true si la conexión es exitosa, false si no
   */
  async isHealthy(): Promise<boolean> {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query('SELECT 1');
      await queryRunner.release();
      return true;
    } catch (error: any) {
      this.logger.error(`Health check fallido: ${error.message}`);
      return false;
    }
  }

  /**
   * Espera a que la BD esté disponible con reintentos y backoff exponencial
   * Útil durante el bootstrap de la aplicación
   *
   * @param maxAttempts - Número máximo de intentos (por defecto 30)
   * @param delayMs - Delay inicial en milisegundos (se duplica en cada intento)
   * @throws Error si la BD no se conecta después de maxAttempts intentos
   */
  async waitForDatabase(
    maxAttempts: number = 5,
    delayMs: number = 2000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(
          `Verificando BD (intento ${attempt}/${maxAttempts})...`,
        );
        if (await this.isHealthy()) {
          this.logger.log('Base de datos disponible');
          return;
        }
      } catch (error: any) {
        this.logger.warn(`Intento ${attempt} falló: ${error.message}`);
      }

      if (attempt < maxAttempts) {
        const waitTime = delayMs * attempt; // Backoff exponencial simple
        this.logger.log(`Esperando ${waitTime}ms antes de reintentar...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw new Error(
      `Base de datos no disponible después de ${maxAttempts} intentos. ` +
        `Verifica que: 1) La BD está corriendo, 2) Las credenciales son correctas, 3) No está en modo sleep.`,
    );
  }
}
