import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionsStatusTrackingFields implements MigrationInterface {
  name = 'AddTransactionsStatusTrackingFields' + Date.now();

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar nuevas columnas a la tabla transactions_status
    await queryRunner.query(`
      ALTER TABLE "transactions_status"
      ADD COLUMN IF NOT EXISTS "reason" text,
      ADD COLUMN IF NOT EXISTS "identified_house_number" int,
      ADD COLUMN IF NOT EXISTS "processed_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    `);

    // Agregar comentarios a las columnas para documentación
    await queryRunner.query(`
      COMMENT ON COLUMN "transactions_status"."reason" IS
      'Razón del estado actual (ej: "Conflicto centavos vs concepto", "Identificado por centavos (casa 15)")';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "transactions_status"."identified_house_number" IS
      'Número de casa identificado durante conciliación (aunque requiera validación manual)';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "transactions_status"."processed_at" IS
      'Timestamp de cuándo fue procesado por la última conciliación';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "transactions_status"."metadata" IS
      'Información adicional en formato JSON (candidatos, scores, matchCriteria, etc.)';
    `);

    // Crear índices para mejorar performance en queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_transactions_status_validation"
      ON "transactions_status" ("validation_status");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_transactions_status_processed_at"
      ON "transactions_status" ("processed_at");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_transactions_status_house_number"
      ON "transactions_status" ("identified_house_number");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: eliminar índices
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_transactions_status_house_number";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_transactions_status_processed_at";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_transactions_status_validation";
    `);

    // Revertir: eliminar columnas
    await queryRunner.query(`
      ALTER TABLE "transactions_status"
      DROP COLUMN IF EXISTS "metadata",
      DROP COLUMN IF EXISTS "processed_at",
      DROP COLUMN IF EXISTS "identified_house_number",
      DROP COLUMN IF EXISTS "reason";
    `);
  }
}
