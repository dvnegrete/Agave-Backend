import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDuplicateTransactionStatus1769700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PASO 1: Identificar TransactionStatus duplicados
    // Mantener el mas reciente (MAX(id)) por cada transactions_bank_id
    // Eliminar los demas
    await queryRunner.query(`
      DELETE FROM transactions_status
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM transactions_status
        WHERE transactions_bank_id IS NOT NULL
        GROUP BY transactions_bank_id
      )
      AND transactions_bank_id IS NOT NULL
    `);

    // PASO 2: Actualizar confirmation_status = true en transactions_bank
    // para TODAS las transacciones que YA tienen un TransactionStatus
    // (fueron procesadas por reconciliacion pero no se les marco)
    await queryRunner.query(`
      UPDATE transactions_bank tb
      SET confirmation_status = true
      WHERE tb.confirmation_status = false
        AND tb.is_deposit = true
        AND EXISTS (
          SELECT 1
          FROM transactions_status ts
          WHERE ts.transactions_bank_id = tb.id
        )
    `);

    // PASO 3: Eliminar Records duplicados creados por asignaciones multiples
    // del mismo deposito. Mantener solo el primer Record por transaction_status_id.
    // Primero eliminar record_allocations huerfanos
    await queryRunner.query(`
      DELETE FROM record_allocations
      WHERE record_id IN (
        SELECT r.id
        FROM records r
        INNER JOIN (
          SELECT transaction_status_id, MIN(id) as keep_id
          FROM records
          WHERE transaction_status_id IS NOT NULL
          GROUP BY transaction_status_id
          HAVING COUNT(*) > 1
        ) dups ON r.transaction_status_id = dups.transaction_status_id
        WHERE r.id != dups.keep_id
      )
    `);

    // Luego eliminar house_records huerfanos
    await queryRunner.query(`
      DELETE FROM house_records
      WHERE record_id IN (
        SELECT r.id
        FROM records r
        INNER JOIN (
          SELECT transaction_status_id, MIN(id) as keep_id
          FROM records
          WHERE transaction_status_id IS NOT NULL
          GROUP BY transaction_status_id
          HAVING COUNT(*) > 1
        ) dups ON r.transaction_status_id = dups.transaction_status_id
        WHERE r.id != dups.keep_id
      )
    `);

    // Finalmente eliminar los records duplicados
    await queryRunner.query(`
      DELETE FROM records
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM records
        WHERE transaction_status_id IS NOT NULL
        GROUP BY transaction_status_id
      )
      AND transaction_status_id IN (
        SELECT transaction_status_id
        FROM records
        WHERE transaction_status_id IS NOT NULL
        GROUP BY transaction_status_id
        HAVING COUNT(*) > 1
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No es reversible: los datos duplicados no se pueden recrear
    // Solo revertir el cambio de confirmation_status
    // NOTA: Esto es informativo, no se debe ejecutar down en produccion
    console.warn(
      'ADVERTENCIA: down() no puede restaurar datos duplicados eliminados',
    );
  }
}
