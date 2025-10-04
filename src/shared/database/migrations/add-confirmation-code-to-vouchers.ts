import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConfirmationCodeToVouchers implements MigrationInterface {
  name = 'AddConfirmationCodeToVouchers' + Date.now();

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar la columna confirmation_code a la tabla vouchers
    await queryRunner.query(`
      ALTER TABLE "vouchers"
      ADD COLUMN "confirmation_code" VARCHAR(20) UNIQUE;
    `);

    // Crear índice único para el campo confirmation_code
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_voucher_confirmation_code"
      ON "vouchers" ("confirmation_code");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: eliminar el índice
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_voucher_confirmation_code";
    `);

    // Revertir: eliminar la columna confirmation_code
    await queryRunner.query(`
      ALTER TABLE "vouchers"
      DROP COLUMN IF EXISTS "confirmation_code";
    `);
  }
}
