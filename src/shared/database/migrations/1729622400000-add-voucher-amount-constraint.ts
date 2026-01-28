import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Agregar constraint CHECK para validar amount en tabla vouchers
 *
 * Propósito:
 * - Prevenir inserción de valores NaN, Infinity, negativos o cero en el campo amount
 * - Garantizar integridad de datos a nivel de base de datos
 *
 * Validaciones aplicadas:
 * 1. amount > 0: Solo montos positivos
 * 2. amount < 'Infinity'::float: No permite Infinity
 * 3. amount = amount: Rechaza NaN (NaN != NaN en SQL)
 *
 * Fecha: Octubre 22, 2025
 */
export class AddVoucherAmountConstraint1729622400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Paso 1: Verificar si hay registros existentes con valores inválidos
    const invalidRecords = await queryRunner.query(`
      SELECT
        id,
        amount,
        date,
        authorization_number,
        confirmation_code
      FROM vouchers
      WHERE amount = 'NaN'::float
         OR amount = 'Infinity'::float
         OR amount = '-Infinity'::float
         OR amount <= 0;
    `);

    if (invalidRecords && invalidRecords.length > 0) {
      throw new Error(
        `No se puede aplicar el constraint. ${invalidRecords.length} registros tienen amount inválido. Corrígelos primero.`,
      );
    }

    // Paso 2: Agregar constraint CHECK
    await queryRunner.query(`
      ALTER TABLE vouchers
      ADD CONSTRAINT check_amount_valid
      CHECK (
        amount > 0 AND                  -- Solo valores positivos
        amount < 'Infinity'::float AND  -- No permite Infinity
        amount = amount                 -- Rechaza NaN (NaN != NaN)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar constraint
    await queryRunner.query(`
      ALTER TABLE vouchers
      DROP CONSTRAINT IF EXISTS check_amount_valid;
    `);
  }
}
