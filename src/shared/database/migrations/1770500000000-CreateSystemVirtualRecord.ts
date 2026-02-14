import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Crear registro virtual para créditos del sistema
 *
 * PROBLEMA:
 * - ApplyCreditToPeriodsUseCase crea record_allocations con record_id = 0
 * - record_allocations.record_id es FK a records.id
 * - No existe records.id = 0 → violación de foreign key
 *
 * SOLUCIÓN:
 * - Crear un registro con id = 0 en la tabla records
 * - Este registro representa "crédito del sistema" (no asociado a voucher/transacción)
 * - Permite que las allocations de crédito tengan una FK válida
 */
export class CreateSystemVirtualRecord1770500000000
  implements MigrationInterface
{
  name = 'CreateSystemVirtualRecord1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si ya existe el registro con id = 0
    const existingRecord = await queryRunner.query(
      `SELECT id FROM records WHERE id = 0`,
    );

    if (existingRecord.length === 0) {
      // Insertar registro virtual con id = 0
      // Todos los campos FK son nullable, así que pueden ser NULL
      await queryRunner.query(
        `INSERT INTO records (id, transaction_status_id, vouchers_id, cta_extraordinary_fee_id, cta_maintenance_id, cta_penalties_id, cta_water_id, cta_other_payments_id, created_at, updated_at)
         VALUES (0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NOW(), NOW())`,
      );

      // Resetear la secuencia para que no haya conflicto con futuros inserts
      // (asegurar que el siguiente ID auto-generado sea >= 1)
      const maxId = await queryRunner.query(
        `SELECT COALESCE(MAX(id), 0) as max_id FROM records WHERE id > 0`,
      );
      const nextId = Math.max(1, maxId[0].max_id + 1);

      await queryRunner.query(
        `SELECT setval('records_id_seq', ${nextId}, false)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NO eliminar el registro virtual en rollback
    // Podría haber allocations existentes que dependen de él
    // Solo loguear un warning
    console.warn(
      'Migration rollback: System virtual record (id=0) NOT deleted to preserve data integrity',
    );
  }
}
