-- =====================================================
-- AGAVE BACKEND - DATABASE SCHEMA
-- =====================================================
-- Version: 3.1.0
-- Last Updated: Noviembre 14, 2025
-- Description: Complete database schema for Agave property management system
--              with bank reconciliation, automated house creation support,
--              payment management with period configuration,
--              and manual validation audit trail
--              Includes persistence of all reconciliation states (surplus, manual)
--              Manual validation approvals stored in dedicated audit table (3NF)
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE "role_t" AS ENUM ('admin', 'owner', 'tenant');

CREATE TYPE "status_t" AS ENUM ('active', 'suspend', 'inactive');

CREATE TYPE "validation_status_t" AS ENUM ('not-found', 'pending', 'confirmed', 'requires-manual', 'conflict');

-- Payment management enums
CREATE TYPE "record_allocations_concept_type_enum" AS ENUM ('maintenance', 'water', 'extraordinary_fee', 'penalties', 'other');

CREATE TYPE "record_allocations_payment_status_enum" AS ENUM ('complete', 'partial', 'overpaid');

CREATE TYPE "house_period_overrides_concept_type_enum" AS ENUM ('maintenance', 'water', 'extraordinary_fee');


-- =====================================================
-- CORE USER & HOUSING TABLES
-- =====================================================

