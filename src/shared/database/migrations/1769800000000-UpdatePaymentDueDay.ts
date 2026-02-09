import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePaymentDueDay1769800000000 implements MigrationInterface {
  name = 'UpdatePaymentDueDay1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Actualizar payment_due_day de 10 a 15 en configs activas existentes
    const result = await queryRunner.query(
      `UPDATE "period_config" SET "payment_due_day" = 15 WHERE "is_active" = true AND "payment_due_day" = 10`,
    );

    // Si no hay configs activas, crear una con valores default
    const activeConfigs = await queryRunner.query(
      `SELECT id FROM "period_config" WHERE "is_active" = true LIMIT 1`,
    );

    if (activeConfigs.length === 0) {
      await queryRunner.query(
        `INSERT INTO "period_config" (
          "default_maintenance_amount",
          "default_water_amount",
          "default_extraordinary_fee_amount",
          "payment_due_day",
          "late_payment_penalty_amount",
          "effective_from",
          "is_active"
        ) VALUES (800, 200, 1000, 15, 100, '2026-01-01', true)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "period_config" SET "payment_due_day" = 10 WHERE "is_active" = true AND "payment_due_day" = 15`,
    );
  }
}
