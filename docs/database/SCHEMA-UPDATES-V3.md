# Database Schema Updates - Version 3.0 & 3.1

## 📋 Resumen General

Este documento detalla las actualizaciones realizadas al esquema de base de datos desde **v2.0** hacia **v3.0** y **v3.1**, introduciendo el sistema de **gestión de pagos por período** y **validación manual de transacciones con auditoría**.

---

## 🆕 Version 3.0.0 - Payment Management System

**Fecha de liberación:** Noviembre 2025
**Cambio principal:** Implementación de sistema completo de gestión de pagos por período

### Nuevas Tablas

#### 1. `periods`
Tabla que define períodos de facturación con generación automática de fechas.

```sql
CREATE TABLE periods (
    id              SERIAL PRIMARY KEY,
    year            INT NOT NULL,
    month           INT NOT NULL,
    start_date      DATE GENERATED ALWAYS AS (date_trunc('month', make_date(year, month, 1))::date) STORED,
    end_date        DATE GENERATED ALWAYS AS ((date_trunc('month', make_date(year, month, 1)) + interval '1 month' - interval '1 day')::date) STORED,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_periods_year_month ON periods(year, month);
```

**Propósito:**
- Definir períodos mensuales de facturación
- Generar automáticamente fechas de inicio y fin
- Base para asociar montos por concepto

**Cambios importantes:**
- ✅ Índice único en (year, month) para prevenir duplicados
- ✅ Fechas generadas automáticamente (no editables)
- ✅ Timestamps de auditoría

---

#### 2. `period_configs`
Tabla de configuración global de montos por concepto por período.

```sql
CREATE TABLE period_configs (
    id                  SERIAL PRIMARY KEY,
    period_id           INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    concept_type        VARCHAR(50) NOT NULL,
    default_amount      FLOAT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_period_configs_period_concept ON period_configs(period_id, concept_type);
```

**Propósito:**
- Configurar montos globales por período
- Un registro por concepto por período
- Facilita cambios de montos entre períodos

**Conceptos permitidos:**
- `maintenance`: Cuota ordinaria
- `water`: Agua
- `extraordinary_fee`: Cuota extraordinaria

---

#### 3. `house_balances`
Tabla que mantiene los saldos acumulados de cada casa.

