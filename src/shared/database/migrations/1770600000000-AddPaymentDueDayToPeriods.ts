import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega columna payment_due_day (nullable) a la tabla periods.
 * Cuando está seteada, sobreescribe el payment_due_day del PeriodConfig
 * para ese período específico. Cuando es null, se usa el valor del PeriodConfig.
 * Esto permite configurar el día límite de pago por mes individual.
 */
export class AddPaymentDueDayToPeriods1770600000000
  implements MigrationInterface
{
  name = 'AddPaymentDueDayToPeriods1770600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "periods"
       ADD COLUMN "payment_due_day" integer NULL
       CHECK ("payment_due_day" >= 1 AND "payment_due_day" <= 28)`,
    );

    await queryRunner.query(
      `COMMENT ON COLUMN "periods"."payment_due_day" IS
       'Día límite de pago para este período. Sobreescribe PeriodConfig.payment_due_day cuando está seteado. NULL = usar el del PeriodConfig.'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "periods" DROP COLUMN IF EXISTS "payment_due_day"`,
    );
  }
}
