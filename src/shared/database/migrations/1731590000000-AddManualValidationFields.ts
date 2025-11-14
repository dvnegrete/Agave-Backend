import { MigrationInterface, QueryRunner, TableColumn, Table } from 'typeorm';

/**
 * Migración para agregar soporte de validación manual a la conciliación bancaria
 *
 * Propósito:
 * - Crear tabla manual_validation_approvals para almacenar ÚNICA FUENTE DE VERDAD
 *   de datos de aprobación/rechazo con historial completo de auditoría
 * - Agregar índices a transaction_status para optimizar queries frecuentes
 *
 * Arquitectura: Normalizado a 3NF
 * - Los datos de aprobación/rechazo se almacenan ÚNICAMENTE en manual_validation_approvals
 * - transaction_status solo contiene el estado final y metadata de la decisión
 * - Esto elimina dependencias transitivas y garantiza consistencia de datos
 */
export class AddManualValidationFields1731590000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla manual_validation_approvals
    // ÚNICA FUENTE DE VERDAD para datos de aprobación/rechazo (3NF)
    await queryRunner.createTable(
      new Table({
        name: 'manual_validation_approvals',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
            comment: 'ID único del registro de aprobación',
          },
          {
            name: 'transaction_id',
            type: 'varchar',
            isNullable: false,
            comment: 'ID de la transacción bancaria',
          },
          {
            name: 'voucher_id',
            type: 'integer',
            isNullable: true,
            comment: 'ID del voucher elegido (NULL si fue rechazado)',
          },
          {
            name: 'approved_by_user_id',
            type: 'uuid',
            isNullable: false,
            comment: 'ID del usuario que aprobó o rechazó',
          },
          {
            name: 'approval_notes',
            type: 'text',
            isNullable: true,
            comment: 'Notas del operador',
          },
          {
            name: 'approved_at',
            type: 'timestamp',
            default: 'NOW()',
            comment: 'Timestamp de la aprobación/rechazo',
          },
          {
            name: 'rejection_reason',
            type: 'text',
            isNullable: true,
            comment: 'Razón del rechazo (si aplica)',
          },
        ],
        indices: [
          {
            name: 'idx_manual_validation_approvals_transaction',
            columnNames: ['transaction_id'],
          },
          {
            name: 'idx_manual_validation_approvals_user',
            columnNames: ['approved_by_user_id'],
          },
          {
            name: 'idx_manual_validation_approvals_created',
            columnNames: ['approved_at'],
          },
        ],
        foreignKeys: [
          {
            columnNames: ['transaction_id'],
            referencedTableName: 'transactions_bank',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          {
            columnNames: ['voucher_id'],
            referencedTableName: 'vouchers',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            columnNames: ['approved_by_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );

    // 3. Agregar índices útiles en transaction_status para queries frecuentes
    await queryRunner.query(
      `CREATE INDEX idx_transaction_status_validation_status
       ON transaction_status(validation_status)`,
    );

    await queryRunner.query(
      `CREATE INDEX idx_transaction_status_created
       ON transaction_status(created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar tabla manual_validation_approvals (con cascada de FKs)
    await queryRunner.dropTable('manual_validation_approvals', true);

    // Eliminar índices de transaction_status
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_transaction_status_validation_status`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_transaction_status_created`,
    );
  }
}