```sql
CREATE TABLE house_balances (
    id              SERIAL PRIMARY KEY,
    house_id        INT NOT NULL UNIQUE REFERENCES houses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    accumulated_cents FLOAT DEFAULT 0,
    credit_balance  FLOAT DEFAULT 0,
    debit_balance   FLOAT DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

**Propósito:**
- Rastrear saldos acumulados por casa
- Mantener centavos para aplicar después
- Registrar créditos y deudas

**Campos:**
- `accumulated_cents`: Centavos (0.00-0.99) acumulados de pagos
- `credit_balance`: Saldo a favor (pagos adelantados)
- `debit_balance`: Deuda acumulada (pagos incompletos)

**Relación:**
- Relación **OneToOne** con `houses` (una casa = un balance)

---

#### 4. `house_period_overrides`
Tabla para montos personalizados por casa/período (convenios de pago, descuentos).

```sql
CREATE TABLE house_period_overrides (
    id              SERIAL PRIMARY KEY,
    house_id        INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    period_id       INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE ON UPDATE CASCADE,
    concept_type    VARCHAR(50) NOT NULL,
    custom_amount   FLOAT NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_house_period_overrides_unique ON house_period_overrides(house_id, period_id, concept_type);
```

**Propósito:**
- Implementar convenios de pago personalizados
- Aplicar descuentos por casa
- Rastrear razón del cambio

**Ejemplo de uso:**
```sql
-- Casa 42, período Nov 2024, mantenimiento reducido a $50,000 (convenio)
INSERT INTO house_period_overrides (house_id, period_id, concept_type, custom_amount, reason)
VALUES (42, 1, 'maintenance', 50000, 'Convenio de pago aprobado - 6 meses');
```

---

#### 5. `record_allocations`
Tabla que registra la distribución detallada de pagos a conceptos y períodos.

```sql
CREATE TABLE record_allocations (
    id              SERIAL PRIMARY KEY,
    record_id       INT NOT NULL REFERENCES records(id) ON DELETE CASCADE ON UPDATE CASCADE,
    house_id        INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    period_id       INT NOT NULL REFERENCES periods(id) ON DELETE NO ACTION ON UPDATE CASCADE,
    concept_type    VARCHAR(50) NOT NULL,
    concept_id      INT NOT NULL,
    allocated_amount FLOAT NOT NULL,
    expected_amount FLOAT NOT NULL,
    payment_status  VARCHAR(50) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_record_allocations_record_id ON record_allocations(record_id);
CREATE INDEX idx_record_allocations_house_id ON record_allocations(house_id);
CREATE INDEX idx_record_allocations_period_id ON record_allocations(period_id);
```

**Propósito:**
- Rastrear cómo se distribuyen los pagos
- Detectar pagos incompletos
- Mantener auditoría de pagos

**Campos importantes:**
- `allocated_amount`: Dinero aplicado a este concepto
- `expected_amount`: Dinero esperado del concepto
- `payment_status`: COMPLETE, PARTIAL, o OVERPAID

---

#### 6. CTA Tables (Concept Tables)

Cinco tablas que definen los ítems de pago:

```sql
CREATE TABLE cta_maintenance (...);
CREATE TABLE cta_water (...);
CREATE TABLE cta_extraordinary_fee (...);
CREATE TABLE cta_penalties (...);
CREATE TABLE cta_other_payments (...);
```

**Propósito:**
- Centralizar definición de conceptos
- Permitir descripciones detalladas
- Facilitar auditoría

---

### Cambios en Tablas Existentes (v3.0)

#### `periods` (si existía en v2.0)
**Cambio:** Se agregan relaciones bidireccionales en TypeORM

```typescript
// Antes:
periods: Period[] // solo array

// Después:
@OneToMany(() => PeriodConfig, config => config.period)
periodConfigs: PeriodConfig[];

@OneToMany(() => HousePeriodOverride, override => override.period)
housePeriodOverrides: HousePeriodOverride[];

@OneToMany(() => RecordAllocation, allocation => allocation.period)
recordAllocations: RecordAllocation[];
```

#### `houses`
**Cambio:** Se agregan relaciones para payment management

```typescript
@OneToOne(() => HouseBalance, balance => balance.house)
houseBalance: HouseBalance;

@OneToMany(() => HousePeriodOverride, override => override.house)
housePeriodOverrides: HousePeriodOverride[];

@OneToMany(() => RecordAllocation, allocation => allocation.house)
recordAllocations: RecordAllocation[];
```

---

### Nuevos ENUM Types (v3.0)

#### AllocationConceptType
```sql
CREATE TYPE allocation_concept_type AS ENUM (
    'maintenance',
    'water',
    'extraordinary_fee',
    'penalties',
    'other'
);
```

#### PaymentStatus
```sql
CREATE TYPE payment_status AS ENUM (
    'complete',
    'partial',
    'overpaid'
);
```

#### ConceptType
```sql
CREATE TYPE concept_type AS ENUM (
    'maintenance',
    'water',
    'extraordinary_fee'
);
```

---

### 🔄 Migración desde v2.0 a v3.0

#### Paso 1: Crear tabla periods
```sql
CREATE TABLE periods (
    id              SERIAL PRIMARY KEY,
    year            INT NOT NULL,
    month           INT NOT NULL,
    start_date      DATE GENERATED ALWAYS AS (date_trunc('month', make_date(year, month, 1))::date) STORED,
    end_date        DATE GENERATED ALWAYS AS ((date_trunc('month', make_date(year, month, 1)) + interval '1 month' - interval '1 day')::date) STORED,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_periods_year_month ON periods(year, month);
```

#### Paso 2: Crear tabla period_configs
```sql
CREATE TABLE period_configs (
    id                  SERIAL PRIMARY KEY,
    period_id           INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    concept_type        VARCHAR(50) NOT NULL,
    default_amount      FLOAT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_period_configs_period_concept ON period_configs(period_id, concept_type);
```

#### Paso 3: Crear tabla house_balances
```sql
CREATE TABLE house_balances (
    id              SERIAL PRIMARY KEY,
    house_id        INT NOT NULL UNIQUE REFERENCES houses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    accumulated_cents FLOAT DEFAULT 0,
    credit_balance  FLOAT DEFAULT 0,
    debit_balance   FLOAT DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

#### Paso 4: Crear tabla house_period_overrides
```sql
CREATE TABLE house_period_overrides (
    id              SERIAL PRIMARY KEY,
    house_id        INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    period_id       INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE ON UPDATE CASCADE,
    concept_type    VARCHAR(50) NOT NULL,
    custom_amount   FLOAT NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_house_period_overrides_unique ON house_period_overrides(house_id, period_id, concept_type);
```

#### Paso 5: Crear tabla record_allocations
```sql
CREATE TABLE record_allocations (
    id              SERIAL PRIMARY KEY,
    record_id       INT NOT NULL REFERENCES records(id) ON DELETE CASCADE ON UPDATE CASCADE,
    house_id        INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    period_id       INT NOT NULL REFERENCES periods(id) ON DELETE NO ACTION ON UPDATE CASCADE,
    concept_type    VARCHAR(50) NOT NULL,
    concept_id      INT NOT NULL,
    allocated_amount FLOAT NOT NULL,
    expected_amount FLOAT NOT NULL,
    payment_status  VARCHAR(50) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_record_allocations_record_id ON record_allocations(record_id);
CREATE INDEX idx_record_allocations_house_id ON record_allocations(house_id);
CREATE INDEX idx_record_allocations_period_id ON record_allocations(period_id);
```

#### Paso 6: Crear CTA tables
```sql
CREATE TABLE cta_maintenance (
    id              SERIAL PRIMARY KEY,
    period_id       INT NOT NULL REFERENCES periods(id),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Repetir para cta_water, cta_extraordinary_fee, cta_penalties, cta_other_payments
```

#### Paso 7: Crear ENUM types
```sql
CREATE TYPE allocation_concept_type AS ENUM ('maintenance', 'water', 'extraordinary_fee', 'penalties', 'other');
CREATE TYPE payment_status AS ENUM ('complete', 'partial', 'overpaid');
CREATE TYPE concept_type AS ENUM ('maintenance', 'water', 'extraordinary_fee');
```

#### Paso 8: Registrar entidades en TypeORM
Actualizar `database.module.ts`:
```typescript
TypeOrmModule.forFeature([
  // ... existing entities ...
  Period,
  PeriodConfig,
  HouseBalance,
  HousePeriodOverride,
  RecordAllocation,
  CtaMaintenance,
  CtaWater,
  CtaExtraordinaryFee,
  CtaPenalties,
  CtaOtherPayments,
])
```

---

## 🆕 Version 3.1.0 - Manual Validation Audit Trail

**Fecha de liberación:** Noviembre 2025
**Cambio principal:** Implementación de sistema de validación manual con auditoría completa

### Nueva Tabla

#### `manual_validation_approvals`
Tabla de auditoría para transacciones que requieren validación manual.

```sql
CREATE TABLE manual_validation_approvals (
    id                      SERIAL PRIMARY KEY,
    transaction_id          BIGINT NOT NULL REFERENCES transactions_bank(id),
    voucher_id              BIGINT REFERENCES vouchers(id),
    approved_by_user_id     UUID NOT NULL REFERENCES users(id),
    reconciliation_status   VARCHAR(50) NOT NULL,
    reconciliation_notes    TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_manual_validation_transaction_id ON manual_validation_approvals(transaction_id);
CREATE INDEX idx_manual_validation_voucher_id ON manual_validation_approvals(voucher_id);
```

**Propósito:**
- Registrar todas las validaciones manuales
- Mantener auditoría de decisiones
- Rastrear quién aprobó qué y cuándo

**Campos:**
- `transaction_id`: FK a transacción bancaria
- `voucher_id`: FK a voucher (si existe)
- `approved_by_user_id`: Usuario que aprobó (auditoría)
- `reconciliation_status`: Resultado de validación
- `reconciliation_notes`: Notas del validador

---

### Cambios en Tablas Existentes (v3.1)

#### `users`
**Cambio:** Se agrega relación para validaciones manuales

```typescript
@OneToMany(() => ManualValidationApproval, approval => approval.approvedByUser)
manualValidationApprovals: ManualValidationApproval[];
```

#### `transactions_bank`
**Cambio:** Se agrega relación para validaciones manuales

```typescript
@OneToMany(() => ManualValidationApproval, approval => approval.transactionBank)
manualValidationApprovals: ManualValidationApproval[];
```

#### `vouchers`
**Cambio:** Se agrega relación para validaciones manuales

```typescript
@OneToMany(() => ManualValidationApproval, approval => approval.voucher)
manualValidationApprovals: ManualValidationApproval[];
```

---

### Type Corrections (v3.1)

#### transaction_status.transactions_bank_id
**Antes:**
```typescript
@Column({ type: 'bigint', nullable: true })
transactions_bank_id: string; // ❌ INCORRECTO
```

**Después:**
```typescript
@Column({ type: 'bigint', nullable: true })
transactions_bank_id: number; // ✅ CORRECTO
```

**Impacto:** Corrección de type-safety, mejora de compilación TypeScript

#### manual_validation_approval.transaction_id
**Antes:**
```typescript
@Column({ type: 'varchar' })
transaction_id: string; // ❌ INCORRECTO
```

**Después:**
```typescript
@Column({ type: 'bigint' })
transaction_id: number; // ✅ CORRECTO
```

**Impacto:** Corrección de type-safety, mejora de performance (índice BIGINT más eficiente)

#### voucher.date
**Antes:**
```typescript
@Column({ type: 'timestamp' })
date: Date; // ⚠️ Sin timezone
```

**Después:**
```typescript
@Column({ type: 'timestamptz' })
date: Date; // ✅ Con timezone
```

**Impacto:** Mejor manejo de zonas horarias en operaciones internacionales

---

### 🔄 Migración desde v3.0 a v3.1

#### Paso 1: Crear tabla manual_validation_approvals
```sql
CREATE TABLE manual_validation_approvals (
    id                      SERIAL PRIMARY KEY,
    transaction_id          BIGINT NOT NULL REFERENCES transactions_bank(id),
    voucher_id              BIGINT REFERENCES vouchers(id),
    approved_by_user_id     UUID NOT NULL REFERENCES users(id),
    reconciliation_status   VARCHAR(50) NOT NULL,
    reconciliation_notes    TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_manual_validation_transaction_id ON manual_validation_approvals(transaction_id);
CREATE INDEX idx_manual_validation_voucher_id ON manual_validation_approvals(voucher_id);
```

#### Paso 2: Corregir transaction_status.transactions_bank_id
```sql
-- No requiere cambios en SQL (ya es BIGINT)
-- Solo actualizar TypeScript types en transaction-status.entity.ts
```

#### Paso 3: Corregir voucher.date
```sql
-- Cambiar de TIMESTAMP a TIMESTAMPTZ
ALTER TABLE vouchers
ALTER COLUMN date TYPE TIMESTAMPTZ;
```

#### Paso 4: Actualizar TypeORM entities
- Actualizar imports de enums en: `record-allocation.entity.ts`, `house-period-override.entity.ts`
- Mover enums a `enums.ts` centralizado
- Agregar relaciones bidireccionales a entidades existentes

#### Paso 5: Compilar y verificar
```bash
npm run build
```

---

## 📊 Índices por Versión

### v3.0 - Índices de Payment Management
- `idx_periods_year_month`: Previene períodos duplicados
- `idx_period_configs_period_concept`: Previene configuraciones duplicadas
- `idx_house_period_overrides_unique`: Previene overrides duplicados
- `idx_record_allocations_record_id`: Optimiza búsquedas por registro
- `idx_record_allocations_house_id`: Optimiza búsquedas por casa
- `idx_record_allocations_period_id`: Optimiza búsquedas por período

### v3.1 - Índices de Validación Manual
- `idx_manual_validation_transaction_id`: Búsquedas por transacción
- `idx_manual_validation_voucher_id`: Búsquedas por voucher

---

## 📈 Cambios de Schema Summary

| Aspecto | v2.0 | v3.0 | v3.1 |
|---------|------|------|------|
| Tablas principales | 15 | 21 | 22 |
| Payment Management | ❌ | ✅ | ✅ |
| Manual Validation | ❌ | ❌ | ✅ |
| ENUM types | 3 | 6 | 6 |
| Índices | 20+ | 26+ | 28+ |

---

## ✅ Verificación Post-Migración

### Verificar v3.0
```sql
-- Períodos creados
SELECT COUNT(*) FROM periods;

-- Configuraciones por período
SELECT COUNT(*) FROM period_configs;

-- Saldos de casas
SELECT COUNT(*) FROM house_balances;

-- Overrides aplicados
SELECT COUNT(*) FROM house_period_overrides;

-- Asignaciones de pago
SELECT COUNT(*) FROM record_allocations;
```

### Verificar v3.1
```sql
-- Validaciones manuales
SELECT COUNT(*) FROM manual_validation_approvals;

-- Verificar tipos correctos
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'manual_validation_approvals';

-- Verificar voucher dates con timezone
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'vouchers' AND column_name = 'date';
```

---

## 🚀 Base de Datos Fresca (v3.1)

Si estás creando una base de datos desde cero:

```bash
# Ejecutar el script completo que incluye v3.0 y v3.1
psql -h localhost -U postgres -d agave_db < bd_initial.sql
```

El script crea automáticamente:
- ✅ Todos los tipos ENUM (v3.0 y v3.1)
- ✅ Todas las tablas payment management (v3.0)
- ✅ Todas las tablas de validación manual (v3.1)
- ✅ Todas las foreign keys con cascade policies
- ✅ Todos los índices recomendados
- ✅ Comentarios en tablas/columnas

---

## 📚 Documentación Relacionada

- **Schema Completo:** `docs/database/schema.md` (v3.1)
- **Payment Management:** `docs/database/payment-management.md`
- **Conciliación Bancaria:** `docs/features/bank-reconciliation/`
- **Validación Manual:** `docs/features/bank-reconciliation/manual-validation.md`

---

## 🔧 Troubleshooting

### Error: "relation periods does not exist"
**Solución:** Crear tabla periods antes de usar payment management
```bash
# Ejecutar migración de v3.0
npm run db:migrate
```

### Error: "type allocation_concept_type does not exist"
**Solución:** Crear ENUMs antes de tablas
```bash
# Ejecutar script de inicialización completo
psql -h localhost -U postgres -d agave_db < bd_initial.sql
```

### Error: "column transaction_bank_id type mismatch"
**Solución:** Actualizar TypeORM entities a v3.1
```bash
npm run build
```

---

**Última actualización:** Noviembre 2025
**Versión del esquema:** 3.1.0
**Estado:** Producción (✅ Sincronizado con TypeORM y DBML)
