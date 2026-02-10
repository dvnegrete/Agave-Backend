import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConceptActivationToPeriods1769810000000
  implements MigrationInterface
{
  name = 'AddConceptActivationToPeriods1769810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "periods" ADD COLUMN "water_active" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "periods" ADD COLUMN "extraordinary_fee_active" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "periods" DROP COLUMN "extraordinary_fee_active"`,
    );
    await queryRunner.query(`ALTER TABLE "periods" DROP COLUMN "water_active"`);
  }
}
