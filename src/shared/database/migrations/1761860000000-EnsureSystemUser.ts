import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración para asegurar que existe el usuario del sistema
 * Este usuario es REQUERIDO para la conciliación bancaria automática
 *
 * UUID: 00000000-0000-0000-0000-000000000000
 * Email: sistema@conciliacion.local
 *
 * Las casas creadas automáticamente (por centavos) se asignan a este usuario
 * hasta que se identifique al propietario real.
 *
 * ⚠️ NOTA: UUID hardcodeado por estabilidad de migración.
 * Fuente de verdad: @/shared/config/business-rules.config (SYSTEM_USER_ID)
 *
 * Ver: docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md
 */
export class EnsureSystemUser1761860000000 implements MigrationInterface {
  name = 'EnsureSystemUser1761860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si el usuario ya existe
    const userExists = await queryRunner.query(
      `SELECT EXISTS(SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000000') as "exists"`,
    );

    if (!userExists[0].exists) {
      // Insertar usuario del sistema
      await queryRunner.query(`
        INSERT INTO users (id, mail, role, status, created_at, updated_at)
        VALUES (
          '00000000-0000-0000-0000-000000000000',
          'sistema@conciliacion.local',
          'tenant',
          'active',
          NOW(),
          NOW()
        )
      `);

      console.log('✅ Usuario del sistema creado exitosamente');
      console.log('   UUID: 00000000-0000-0000-0000-000000000000');
      console.log('   Email: sistema@conciliacion.local');
    } else {
      console.log('✓ Usuario del sistema ya existe');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Verificar si hay casas asignadas a este usuario
    const housesCount = await queryRunner.query(
      `SELECT COUNT(*) as count FROM houses WHERE user_id = '00000000-0000-0000-0000-000000000000'`,
    );

    const count = parseInt(housesCount[0].count);

    if (count > 0) {
      console.warn(
        `⚠️ ADVERTENCIA: Hay ${count} casa(s) asignada(s) al usuario del sistema.`,
      );
      console.warn(
        '   Estas casas quedarán huérfanas si eliminas este usuario.',
      );
      console.warn('   Considera reasignarlas antes de revertir esta migración.');

      // No eliminar el usuario si hay casas asignadas
      throw new Error(
        `No se puede eliminar el usuario del sistema porque tiene ${count} casa(s) asignada(s). Reasigna las casas primero.`,
      );
    }

    // Solo eliminar si no hay casas asignadas
    await queryRunner.query(
      `DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000000'`,
    );

    console.log('✅ Usuario del sistema eliminado');
  }
}