-- Users table
CREATE TABLE "users" (
	"id" varchar(128) NOT NULL,
	"role" role_t NOT NULL DEFAULT 'tenant',
	"status" status_t NOT NULL DEFAULT 'active',
	"name" varchar(255),
	"email" varchar(255),
	"cel_phone" numeric,
	"avatar" text,
	"last_login" timestamptz,
	"email_verified" boolean NOT NULL DEFAULT false,
	"email_verified_at" timestamptz,
	"observations" text,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "users" IS 'Usuarios del sistema (administradores, propietarios, inquilinos)';
COMMENT ON COLUMN "users"."role" IS 'Rol del usuario en el sistema';
COMMENT ON COLUMN "users"."status" IS 'Estado de la cuenta del usuario';
COMMENT ON COLUMN "users"."email_verified" IS 'Indica si el email del usuario ha sido verificado';
COMMENT ON COLUMN "users"."email_verified_at" IS 'Timestamp de cuando se verificó el email del usuario';


-- Houses table (updated structure with auto-increment ID)
CREATE TABLE "houses" (
	"id" serial NOT NULL UNIQUE,
	"number_house" int NOT NULL UNIQUE,
	"user_id" varchar(128) NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "houses" IS 'Casas/lotes del fraccionamiento';
COMMENT ON COLUMN "houses"."number_house" IS 'Número de casa (1-66)';
COMMENT ON COLUMN "houses"."user_id" IS 'Propietario actual de la casa';


-- =====================================================
-- TRANSACTION & VOUCHER TABLES
-- =====================================================

-- Bank transactions
CREATE TABLE "transactions_bank" (
	"id" bigserial NOT NULL UNIQUE,
	"date" date NOT NULL,
	"time" time NOT NULL,
	"concept" varchar(225),
	"amount" float NOT NULL,
	"is_deposit" boolean NOT NULL,
	"currency" varchar(255),
	"bank_name" text,
	"confirmation_status" boolean NOT NULL DEFAULT false,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "transactions_bank" IS 'Transacciones bancarias importadas de estados de cuenta';
COMMENT ON COLUMN "transactions_bank"."is_deposit" IS 'true = depósito, false = retiro';
COMMENT ON COLUMN "transactions_bank"."confirmation_status" IS 'true = conciliado con voucher/casa';


-- Vouchers (payment receipts)
CREATE TABLE "vouchers" (
	"id" serial NOT NULL UNIQUE,
	"date" timestamptz NOT NULL,
	"authorization_number" varchar(255),
	"confirmation_code" varchar(20) UNIQUE,
	"amount" float NOT NULL,
	"confirmation_status" boolean NOT NULL DEFAULT false,
	"url" text,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "vouchers" IS 'Comprobantes de pago enviados por usuarios (OCR extraído)';
COMMENT ON COLUMN "vouchers"."confirmation_code" IS 'Código único de confirmación generado para el usuario';
COMMENT ON COLUMN "vouchers"."url" IS 'Nombre del archivo en Google Cloud Storage (se elimina tras conciliación)';


-- Transaction status (validation tracking)
CREATE TABLE "transactions_status" (
	"id" serial NOT NULL UNIQUE,
	"validation_status" validation_status_t NOT NULL DEFAULT 'pending',
	"transactions_bank_id" bigint,
	"vouchers_id" int,
	"reason" text,
	"identified_house_number" int,
	"processed_at" timestamptz,
	"metadata" jsonb,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "transactions_status" IS 'Estado de validación de transacciones bancarias con tracking completo';
COMMENT ON COLUMN "transactions_status"."validation_status" IS 'Estado de validación: pending, confirmed, not-found, requires-manual, conflict';
COMMENT ON COLUMN "transactions_status"."reason" IS 'Descripción del resultado de conciliación';
COMMENT ON COLUMN "transactions_status"."identified_house_number" IS 'Número de casa identificado (por centavos o concepto)';
COMMENT ON COLUMN "transactions_status"."processed_at" IS 'Fecha/hora de procesamiento de conciliación';
COMMENT ON COLUMN "transactions_status"."metadata" IS 'Datos adicionales (ej: candidatos para validación manual)';


-- Manual validation approvals (auditoría de validación manual)
CREATE TABLE "manual_validation_approvals" (
	"id" serial NOT NULL UNIQUE,
	"transaction_id" bigint NOT NULL,
	"voucher_id" int,
	"approved_by_user_id" varchar(128) NOT NULL,
	"approval_notes" text,
	"rejection_reason" text,
	"approved_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "manual_validation_approvals" IS 'Registro de auditoría de aprobaciones/rechazos en validación manual de transacciones (ÚNICA FUENTE DE VERDAD para datos de aprobación)';
COMMENT ON COLUMN "manual_validation_approvals"."transaction_id" IS 'ID de la transacción bancaria revisada';
COMMENT ON COLUMN "manual_validation_approvals"."voucher_id" IS 'ID del voucher elegido (NULL si fue rechazado)';
COMMENT ON COLUMN "manual_validation_approvals"."approved_by_user_id" IS 'ID del usuario que aprobó o rechazó el caso';
COMMENT ON COLUMN "manual_validation_approvals"."approval_notes" IS 'Notas opcionales del operador sobre la decisión';
COMMENT ON COLUMN "manual_validation_approvals"."rejection_reason" IS 'Razón específica del rechazo (si aplica)';
COMMENT ON COLUMN "manual_validation_approvals"."approved_at" IS 'Timestamp de la aprobación/rechazo';


-- Last processed transaction (tracking)
CREATE TABLE "last_transaction_bank" (
	"id" serial NOT NULL UNIQUE,
	"transactions_bank_id" bigint,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "last_transaction_bank" IS 'Referencia a la última transacción procesada';


-- =====================================================
-- RECORDS & HOUSE-RECORD ASSOCIATION
-- =====================================================

-- Records (payment records)
CREATE TABLE "records" (
	"id" serial NOT NULL UNIQUE,
	"transaction_status_id" int,
	"vouchers_id" int,
	"cta_extraordinary_fee_id" int,
	"cta_maintenance_id" int,
	"cta_penalties_id" int,
	"cta_water_id" int,
	"cta_other_payments_id" int,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "records" IS 'Registros de pagos (pueden estar asociados a vouchers, cargos, etc.)';
COMMENT ON COLUMN "records"."vouchers_id" IS 'Voucher asociado (nullable para conciliaciones automáticas sin voucher)';


-- House-Record junction table (many-to-many)
CREATE TABLE "house_records" (
	"id" serial NOT NULL UNIQUE,
	"house_id" int NOT NULL,
	"record_id" int NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "house_records" IS 'Relación muchos-a-muchos entre casas y registros de pago';


-- =====================================================
-- BILLING PERIODS & PAYMENT MANAGEMENT
-- =====================================================

-- Period configuration (versioned by dates)
CREATE TABLE "period_config" (
	"id" serial NOT NULL UNIQUE,
	"default_maintenance_amount" float NOT NULL DEFAULT 800,
	"default_water_amount" float DEFAULT 200,
	"default_extraordinary_fee_amount" float DEFAULT 1000,
	"payment_due_day" int NOT NULL DEFAULT 10,
	"late_payment_penalty_amount" float NOT NULL DEFAULT 100,
	"effective_from" date NOT NULL,
	"effective_until" date,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "period_config" IS 'Configuración versionada de períodos con montos default y reglas de pago';
COMMENT ON COLUMN "period_config"."payment_due_day" IS 'Día límite de pago del mes';
COMMENT ON COLUMN "period_config"."late_payment_penalty_amount" IS 'Monto fijo de penalidad por pago tardío';
COMMENT ON COLUMN "period_config"."effective_from" IS 'Fecha desde la cual esta configuración es válida';
COMMENT ON COLUMN "period_config"."effective_until" IS 'Fecha hasta la cual esta configuración es válida (null = indefinido)';


-- Billing periods
CREATE TABLE "periods" (
	"id" serial NOT NULL UNIQUE,
	"year" int NOT NULL,
	"month" int NOT NULL,
	"period_config_id" int,
	"start_date" date GENERATED ALWAYS AS (make_date(year, month, 1)) STORED,
	"end_date" date GENERATED ALWAYS AS ((make_date(year, month, 1) + interval '1 month - 1 day')::date) STORED,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id"),
	UNIQUE("year", "month")
);

COMMENT ON TABLE "periods" IS 'Períodos de facturación mensuales';
COMMENT ON COLUMN "periods"."period_config_id" IS 'Configuración de montos para este período';
COMMENT ON COLUMN "periods"."start_date" IS 'Primer día del mes (generado automáticamente)';
COMMENT ON COLUMN "periods"."end_date" IS 'Último día del mes (generado automáticamente)';


-- House balances (accumulated cents and credits/debts)
CREATE TABLE "house_balances" (
	"id" serial NOT NULL UNIQUE,
	"house_id" int NOT NULL UNIQUE,
	"accumulated_cents" float NOT NULL DEFAULT 0,
	"credit_balance" float NOT NULL DEFAULT 0,
	"debit_balance" float NOT NULL DEFAULT 0,
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "house_balances" IS 'Balance financiero y centavos acumulados por casa';
COMMENT ON COLUMN "house_balances"."accumulated_cents" IS 'Centavos acumulados de pagos (solo decimales, 0.00 - 0.99). Pendiente definir aplicación automática.';
COMMENT ON COLUMN "house_balances"."credit_balance" IS 'Saldo a favor por pagos adelantados o pagos mayores';
COMMENT ON COLUMN "house_balances"."debit_balance" IS 'Deuda acumulada por pagos incompletos o faltantes';


-- House period overrides (custom amounts per house/period)
CREATE TABLE "house_period_overrides" (
	"id" serial NOT NULL UNIQUE,
	"house_id" int NOT NULL,
	"period_id" int NOT NULL,
	"concept_type" house_period_overrides_concept_type_enum NOT NULL,
	"custom_amount" float NOT NULL,
	"reason" text,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id"),
	UNIQUE("house_id", "period_id", "concept_type")
);

COMMENT ON TABLE "house_period_overrides" IS 'Montos personalizados por casa/período (convenios de pago)';
COMMENT ON COLUMN "house_period_overrides"."concept_type" IS 'Tipo de concepto que se está sobrescribiendo';
COMMENT ON COLUMN "house_period_overrides"."custom_amount" IS 'Monto personalizado para esta casa en este período';
COMMENT ON COLUMN "house_period_overrides"."reason" IS 'Razón del ajuste (ej: convenio de pago, descuento, etc.)';


-- Record allocations (detailed payment distribution)
CREATE TABLE "record_allocations" (
	"id" serial NOT NULL UNIQUE,
	"record_id" int NOT NULL,
	"house_id" int NOT NULL,
	"period_id" int NOT NULL,
	"concept_type" record_allocations_concept_type_enum NOT NULL,
	"concept_id" int NOT NULL,
	"allocated_amount" float NOT NULL,
	"expected_amount" float NOT NULL,
	"payment_status" record_allocations_payment_status_enum NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "record_allocations" IS 'Distribución detallada de pagos entre conceptos';
COMMENT ON COLUMN "record_allocations"."concept_type" IS 'Tipo de concepto al que se aplica el pago';
COMMENT ON COLUMN "record_allocations"."concept_id" IS 'ID del concepto específico (cta_maintenance_id, cta_water_id, etc.)';
COMMENT ON COLUMN "record_allocations"."allocated_amount" IS 'Monto aplicado de este pago a este concepto';
COMMENT ON COLUMN "record_allocations"."expected_amount" IS 'Monto esperado del concepto (sin centavos, siempre entero)';
COMMENT ON COLUMN "record_allocations"."payment_status" IS 'Estado del pago: complete, partial, overpaid';


-- =====================================================
-- CHARGE TRACKING TABLES (CTA - Cuenta del Arrendatario)
-- =====================================================

-- Extraordinary fees
CREATE TABLE "cta_extraordinary_fee" (
	"id" serial NOT NULL UNIQUE,
	"amount" float NOT NULL,
	"period_id" int NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "cta_extraordinary_fee" IS 'Cuotas extraordinarias por período';


-- Maintenance fees
CREATE TABLE "cta_maintenance" (
	"id" serial NOT NULL UNIQUE,
	"amount" float NOT NULL,
	"period_id" int NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "cta_maintenance" IS 'Cuotas de mantenimiento por período';


-- Penalties
CREATE TABLE "cta_penalties" (
	"id" serial NOT NULL UNIQUE,
	"amount" float NOT NULL,
	"period_id" int,
	"description" text,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "cta_penalties" IS 'Penalizaciones y multas';


-- Water charges
CREATE TABLE "cta_water" (
	"id" serial NOT NULL UNIQUE,
	"amount" float NOT NULL,
	"period_id" int NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "cta_water" IS 'Cargos por consumo de agua';


-- Other payments
CREATE TABLE "cta_other_payments" (
	"id" serial NOT NULL UNIQUE,
	"amount" float NOT NULL,
	"pending_confirmation" boolean,
	"description" text,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);

COMMENT ON TABLE "cta_other_payments" IS 'Otros pagos diversos';


-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Houses constraints
ALTER TABLE "houses"
ADD FOREIGN KEY("user_id") REFERENCES "users"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

-- House-Records constraints
ALTER TABLE "house_records"
ADD FOREIGN KEY("house_id") REFERENCES "houses"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "house_records"
ADD FOREIGN KEY("record_id") REFERENCES "records"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

-- Transaction tracking constraints
ALTER TABLE "last_transaction_bank"
ADD FOREIGN KEY("transactions_bank_id") REFERENCES "transactions_bank"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "transactions_status"
ADD FOREIGN KEY("vouchers_id") REFERENCES "vouchers"("id")
ON UPDATE SET NULL ON DELETE SET NULL;

ALTER TABLE "transactions_status"
ADD FOREIGN KEY("transactions_bank_id") REFERENCES "transactions_bank"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

-- Manual validation approvals constraints
ALTER TABLE "manual_validation_approvals"
ADD FOREIGN KEY("transaction_id") REFERENCES "transactions_bank"("id")
ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "manual_validation_approvals"
ADD FOREIGN KEY("voucher_id") REFERENCES "vouchers"("id")
ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "manual_validation_approvals"
ADD FOREIGN KEY("approved_by_user_id") REFERENCES "users"("id")
ON UPDATE CASCADE ON DELETE RESTRICT;

-- Records constraints
ALTER TABLE "records"
ADD FOREIGN KEY("transaction_status_id") REFERENCES "transactions_status"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "records"
ADD FOREIGN KEY("vouchers_id") REFERENCES "vouchers"("id")
ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "records"
ADD FOREIGN KEY("cta_extraordinary_fee_id") REFERENCES "cta_extraordinary_fee"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "records"
ADD FOREIGN KEY("cta_maintenance_id") REFERENCES "cta_maintenance"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "records"
ADD FOREIGN KEY("cta_penalties_id") REFERENCES "cta_penalties"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "records"
ADD FOREIGN KEY("cta_water_id") REFERENCES "cta_water"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "records"
ADD FOREIGN KEY("cta_other_payments_id") REFERENCES "cta_other_payments"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

-- Period-based charge constraints
ALTER TABLE "cta_extraordinary_fee"
ADD FOREIGN KEY("period_id") REFERENCES "periods"("id")
ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE "cta_maintenance"
ADD FOREIGN KEY("period_id") REFERENCES "periods"("id")
ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE "cta_penalties"
ADD FOREIGN KEY("period_id") REFERENCES "periods"("id")
ON UPDATE CASCADE ON DELETE NO ACTION;

ALTER TABLE "cta_water"
ADD FOREIGN KEY("period_id") REFERENCES "periods"("id")
ON UPDATE CASCADE ON DELETE NO ACTION;

-- Payment management constraints
ALTER TABLE "periods"
ADD FOREIGN KEY("period_config_id") REFERENCES "period_config"("id")
ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "house_balances"
ADD FOREIGN KEY("house_id") REFERENCES "houses"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "house_period_overrides"
ADD FOREIGN KEY("house_id") REFERENCES "houses"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "house_period_overrides"
ADD FOREIGN KEY("period_id") REFERENCES "periods"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "record_allocations"
ADD FOREIGN KEY("record_id") REFERENCES "records"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "record_allocations"
ADD FOREIGN KEY("house_id") REFERENCES "houses"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "record_allocations"
ADD FOREIGN KEY("period_id") REFERENCES "periods"("id")
ON UPDATE CASCADE ON DELETE NO ACTION;


-- =====================================================
-- REQUIRED DATA - SYSTEM USER
-- =====================================================
-- IMPORTANTE: Este usuario es requerido para la conciliación bancaria automática
-- Las casas creadas automáticamente (por centavos) se asignan a este usuario
-- hasta que se identifique al propietario real.
--
-- Ver documentación: docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md

INSERT INTO users (id, email, role, status, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  'tenant',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON CONSTRAINT users_pkey ON users IS 'Usuario Sistema (00000000-0000-0000-0000-000000000000) requerido para conciliación bancaria automática';


-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Houses indexes
CREATE INDEX idx_houses_number_house ON houses(number_house);
CREATE INDEX idx_houses_user_id ON houses(user_id);

-- House-Records indexes
CREATE INDEX idx_house_records_house_id ON house_records(house_id);
CREATE INDEX idx_house_records_record_id ON house_records(record_id);
CREATE UNIQUE INDEX idx_house_records_unique ON house_records(house_id, record_id);

-- Transaction indexes
CREATE INDEX idx_transactions_bank_date ON transactions_bank(date DESC)
WHERE is_deposit = true;
CREATE INDEX idx_transactions_bank_date_bank ON transactions_bank(date DESC, bank_name)
WHERE is_deposit = true;
CREATE INDEX idx_transactions_bank_confirmation ON transactions_bank(confirmation_status);
CREATE INDEX idx_transactions_bank_amount ON transactions_bank(amount);
CREATE INDEX idx_transactions_bank_deposits_unconfirmed ON transactions_bank (is_deposit, confirmation_status)
WHERE is_deposit = true AND confirmation_status = false;

-- Voucher indexes
CREATE INDEX idx_vouchers_confirmation_status ON vouchers(confirmation_status)
WHERE confirmation_status = false;
CREATE INDEX idx_vouchers_date ON vouchers(date DESC);
CREATE INDEX idx_vouchers_confirmation ON vouchers(confirmation_status);
CREATE INDEX idx_vouchers_confirmation_code ON vouchers(confirmation_code);

-- Transaction status indexes
CREATE INDEX idx_transactions_status_bank_id ON transactions_status(transactions_bank_id);
CREATE INDEX idx_transactions_status_voucher_id ON transactions_status(vouchers_id);
CREATE INDEX idx_transactions_status_validation_status ON transactions_status(validation_status)
WHERE validation_status IN ('requires-manual', 'not-found', 'conflict');
CREATE INDEX idx_transactions_status_created_at ON transactions_status(created_at DESC);
CREATE INDEX idx_transactions_status_processed_at ON transactions_status(processed_at DESC);
CREATE INDEX idx_transactions_status_validation_processed ON transactions_status(validation_status, processed_at DESC);

-- Manual validation approvals indexes
CREATE INDEX idx_manual_validation_approvals_transaction ON manual_validation_approvals(transaction_id);
CREATE INDEX idx_manual_validation_approvals_user ON manual_validation_approvals(approved_by_user_id);
CREATE INDEX idx_manual_validation_approvals_created ON manual_validation_approvals(approved_at);

-- Records indexes
CREATE INDEX idx_records_transaction_status_id ON records(transaction_status_id);
CREATE INDEX idx_records_vouchers_id ON records(vouchers_id);

-- Period indexes
CREATE INDEX idx_periods_year_month ON periods(year, month);
CREATE INDEX idx_periods_config_id ON periods(period_config_id);

-- Payment management indexes
CREATE INDEX idx_period_config_effective_dates ON period_config(effective_from, effective_until);
CREATE INDEX idx_period_config_active ON period_config(is_active);

CREATE INDEX idx_house_balances_house_id ON house_balances(house_id);

CREATE INDEX idx_house_period_overrides_house_id ON house_period_overrides(house_id);
CREATE INDEX idx_house_period_overrides_period_id ON house_period_overrides(period_id);

CREATE INDEX idx_record_allocations_record_id ON record_allocations(record_id);
CREATE INDEX idx_record_allocations_house_id ON record_allocations(house_id);
CREATE INDEX idx_record_allocations_period_id ON record_allocations(period_id);
CREATE INDEX idx_record_allocations_payment_status ON record_allocations(payment_status);


-- =====================================================
-- TRIGGERS PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- =====================================================
-- Propósito: Mantener sincronizado updated_at en TODAS las operaciones UPDATE
-- Compatible con: TypeORM @UpdateDateColumn() behavior
-- Versión: 1.0 (Añadido en v3.1.0 - Enero 2026)
--
-- Esta función PL/pgSQL se ejecuta ANTES de cada UPDATE y establece updated_at = NOW()
-- Funciona en CUALQUIER tabla que tenga columna updated_at

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers por tabla (BEFORE UPDATE)
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_houses_updated_at
BEFORE UPDATE ON houses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vouchers_updated_at
BEFORE UPDATE ON vouchers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_bank_updated_at
BEFORE UPDATE ON transactions_bank FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_status_updated_at
BEFORE UPDATE ON transactions_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_last_transaction_bank_updated_at
BEFORE UPDATE ON last_transaction_bank FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_records_updated_at
BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_house_records_updated_at
BEFORE UPDATE ON house_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_periods_updated_at
BEFORE UPDATE ON periods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_period_config_updated_at
BEFORE UPDATE ON period_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_house_balances_updated_at
BEFORE UPDATE ON house_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_house_period_overrides_updated_at
BEFORE UPDATE ON house_period_overrides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_record_allocations_updated_at
BEFORE UPDATE ON record_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cta_maintenance_updated_at
BEFORE UPDATE ON cta_maintenance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cta_water_updated_at
BEFORE UPDATE ON cta_water FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cta_penalties_updated_at
BEFORE UPDATE ON cta_penalties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cta_extraordinary_fee_updated_at
BEFORE UPDATE ON cta_extraordinary_fee FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cta_other_payments_updated_at
BEFORE UPDATE ON cta_other_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- DUPLICATE DETECTION TRIGGER (BANK TRANSACTIONS)
-- =====================================================
-- Función para detectar duplicados en transacciones bancarias
-- Implementa las reglas de negocio para ignorar inserciones duplicadas

CREATE OR REPLACE FUNCTION check_transaction_duplicate()
RETURNS TRIGGER AS $$
DECLARE
    last_transaction_record RECORD;
    existing_duplicate_count INTEGER;
BEGIN
    -- 1. Obtener el último registro de last_transaction_bank
    SELECT
        tb.date,
        tb.time,
        tb.concept,
        tb.amount,
        tb.bank_name
    INTO last_transaction_record
    FROM last_transaction_bank ltb
    JOIN transactions_bank tb ON ltb.transactions_bank_id = tb.id
    ORDER BY ltb.created_at DESC
    LIMIT 1;

    -- Si no hay registro de referencia, permitir la inserción
    IF last_transaction_record IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Verificar si el banco es diferente
    -- Si es diferente, permitir todas las inserciones
    IF NEW.bank_name != last_transaction_record.bank_name THEN
        RETURN NEW;
    END IF;

    -- 3. Verificar si la fecha es anterior al último registro
    -- Si es anterior, ignorar la inserción (retornar NULL)
    IF NEW.date < last_transaction_record.date THEN
        RAISE NOTICE 'Ignorando transacción con fecha anterior al último registro procesado. Fecha del registro: %, Última fecha procesada: %',
            NEW.date, last_transaction_record.date;
        RETURN NULL; -- Ignora la inserción sin error
    END IF;

    -- 4. Si la fecha es posterior, permitir la inserción
    IF NEW.date > last_transaction_record.date THEN
        RETURN NEW;
    END IF;

    -- 5. Si la fecha es igual, hacer comparación profunda
    -- Verificar si existe un duplicado exacto en la BD
    SELECT COUNT(*)
    INTO existing_duplicate_count
    FROM transactions_bank
    WHERE date = NEW.date
      AND time = NEW.time
      AND concept = NEW.concept
      AND amount = NEW.amount
      AND bank_name = NEW.bank_name;

    -- Si existe un duplicado exacto, ignorar la inserción (retornar NULL)
    IF existing_duplicate_count > 0 THEN
        RAISE NOTICE 'Ignorando transacción duplicada. Fecha: %, Hora: %, Concepto: %, Monto: %, Banco: %',
            NEW.date, NEW.time, NEW.concept, NEW.amount, NEW.bank_name;
        RETURN NULL; -- Ignora la inserción sin error
    END IF;

    -- Si no es duplicado, permitir la inserción
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger que ejecuta la función antes de cada INSERT
DROP TRIGGER IF EXISTS trigger_check_transaction_duplicate ON transactions_bank;

CREATE TRIGGER trigger_check_transaction_duplicate
    BEFORE INSERT ON transactions_bank
    FOR EACH ROW
    EXECUTE FUNCTION check_transaction_duplicate();

COMMENT ON FUNCTION check_transaction_duplicate() IS 'Detecta y previene transacciones bancarias duplicadas basado en reglas de negocio';
COMMENT ON TRIGGER trigger_check_transaction_duplicate ON transactions_bank IS 'Ejecutado ANTES de INSERT en transactions_bank para detectar duplicados';


-- =====================================================
-- INITIAL DATA - PERIOD CONFIGURATION
-- =====================================================
-- RECOMENDADO: Insertar configuración inicial de períodos
-- Esta configuración se usa para crear períodos automáticamente durante la conciliación

INSERT INTO period_config (
	default_maintenance_amount,
	default_water_amount,
	default_extraordinary_fee_amount,
	payment_due_day,
	late_payment_penalty_amount,
	effective_from,
	is_active
) VALUES (
	800,    -- mantenimiento
	200,    -- agua
	1000,   -- cuota extraordinaria
	10,     -- día límite
	100,    -- multa
	'2025-01-01',  -- efectivo desde
	true    -- activa
)
ON CONFLICT DO NOTHING;


-- =====================================================
-- DATABASE SETUP COMPLETE
-- =====================================================
-- Version: 3.1.0
-- Last Updated: Enero 2026
--
-- Changes in v3.1.0:
-- - Added manual_validation_approvals table for audit trail (3NF normalized)
-- - Manual validation data now stored ONLY in dedicated audit table
-- - Removed redundant fields from transactions_status
-- - Added foreign keys with CASCADE for data integrity
-- - Added performance indexes on manual_validation_approvals
-- - Added update_updated_at_column() trigger for automatic timestamp management (17 tables)
--   * Ensures updated_at is synchronized in all UPDATE operations
--   * Compatible with TypeORM @UpdateDateColumn() behavior
--   * Works for both ORM and direct SQL operations
--
-- Changes in v3.0.0:
-- - Added payment management tables: period_config, house_balances,
--   house_period_overrides, record_allocations
-- - Modified periods table to include period_config_id
-- - Added new enums for payment management
-- - Added indexes for performance optimization
-- - Added initial period configuration data
--
-- Next steps:
-- 1. Verify system user was created:
--    SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000';
-- 2. Verify manual validation setup:
--    SELECT * FROM manual_validation_approvals LIMIT 1;
-- 3. Verify initial period configuration:
--    SELECT * FROM period_config WHERE is_active = true;
-- 4. Review documentation:
--    - docs/features/bank-reconciliation/
--    - docs/features/bank-reconciliation/ARCHITECTURE.md (3NF normalization)
--    - docs/features/payment-management/
-- 5. Configure environment variables (.env)
-- 6. Run application migrations if using TypeORM sync: false
-- =====================================================
