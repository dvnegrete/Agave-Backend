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
    console.log('📋 Iniciando migración: add-voucher-amount-constraint...');

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
      console.warn(
        `⚠️  Se encontraron ${invalidRecords.length} registros con valores inválidos en amount:`,
      );
      invalidRecords.forEach((record: any) => {
        console.warn(
          `   - ID ${record.id}: amount=${record.amount}, confirmation_code=${record.confirmation_code}`,
        );
      });
      console.warn(
        `⚠️  Estos registros deben ser corregidos antes de aplicar el constraint.`,
      );
      console.warn(
        `⚠️  Ejecuta: UPDATE vouchers SET amount = 0, confirmation_status = false WHERE amount = 'NaN'::float OR amount <= 0;`,
      );

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

    console.log('✅ Constraint check_amount_valid agregado correctamente');
    console.log('   - Rechaza: NaN, Infinity, -Infinity, valores <= 0');
    console.log('   - Acepta: Solo números positivos válidos');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('📋 Revertiendo migración: add-voucher-amount-constraint...');

    // Eliminar constraint
    await queryRunner.query(`
      ALTER TABLE vouchers
      DROP CONSTRAINT IF EXISTS check_amount_valid;
    `);

    console.log('✅ Constraint check_amount_valid eliminado');
  }
}
