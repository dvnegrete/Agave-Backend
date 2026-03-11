import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHouseIdToCtaPenalties1769820000000
  implements MigrationInterface
{
  name = 'AddHouseIdToCtaPenalties1769820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna house_id nullable
    await queryRunner.query(
      `ALTER TABLE "cta_penalties" ADD COLUMN "house_id" integer NULL`,
    );

    // FK a houses(id) ON DELETE CASCADE
    await queryRunner.query(
      `ALTER TABLE "cta_penalties" ADD CONSTRAINT "FK_cta_penalties_house_id" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE`,
    );

    // Unique index para prevenir duplicados house + period
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cta_penalties_house_period" ON "cta_penalties" ("house_id", "period_id") WHERE "house_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cta_penalties_house_period"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cta_penalties" DROP CONSTRAINT IF EXISTS "FK_cta_penalties_house_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cta_penalties" DROP COLUMN IF EXISTS "house_id"`,
    );
  }
}
