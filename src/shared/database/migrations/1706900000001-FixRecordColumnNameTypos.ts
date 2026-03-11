import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * MIGRACIÓN: FixRecordColumnNameTypos
 *
 * Propósito:
 * Corregir typos heredados en nombres de columnas de la tabla records:
 * - cta_maintence_id  → cta_maintenance_id
 * - cta_penalities_id → cta_penalties_id
 *
 * Estos typos fueron introducidos en versiones anteriores y se han propagado
 * a todo el sistema. Esta migración los corrige manteniendo integridad referencial.
 *
 * Impacto:
 * - Corrige nomenclatura (maintenance vs maintence, penalties vs penalities)
 * - Mantiene referencias externas intactas (constraints CASCADE)
 * - Permite sincronización correcta en TypeORM
 * - Sincroniza con documentación (schema.md, DBML)
 *
 * Fecha: Enero 2026
 * Versión: 3.1.0
 * Problema P3-1: Typos en nombres de columnas
 */
export class FixRecordColumnNameTypos1706900000001
  implements MigrationInterface
{
  name = 'FixRecordColumnNameTypos1706900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PASO 1: Verificar si la columna antigua existe (migraciones idempotente)
    const hasOldMaintenceColumn = await queryRunner.hasColumn(
      'records',
      'cta_maintence_id',
    );
    const hasOldPenaltiesColumn = await queryRunner.hasColumn(
      'records',
      'cta_penalities_id',
    );

    // Si las columnas antiguas NO existen, significa que ya fueron renombradas
    // o la BD fue creada con los nombres correctos. No hacer nada.
    if (!hasOldMaintenceColumn && !hasOldPenaltiesColumn) {
      console.log(
        'Migration: Columns already renamed or DB created with correct names. Skipping.',
      );
      return;
    }

    // PASO 2: Eliminar constraints antiguos si existen
    await queryRunner.query(`
      ALTER TABLE "records"
      DROP CONSTRAINT IF EXISTS "fk_records_cta_maintence";
    `);

    await queryRunner.query(`
      ALTER TABLE "records"
      DROP CONSTRAINT IF EXISTS "fk_records_cta_penalities";
    `);

    // PASO 3: Renombrar primera columna si existe (cta_maintence_id → cta_maintenance_id)
    if (hasOldMaintenceColumn) {
      await queryRunner.query(`
        ALTER TABLE "records"
        RENAME COLUMN "cta_maintence_id" TO "cta_maintenance_id";
      `);
    }

    // PASO 4: Renombrar segunda columna si existe (cta_penalities_id → cta_penalties_id)
    if (hasOldPenaltiesColumn) {
      await queryRunner.query(`
        ALTER TABLE "records"
        RENAME COLUMN "cta_penalities_id" TO "cta_penalties_id";
      `);
    }

    // PASO 5: Recrear constraints con nombres correctos (FK a cta_maintenance)
    await queryRunner.query(`
      ALTER TABLE "records"
      ADD CONSTRAINT "fk_records_cta_maintenance"
      FOREIGN KEY ("cta_maintenance_id")
      REFERENCES "cta_maintenance" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    `);

    // PASO 6: Recrear constraints con nombres correctos (FK a cta_penalties)
    await queryRunner.query(`
      ALTER TABLE "records"
      ADD CONSTRAINT "fk_records_cta_penalties"
      FOREIGN KEY ("cta_penalties_id")
      REFERENCES "cta_penalties" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    `);

    // PASO 7: Agregar comentarios explicativos
    await queryRunner.query(`
      COMMENT ON COLUMN "records"."cta_maintenance_id" IS
      'FK a cta_maintenance (corregido de typo "maintence" en v3.1.0)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "records"."cta_penalties_id" IS
      'FK a cta_penalties (corregido de typo "penalities" en v3.1.0)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ROLLBACK PASO 1: Eliminar comentarios
    await queryRunner.query(`
      COMMENT ON COLUMN "records"."cta_maintenance_id" IS NULL;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "records"."cta_penalties_id" IS NULL;
    `);

    // ROLLBACK PASO 2: Eliminar constraints
    await queryRunner.query(`
      ALTER TABLE "records"
      DROP CONSTRAINT IF EXISTS "fk_records_cta_maintenance";
    `);

    await queryRunner.query(`
      ALTER TABLE "records"
      DROP CONSTRAINT IF EXISTS "fk_records_cta_penalties";
    `);

    // ROLLBACK PASO 3: Renombrar columnas de vuelta (con typos)
    await queryRunner.query(`
      ALTER TABLE "records"
      RENAME COLUMN "cta_maintenance_id" TO "cta_maintence_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "records"
      RENAME COLUMN "cta_penalties_id" TO "cta_penalities_id";
    `);

    // ROLLBACK PASO 4: Recrear constraints antiguos (con typos en nombres)
    await queryRunner.query(`
      ALTER TABLE "records"
      ADD CONSTRAINT "fk_records_cta_maintence"
      FOREIGN KEY ("cta_maintence_id")
      REFERENCES "cta_maintenance" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE "records"
      ADD CONSTRAINT "fk_records_cta_penalities"
      FOREIGN KEY ("cta_penalities_id")
      REFERENCES "cta_penalties" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
    `);
  }
}
