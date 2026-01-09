import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SYSTEM_USER_ID, SYSTEM_USER_EMAIL } from '../../config/business-rules.config';

/**
 * Seed para crear el usuario Sistema requerido por la conciliación bancaria
 *
 * Este servicio se ejecuta automáticamente al iniciar el módulo de base de datos
 * y verifica/crea el usuario Sistema si no existe.
 *
 * UUID: 00000000-0000-0000-0000-000000000000
 * Email: sistema@conciliacion.local
 *
 * Ver: docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md
 */
@Injectable()
export class SystemUserSeed implements OnModuleInit {
  private readonly logger = new Logger(SystemUserSeed.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.ensureSystemUserExists();
    } catch (error) {
      this.logger.error(
        `Error al verificar/crear usuario Sistema: ${error.message}`,
      );
      // No lanzamos error para no bloquear el inicio de la aplicación
      // La verificación en ReconciliationPersistenceService alertará si es necesario
    }
  }

  /**
   * Verifica si el usuario Sistema existe y lo crea si no existe
   */
  private async ensureSystemUserExists(): Promise<void> {
    // Verificar si existe
    const existingUser = await this.dataSource.query(
      'SELECT id, email FROM users WHERE id = $1',
      [SYSTEM_USER_ID],
    );

    if (existingUser && existingUser.length > 0) {
      this.logger.log(
        `✅ Usuario Sistema ya existe: ${existingUser[0].email} (${existingUser[0].id})`,
      );
      return;
    }

    // No existe, crearlo
    this.logger.log(
      '🔨 Usuario Sistema no encontrado, creando automáticamente...',
    );

    await this.dataSource.query(
      `
      INSERT INTO users (id, email, role, status, created_at, updated_at)
      VALUES ($1, $2, 'tenant', 'active', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
      [SYSTEM_USER_ID, SYSTEM_USER_EMAIL],
    );

    // Verificar creación
    const createdUser = await this.dataSource.query(
      'SELECT id, email FROM users WHERE id = $1',
      [SYSTEM_USER_ID],
    );

    if (createdUser && createdUser.length > 0) {
      this.logger.log(
        `✅ Usuario Sistema creado exitosamente: ${createdUser[0].email}`,
      );
      this.logger.log(
        '   Este usuario se usará para casas creadas automáticamente en conciliación bancaria',
      );
    } else {
      this.logger.warn(
        '⚠️  No se pudo crear el usuario Sistema. Verifica permisos de base de datos.',
      );
    }
  }
}
