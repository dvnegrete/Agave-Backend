import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Agregar tabla house_records y actualizar relaciones
 *
 * Cambios:
 * 1. Crear tabla house_records (tabla intermedia)
 * 2. Modificar tabla houses:
 *    - Agregar columna id (PK autogenerada)
 *    - Convertir number_house de PK a unique index
 *    - Remover columna record_id
 * 3. Actualizar tabla records:
 *    - Relación con house_records en lugar de houses directamente
 *
 * Esta migración permite:
 * - Una casa puede tener múltiples records (pagos)
 * - Un usuario puede tener múltiples casas
 * - Una casa puede cambiar de propietario
 */
export class AddHouseRecordTableAndUpdateRelations1729113600000
  implements MigrationInterface
{
  name = 'AddHouseRecordTableAndUpdateRelations1729113600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla house_records (tabla intermedia)
    await queryRunner.query(`
      CREATE TABLE "house_records" (
        "id" SERIAL NOT NULL,
        "house_id" integer NOT NULL,
        "record_id" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_house_records" PRIMARY KEY ("id")
      )
    `);

    // 2. Migrar datos existentes de houses a house_records antes de modificar la tabla
    // IMPORTANTE: Solo si ya hay datos en la tabla houses
    const hasData = await queryRunner.query(`
      SELECT COUNT(*) as count FROM "houses"
    `);

    if (hasData[0].count > 0) {
      console.log(
        `Migrando ${hasData[0].count} registros de houses a house_records...`,
      );

      // Insertar registros existentes en house_records
      await queryRunner.query(`
        INSERT INTO "house_records" ("house_id", "record_id", "created_at", "updated_at")
        SELECT
          "number_house" as house_id,
          "record_id",
          "created_at",
          "updated_at"
        FROM "houses"
        WHERE "record_id" IS NOT NULL
      `);
    }

    // 3. Modificar tabla houses
    // 3.1. Eliminar constraint de FK de record_id (si existe)
    await queryRunner.query(`
      ALTER TABLE "houses"
      DROP CONSTRAINT IF EXISTS "FK_houses_record_id"
    `);

    // 3.2. Eliminar constraint de PK actual
    await queryRunner.query(`
      ALTER TABLE "houses"
      DROP CONSTRAINT IF EXISTS "PK_houses"
    `);

    // 3.3. Agregar nueva columna id como serial
    await queryRunner.query(`
      ALTER TABLE "houses"
      ADD COLUMN "id" SERIAL
    `);

    // 3.4. Establecer id como nueva PK
    await queryRunner.query(`
      ALTER TABLE "houses"
      ADD CONSTRAINT "PK_houses" PRIMARY KEY ("id")
    `);

    // 3.5. Agregar unique constraint a number_house
    await queryRunner.query(`
      ALTER TABLE "houses"
      ADD CONSTRAINT "UQ_houses_number_house" UNIQUE ("number_house")
    `);

    // 3.6. Eliminar columna record_id (ya no es necesaria)
    await queryRunner.query(`
      ALTER TABLE "houses"
      DROP COLUMN IF EXISTS "record_id"
    `);

    // 4. Actualizar los house_id en house_records para usar los nuevos IDs generados
    if (hasData[0].count > 0) {
      await queryRunner.query(`
        UPDATE "house_records" hr
        SET "house_id" = h."id"
        FROM "houses" h
        WHERE hr."house_id" = h."number_house"
      `);
    }

    // 5. Agregar foreign keys a house_records
    await queryRunner.query(`
      ALTER TABLE "house_records"
      ADD CONSTRAINT "FK_house_records_house_id"
      FOREIGN KEY ("house_id")
      REFERENCES "houses"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "house_records"
      ADD CONSTRAINT "FK_house_records_record_id"
      FOREIGN KEY ("record_id")
      REFERENCES "records"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // 6. Crear índices para mejorar performance
    await queryRunner.query(`
      CREATE INDEX "IDX_house_records_house_id"
      ON "house_records" ("house_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_house_records_record_id"
      ON "house_records" ("record_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_houses_number_house"
      ON "houses" ("number_house")
    `);

    console.log('✅ Migración completada exitosamente');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cambios en orden inverso

    // 1. Eliminar índices
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_houses_number_house"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_house_records_record_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_house_records_house_id"`,
    );

    // 2. Eliminar foreign keys de house_records
    await queryRunner.query(`
      ALTER TABLE "house_records"
      DROP CONSTRAINT IF EXISTS "FK_house_records_record_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "house_records"
      DROP CONSTRAINT IF EXISTS "FK_house_records_house_id"
    `);

    // 3. Restaurar columna record_id en houses
    await queryRunner.query(`
      ALTER TABLE "houses"
      ADD COLUMN "record_id" integer
    `);

    // 4. Migrar datos de vuelta (tomar el primer record de cada casa)
    await queryRunner.query(`
      UPDATE "houses" h
      SET "record_id" = (
        SELECT "record_id"
        FROM "house_records" hr
        WHERE hr."house_id" = h."id"
        ORDER BY hr."created_at" DESC
        LIMIT 1
      )
    `);

    // 5. Eliminar unique constraint de number_house
    await queryRunner.query(`
      ALTER TABLE "houses"
      DROP CONSTRAINT IF EXISTS "UQ_houses_number_house"
    `);

    // 6. Eliminar PK actual
    await queryRunner.query(`
      ALTER TABLE "houses"
      DROP CONSTRAINT IF EXISTS "PK_houses"
    `);

    // 7. Eliminar columna id
    await queryRunner.query(`
      ALTER TABLE "houses"
      DROP COLUMN IF EXISTS "id"
    `);

    // 8. Restaurar number_house como PK
    await queryRunner.query(`
      ALTER TABLE "houses"
      ADD CONSTRAINT "PK_houses" PRIMARY KEY ("number_house")
    `);

    // 9. Restaurar FK de record_id
    await queryRunner.query(`
      ALTER TABLE "houses"
      ADD CONSTRAINT "FK_houses_record_id"
      FOREIGN KEY ("record_id")
      REFERENCES "records"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
    `);

    // 10. Eliminar tabla house_records
    await queryRunner.query(`DROP TABLE IF EXISTS "house_records"`);

    console.log('✅ Rollback completado exitosamente');
  }
}
