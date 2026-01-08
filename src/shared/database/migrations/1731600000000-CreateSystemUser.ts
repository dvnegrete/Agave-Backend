import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Crear Usuario Sistema para Conciliación Bancaria
 *
 * Este usuario es requerido para asignar casas creadas automáticamente
 * durante el proceso de conciliación bancaria cuando se identifica una
 * casa por centavos (ej: $500.15 → Casa #15).
 *
 * ⚠️ NOTA: UUID hardcodeado por estabilidad de migración.
 * Fuente de verdad: @/shared/config/business-rules.config (SYSTEM_USER_ID)
 *
 * Ver: docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md
 */
export class CreateSystemUser1731600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
      ON CONFLICT (id) DO NOTHING;
    `);

    // Log para confirmar
    const result = await queryRunner.query(`
      SELECT id, mail FROM users
      WHERE id = '00000000-0000-0000-0000-000000000000';
    `);

    if (result && result.length > 0) {
      console.log('✅ Usuario Sistema creado/verificado:', result[0].mail);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NO eliminamos el usuario Sistema en rollback por seguridad
    // Si hay casas asignadas a este usuario, eliminarlas causaría pérdida de datos
    console.log(
      '⚠️  Rollback: Usuario Sistema NO eliminado por seguridad (puede tener casas asignadas)',
    );

    // Descomentar solo si estás SEGURO de que no hay casas asignadas:
    // await queryRunner.query(`
    //   DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000000';
    // `);
  }
}
