import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedAtToHouseBalances1769650000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna ya existe
    const table = await queryRunner.getTable('house_balances');
    if (!table?.columns.find((col) => col.name === 'created_at')) {
      // Agregar columna created_at a house_balances
      await queryRunner.query(
        `ALTER TABLE "house_balances" ADD COLUMN "created_at" timestamptz NOT NULL DEFAULT NOW()`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover columna created_at en rollback
    const table = await queryRunner.getTable('house_balances');
    if (table?.columns.find((col) => col.name === 'created_at')) {
      await queryRunner.query(
        `ALTER TABLE "house_balances" DROP COLUMN "created_at"`,
      );
    }
  }
}
