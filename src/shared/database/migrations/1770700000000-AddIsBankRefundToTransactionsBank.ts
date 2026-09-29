import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Columna is_bank_refund en transactions_bank
 *
 * Permite marcar un depósito no reclamado como devolución del banco
 * (cargo no reconocido, transferencia fallida, etc.). Estos depósitos no
 * corresponden a un pago de casa: se muestran en el informe de gastos como
 * entrada y se restan del gasto total del mes.
 *
 * Default false: los registros existentes no cambian de comportamiento.
 */
export class AddIsBankRefundToTransactionsBank1770700000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transactions_bank
        ADD COLUMN IF NOT EXISTS is_bank_refund BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN transactions_bank.is_bank_refund IS
        'Depósito que es devolución del banco (no es pago de casa); cuenta como entrada en el informe de gastos'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transactions_bank DROP COLUMN IF EXISTS is_bank_refund
    `);
  }
}
