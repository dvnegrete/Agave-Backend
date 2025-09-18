import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDateFromTransactionsStatus implements MigrationInterface {
  name = 'RemoveDateFromTransactionsStatus' + Date.now();

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar la columna 'date' de la tabla transactions_status
    await queryRunner.query(`
            ALTER TABLE "transactions_status"
            DROP COLUMN IF EXISTS "date";
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: agregar la columna 'date' de vuelta a la tabla transactions_status
    await queryRunner.query(`
            ALTER TABLE "transactions_status"
            ADD COLUMN "date" timestamp NOT NULL DEFAULT now();
        `);
  }
}
