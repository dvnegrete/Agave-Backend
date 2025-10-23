import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConfirmationCodeToVouchers implements MigrationInterface {
  name = 'AddConfirmationCodeToVouchers' + Date.now();

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna confirmation_code ya existe
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'vouchers' AND column_name = 'confirmation_code'
      );
    `);

    if (!columnExists[0].exists) {
      console.log('Agregando columna confirmation_code a vouchers...');

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

      console.log('✅ Columna confirmation_code agregada exitosamente');
    } else {
      console.log('⚠️  Columna confirmation_code ya existe, saltando...');
    }
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
