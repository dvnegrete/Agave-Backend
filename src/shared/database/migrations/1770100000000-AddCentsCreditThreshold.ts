import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCentsCreditThreshold1770100000000
  implements MigrationInterface
{
  name = 'AddCentsCreditThreshold1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'period_config',
      'cents_credit_threshold',
    );

    if (hasColumn) {
      console.log(
        'Migration: cents_credit_threshold column already exists. Skipping.',
      );
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "period_config" ADD COLUMN "cents_credit_threshold" double precision NOT NULL DEFAULT 100`,
    );

    await queryRunner.query(
      `COMMENT ON COLUMN "period_config"."cents_credit_threshold" IS 'Umbral de centavos acumulados para convertir a crédito (default $100)'`,
    );

    console.log(
      'Migration: cents_credit_threshold column added to period_config.',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'period_config',
      'cents_credit_threshold',
    );

    if (!hasColumn) {
      console.log(
        'Migration: cents_credit_threshold column does not exist. Skipping.',
      );
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "period_config" DROP COLUMN "cents_credit_threshold"`,
    );

    console.log(
      'Migration: cents_credit_threshold column removed from period_config.',
    );
  }
}
