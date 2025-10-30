import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentManagementFeature1761855700765 implements MigrationInterface {
    name = 'PaymentManagementFeature1761855700765'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "house_records" DROP CONSTRAINT "FK_house_records_house_id"`);
        await queryRunner.query(`ALTER TABLE "house_records" DROP CONSTRAINT "FK_house_records_record_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_houses_number_house"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_house_records_house_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_house_records_record_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_transactions_status_validation"`);
        await queryRunner.query(`DROP INDEX "public"."idx_transactions_status_processed_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_transactions_status_house_number"`);
        await queryRunner.query(`ALTER TABLE "vouchers" DROP CONSTRAINT "check_amount_valid"`);
        await queryRunner.query(`CREATE TABLE "period_config" ("id" SERIAL NOT NULL, "default_maintenance_amount" double precision NOT NULL DEFAULT '800', "default_water_amount" double precision DEFAULT '200', "default_extraordinary_fee_amount" double precision DEFAULT '1000', "payment_due_day" integer NOT NULL DEFAULT '10', "late_payment_penalty_amount" double precision NOT NULL DEFAULT '100', "effective_from" date NOT NULL, "effective_until" date, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cd1c148af6fa82b7396a56b259f" PRIMARY KEY ("id")); COMMENT ON COLUMN "period_config"."payment_due_day" IS 'Día límite de pago del mes'; COMMENT ON COLUMN "period_config"."late_payment_penalty_amount" IS 'Monto fijo de penalidad por pago tardío'; COMMENT ON COLUMN "period_config"."effective_from" IS 'Fecha desde la cual esta configuración es válida'; COMMENT ON COLUMN "period_config"."effective_until" IS 'Fecha hasta la cual esta configuración es válida (null = indefinido)'`);
        await queryRunner.query(`CREATE TYPE "public"."record_allocations_concept_type_enum" AS ENUM('maintenance', 'water', 'extraordinary_fee', 'penalties', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."record_allocations_payment_status_enum" AS ENUM('complete', 'partial', 'overpaid')`);
        await queryRunner.query(`CREATE TABLE "record_allocations" ("id" SERIAL NOT NULL, "record_id" integer NOT NULL, "house_id" integer NOT NULL, "period_id" integer NOT NULL, "concept_type" "public"."record_allocations_concept_type_enum" NOT NULL, "concept_id" integer NOT NULL, "allocated_amount" double precision NOT NULL, "expected_amount" double precision NOT NULL, "payment_status" "public"."record_allocations_payment_status_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ab47a02b8412fa1c64c60cf2ecf" PRIMARY KEY ("id")); COMMENT ON COLUMN "record_allocations"."concept_type" IS 'Tipo de concepto al que se aplica el pago'; COMMENT ON COLUMN "record_allocations"."concept_id" IS 'ID del concepto específico (cta_maintenance_id, cta_water_id, etc.)'; COMMENT ON COLUMN "record_allocations"."allocated_amount" IS 'Monto aplicado de este pago a este concepto'; COMMENT ON COLUMN "record_allocations"."expected_amount" IS 'Monto esperado del concepto (sin centavos, siempre entero)'; COMMENT ON COLUMN "record_allocations"."payment_status" IS 'Estado del pago: completo, parcial o sobrepagado'`);
        await queryRunner.query(`CREATE TYPE "public"."house_period_overrides_concept_type_enum" AS ENUM('maintenance', 'water', 'extraordinary_fee')`);
        await queryRunner.query(`CREATE TABLE "house_period_overrides" ("id" SERIAL NOT NULL, "house_id" integer NOT NULL, "period_id" integer NOT NULL, "concept_type" "public"."house_period_overrides_concept_type_enum" NOT NULL, "custom_amount" double precision NOT NULL, "reason" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2cce6cef9dada48442921240f4d" PRIMARY KEY ("id")); COMMENT ON COLUMN "house_period_overrides"."concept_type" IS 'Tipo de concepto que se está sobrescribiendo'; COMMENT ON COLUMN "house_period_overrides"."custom_amount" IS 'Monto personalizado para esta casa en este período'; COMMENT ON COLUMN "house_period_overrides"."reason" IS 'Razón del ajuste (ej: convenio de pago, descuento, etc.)'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a0cac7dab2888b3b9c5d4de8f4" ON "house_period_overrides" ("house_id", "period_id", "concept_type") `);
        await queryRunner.query(`CREATE TABLE "house_balances" ("id" SERIAL NOT NULL, "house_id" integer NOT NULL, "accumulated_cents" double precision NOT NULL DEFAULT '0', "credit_balance" double precision NOT NULL DEFAULT '0', "debit_balance" double precision NOT NULL DEFAULT '0', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_eab24f6fd195902375cb0db0dda" UNIQUE ("house_id"), CONSTRAINT "PK_5b2658d490a66bf72c64f7c74c6" PRIMARY KEY ("id")); COMMENT ON COLUMN "house_balances"."accumulated_cents" IS 'Centavos acumulados de pagos (solo decimales, 0.00 - 0.99). Pendiente definir aplicación automática.'; COMMENT ON COLUMN "house_balances"."credit_balance" IS 'Saldo a favor por pagos adelantados o pagos mayores'; COMMENT ON COLUMN "house_balances"."debit_balance" IS 'Deuda acumulada por pagos incompletos o faltantes'`);
        await queryRunner.query(`ALTER TABLE "periods" ADD "period_config_id" integer`);
        await queryRunner.query(`ALTER TABLE "periods" DROP CONSTRAINT "UQ_ad1ab67565f06e8be7712102168"`);
        await queryRunner.query(`ALTER TABLE "periods" DROP CONSTRAINT "UQ_f282faf1d862994380238b1fd0e"`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."reason" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."identified_house_number" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."processed_at" IS NULL`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."metadata" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d20658af5d74bd9ac43ffcbde8" ON "periods" ("year", "month") `);
        await queryRunner.query(`ALTER TABLE "periods" ADD CONSTRAINT "FK_714758e1df01b3963a8e540be18" FOREIGN KEY ("period_config_id") REFERENCES "period_config"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "record_allocations" ADD CONSTRAINT "FK_52058d8f768e3ce4cee2575a9e1" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "record_allocations" ADD CONSTRAINT "FK_31fffe75dd783655d9f1187ab90" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE NO ACTION ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "record_allocations" ADD CONSTRAINT "FK_0cb88d2e259b0b25897f31cfbcb" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "house_period_overrides" ADD CONSTRAINT "FK_620637f4efacfb2066a19ef2655" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "house_period_overrides" ADD CONSTRAINT "FK_d3378ba49b2d78f758af24698b4" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "house_balances" ADD CONSTRAINT "FK_eab24f6fd195902375cb0db0dda" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "house_balances" DROP CONSTRAINT "FK_eab24f6fd195902375cb0db0dda"`);
        await queryRunner.query(`ALTER TABLE "house_period_overrides" DROP CONSTRAINT "FK_d3378ba49b2d78f758af24698b4"`);
        await queryRunner.query(`ALTER TABLE "house_period_overrides" DROP CONSTRAINT "FK_620637f4efacfb2066a19ef2655"`);
        await queryRunner.query(`ALTER TABLE "record_allocations" DROP CONSTRAINT "FK_0cb88d2e259b0b25897f31cfbcb"`);
        await queryRunner.query(`ALTER TABLE "record_allocations" DROP CONSTRAINT "FK_31fffe75dd783655d9f1187ab90"`);
        await queryRunner.query(`ALTER TABLE "record_allocations" DROP CONSTRAINT "FK_52058d8f768e3ce4cee2575a9e1"`);
        await queryRunner.query(`ALTER TABLE "periods" DROP CONSTRAINT "FK_714758e1df01b3963a8e540be18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d20658af5d74bd9ac43ffcbde8"`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."metadata" IS 'Información adicional en formato JSON (candidatos, scores, matchCriteria, etc.)'`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."processed_at" IS 'Timestamp de cuándo fue procesado por la última conciliación'`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."identified_house_number" IS 'Número de casa identificado durante conciliación (aunque requiera validación manual)'`);
        await queryRunner.query(`COMMENT ON COLUMN "transactions_status"."reason" IS 'Razón del estado actual (ej: "Conflicto centavos vs concepto", "Identificado por centavos (casa 15)")'`);
        await queryRunner.query(`ALTER TABLE "periods" ADD CONSTRAINT "UQ_f282faf1d862994380238b1fd0e" UNIQUE ("month")`);
        await queryRunner.query(`ALTER TABLE "periods" ADD CONSTRAINT "UQ_ad1ab67565f06e8be7712102168" UNIQUE ("year")`);
        await queryRunner.query(`ALTER TABLE "periods" DROP COLUMN "period_config_id"`);
        await queryRunner.query(`DROP TABLE "house_balances"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0cac7dab2888b3b9c5d4de8f4"`);
        await queryRunner.query(`DROP TABLE "house_period_overrides"`);
        await queryRunner.query(`DROP TYPE "public"."house_period_overrides_concept_type_enum"`);
        await queryRunner.query(`DROP TABLE "record_allocations"`);
        await queryRunner.query(`DROP TYPE "public"."record_allocations_payment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."record_allocations_concept_type_enum"`);
        await queryRunner.query(`DROP TABLE "period_config"`);
        await queryRunner.query(`ALTER TABLE "vouchers" ADD CONSTRAINT "check_amount_valid" CHECK (((amount > (0)::double precision) AND (amount < 'Infinity'::double precision) AND (amount = amount)))`);
        await queryRunner.query(`CREATE INDEX "idx_transactions_status_house_number" ON "transactions_status" ("identified_house_number") `);
        await queryRunner.query(`CREATE INDEX "idx_transactions_status_processed_at" ON "transactions_status" ("processed_at") `);
        await queryRunner.query(`CREATE INDEX "idx_transactions_status_validation" ON "transactions_status" ("validation_status") `);
        await queryRunner.query(`CREATE INDEX "IDX_house_records_record_id" ON "house_records" ("record_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_house_records_house_id" ON "house_records" ("house_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_houses_number_house" ON "houses" ("number_house") `);
        await queryRunner.query(`ALTER TABLE "house_records" ADD CONSTRAINT "FK_house_records_record_id" FOREIGN KEY ("record_id") REFERENCES "records"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "house_records" ADD CONSTRAINT "FK_house_records_house_id" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
