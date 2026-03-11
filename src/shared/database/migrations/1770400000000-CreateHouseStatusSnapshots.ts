import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHouseStatusSnapshots1770400000000
  implements MigrationInterface
{
  name = 'CreateHouseStatusSnapshots1770400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la tabla ya existe (migración idempotente)
    const hasTable = await queryRunner.hasTable('house_status_snapshots');

    if (hasTable) {
      console.log(
        'Migration: house_status_snapshots table already exists. Skipping.',
      );
      return;
    }

    // Crear tabla house_status_snapshots
    await queryRunner.query(
      `CREATE TABLE "house_status_snapshots" (
        "id" SERIAL NOT NULL,
        "house_id" integer NOT NULL,
        "status" varchar(20) NOT NULL,
        "total_debt" double precision NOT NULL DEFAULT 0,
        "credit_balance" double precision NOT NULL DEFAULT 0,
        "total_unpaid_periods" integer NOT NULL DEFAULT 0,
        "enriched_data" jsonb NOT NULL,
        "is_stale" boolean NOT NULL DEFAULT true,
        "calculated_at" TIMESTAMP NULL,
        "invalidated_at" TIMESTAMP NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_house_status_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_house_status_snapshots_house_id" UNIQUE ("house_id")
      );
      COMMENT ON COLUMN "house_status_snapshots"."status" IS 'Estado: morosa / al_dia / saldo_a_favor';
      COMMENT ON COLUMN "house_status_snapshots"."total_debt" IS 'Deuda total denormalizada';
      COMMENT ON COLUMN "house_status_snapshots"."credit_balance" IS 'Saldo a favor denormalizado';
      COMMENT ON COLUMN "house_status_snapshots"."total_unpaid_periods" IS 'Conteo periodos impagos';
      COMMENT ON COLUMN "house_status_snapshots"."enriched_data" IS 'EnrichedHouseBalance completo';
      COMMENT ON COLUMN "house_status_snapshots"."is_stale" IS 'true = necesita recalcular';
      COMMENT ON COLUMN "house_status_snapshots"."calculated_at" IS 'Cuando se calculo el snapshot';
      COMMENT ON COLUMN "house_status_snapshots"."invalidated_at" IS 'Cuando se invalido por ultima vez';
      `,
    );

    // Crear índice en is_stale para queries de invalidación bulk
    await queryRunner.query(
      `CREATE INDEX "idx_house_status_snapshots_is_stale" ON "house_status_snapshots" ("is_stale")`,
    );

    // Agregar foreign key
    await queryRunner.query(
      `ALTER TABLE "house_status_snapshots"
       ADD CONSTRAINT "FK_house_status_snapshots_house"
       FOREIGN KEY ("house_id")
       REFERENCES "houses"("id")
       ON DELETE CASCADE
       ON UPDATE CASCADE`,
    );

    console.log(
      'Migration: house_status_snapshots table created successfully.',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign key
    await queryRunner.query(
      `ALTER TABLE "house_status_snapshots" DROP CONSTRAINT IF EXISTS "FK_house_status_snapshots_house"`,
    );

    // Eliminar índice
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_house_status_snapshots_is_stale"`,
    );

    // Eliminar tabla
    await queryRunner.query(`DROP TABLE IF EXISTS "house_status_snapshots"`);

    console.log(
      'Migration: house_status_snapshots table dropped successfully.',
    );
  }
}
