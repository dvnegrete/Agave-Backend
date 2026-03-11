import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHousePeriodCharges1770000000000
  implements MigrationInterface
{
  name = 'CreateHousePeriodCharges1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la tabla ya existe (migración idempotente)
    const hasTable = await queryRunner.hasTable('house_period_charges');

    if (hasTable) {
      console.log(
        'Migration: house_period_charges table already exists. Skipping.',
      );
      return;
    }

    // Crear tabla house_period_charges
    // Reutiliza el enum existente allocation_concept_type_enum
    await queryRunner.query(
      `CREATE TABLE "house_period_charges" (
        "id" SERIAL NOT NULL,
        "house_id" integer NOT NULL,
        "period_id" integer NOT NULL,
        "concept_type" "public"."record_allocations_concept_type_enum" NOT NULL,
        "expected_amount" double precision NOT NULL,
        "source" varchar(50) NOT NULL DEFAULT 'period_config',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_house_period_charges" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_house_period_charges_composite" UNIQUE ("house_id", "period_id", "concept_type")
      );
      COMMENT ON COLUMN "house_period_charges"."concept_type" IS 'Tipo de concepto del cargo';
      COMMENT ON COLUMN "house_period_charges"."expected_amount" IS 'Monto esperado para esta casa en este período';
      COMMENT ON COLUMN "house_period_charges"."source" IS 'Origen del monto: period_config, override, auto_penalty, manual';
      `,
    );

    // Crear índices
    await queryRunner.query(
      `CREATE INDEX "idx_hpc_house_period" ON "house_period_charges" ("house_id", "period_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_hpc_period" ON "house_period_charges" ("period_id")`,
    );

    // Agregar foreign keys
    await queryRunner.query(
      `ALTER TABLE "house_period_charges"
       ADD CONSTRAINT "FK_house_period_charges_house"
       FOREIGN KEY ("house_id")
       REFERENCES "houses"("id")
       ON DELETE CASCADE
       ON UPDATE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "house_period_charges"
       ADD CONSTRAINT "FK_house_period_charges_period"
       FOREIGN KEY ("period_id")
       REFERENCES "periods"("id")
       ON DELETE CASCADE
       ON UPDATE CASCADE`,
    );

    console.log('Migration: house_period_charges table created successfully.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign keys
    await queryRunner.query(
      `ALTER TABLE "house_period_charges" DROP CONSTRAINT IF EXISTS "FK_house_period_charges_period"`,
    );

    await queryRunner.query(
      `ALTER TABLE "house_period_charges" DROP CONSTRAINT IF EXISTS "FK_house_period_charges_house"`,
    );

    // Eliminar índices
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_hpc_period"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_hpc_house_period"`,
    );

    // Eliminar tabla
    await queryRunner.query(`DROP TABLE IF EXISTS "house_period_charges"`);

    console.log('Migration: house_period_charges table dropped successfully.');
  }
}
