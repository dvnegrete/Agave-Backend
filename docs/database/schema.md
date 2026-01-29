# Database Schema

## Overview

Este documento describe el esquema de base de datos completo del sistema Agave **versión 3.1.0**, incluyendo:
- Transacciones bancarias y vouchers
- Usuarios y casas con autenticación Firebase
- Sistema de gestión de pagos por período (Payment Management v3.0+)
- Sistema de validación manual con auditoría (v3.1)
- Verificación de email para usuarios (Email Verification)

**Última actualización**: Enero 2026
**Versión del esquema**: 3.1.0
**Autenticación**: Firebase Auth con OAuth2 y email/password
**Total de tablas**: 21
**Total de ENUMs**: 6

## Core Tables

### Vouchers & Houses Module

#### users
Tabla de usuarios del sistema con autenticación Firebase.

```sql
CREATE TABLE users (
    id                  VARCHAR(128) PRIMARY KEY,
    role                role_t NOT NULL DEFAULT 'tenant',
    status              status_t NOT NULL DEFAULT 'active',
    name                VARCHAR(255),
    email               VARCHAR(255),
    cel_phone           NUMERIC,
    avatar              TEXT,
    last_login          TIMESTAMPTZ,
    email_verified      BOOLEAN NOT NULL DEFAULT false,
    email_verified_at   TIMESTAMPTZ,
    observations        TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);
```

**Columnas Principales:**
- `id`: VARCHAR(128) primario - Soporta Firebase UIDs (28 caracteres) y UUIDs legacy (36 caracteres)
- `role`: Rol del usuario (admin, owner, tenant)
- `status`: Estado de la cuenta (active, suspend, inactive)
- `email`: Correo electrónico del usuario
- `cel_phone`: Número de teléfono internacional (NUMERIC)
- `avatar`: URL del avatar del usuario
- `last_login`: Último login registrado
- `email_verified`: Booleano indicando si el email fue verificado (requerido para email/password signin)
- `email_verified_at`: Timestamp de cuando se verificó el email (nullable)
- `observations`: Notas sobre el usuario

**Notas sobre Autenticación:**
- **Firebase Auth:** Proporciona autenticación con email/password y OAuth (Google, Facebook, etc.)
- **Email Verification:**
  - Email/Password: Requiere verificación antes de permitir signin
  - OAuth: Se marca como verificado automáticamente (OAuth provider ya lo verificó)
- **ID Type Change:** Cambiado de `UUID` (Supabase) a `VARCHAR(128)` para soportar Firebase UIDs

#### houses
Tabla de casas/propiedades en el sistema.

```sql
CREATE TABLE houses (
    id              SERIAL PRIMARY KEY,
    number_house    INT UNIQUE NOT NULL,
    user_id         VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_houses_user_id ON houses(user_id);
CREATE INDEX idx_houses_number_house ON houses(number_house);
```

**Columnas Principales:**
- `id`: PK autogenerada (permite múltiples registros por casa)
- `number_house`: Número único de casa/propiedad
- `user_id`: Propietario actual (puede cambiar con el tiempo)

#### vouchers
Tabla de comprobantes de pago enviados por usuarios (OCR procesado).

```sql
CREATE TABLE vouchers (
    id                      SERIAL PRIMARY KEY,
    date                    TIMESTAMPTZ NOT NULL,
    authorization_number    VARCHAR(255),
    confirmation_code       VARCHAR(20) UNIQUE,
    amount                  FLOAT NOT NULL,
    confirmation_status     BOOLEAN DEFAULT false,
    url                     TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vouchers_date ON vouchers(date);
CREATE INDEX idx_vouchers_confirmation_status ON vouchers(confirmation_status);
CREATE INDEX idx_vouchers_confirmation_code ON vouchers(confirmation_code);
```

**Columnas Principales:**
- `date`: Fecha y hora del comprobante
- `authorization_number`: Número de autorización del pago
- `confirmation_code`: Código único generado para el comprobante
- `amount`: Monto del pago
- `confirmation_status`: Estado de confirmación
- `url`: URL del archivo en Google Cloud Storage (se elimina tras conciliación)

#### records
Tabla central que relaciona pagos con estados de transacción y conceptos.

```sql
CREATE TABLE records (
    id                          SERIAL PRIMARY KEY,
    transaction_status_id       INT REFERENCES transactions_status(id) ON DELETE CASCADE,
    vouchers_id                 INT REFERENCES vouchers(id) ON DELETE SET NULL,
    cta_extraordinary_fee_id    INT REFERENCES cta_extraordinary_fee(id) ON DELETE CASCADE,
    cta_maintenance_id          INT REFERENCES cta_maintenance(id) ON DELETE CASCADE,
    cta_penalties_id            INT REFERENCES cta_penalties(id) ON DELETE CASCADE,
    cta_water_id                INT REFERENCES cta_water(id) ON DELETE CASCADE,
    cta_other_payments_id       INT REFERENCES cta_other_payments(id) ON DELETE CASCADE,
    created_at                  TIMESTAMPTZ DEFAULT now(),
    updated_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_records_transaction_status_id ON records(transaction_status_id);
CREATE INDEX idx_records_vouchers_id ON records(vouchers_id);
```

**Columnas Principales:**
- `transaction_status_id`: FK a estado de validación de transacción
- `vouchers_id`: FK al voucher asociado (nullable para conciliaciones automáticas)
- `cta_*_id`: FKs a los conceptos de cargo (maintenance, water, penalties, extraordinary_fee, other)

#### house_records
**🆕 Tabla intermedia** que permite múltiples registros (pagos) por casa.

```sql
CREATE TABLE house_records (
    id          SERIAL PRIMARY KEY,
    house_id    INT REFERENCES houses(id) ON DELETE CASCADE,
    record_id   INT REFERENCES records(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT now(),
    updated_at  TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_house_records_house_id ON house_records(house_id);
CREATE INDEX idx_house_records_record_id ON house_records(record_id);
CREATE UNIQUE INDEX idx_house_records_unique ON house_records(house_id, record_id);
```

**Propósito:**
- Permite que una casa tenga múltiples pagos (records)
- Permite que un usuario tenga múltiples casas
- Mantiene historial completo de pagos por casa
- Soporta cambio de propietario sin perder historial

**Relaciones:**
```
users (1) ──→ (N) houses (1) ──→ (N) house_records (N) ──→ (1) records (1) ──→ (1) vouchers
```

### Payment Management Module (v3.0+)

#### periods
Tabla que define períodos de facturación (mensual, trimestral, etc.) con generación automática de fechas.

```sql
CREATE TABLE periods (
    id              SERIAL PRIMARY KEY,
    year            INT NOT NULL,
    month           INT NOT NULL,
    period_config_id INT REFERENCES period_config(id),
    start_date      DATE GENERATED ALWAYS AS (make_date(year, month, 1)) STORED,
    end_date        DATE GENERATED ALWAYS AS ((make_date(year, month, 1) + interval '1 month - 1 day')::date) STORED,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_periods_year_month ON periods(year, month);
CREATE INDEX idx_periods_config_id ON periods(period_config_id);
```

**Columnas Principales:**
- `id`: Identificador único del período
- `year`: Año del período (ej: 2024)
- `month`: Mes del período (1-12)
- `start_date`: Fecha generada automáticamente del primer día del mes
- `end_date`: Fecha generada automáticamente del último día del mes

#### period_config
Tabla de configuración versionada de montos por período (reglas de pago globales).

```sql
CREATE TABLE period_config (
    id                                  SERIAL PRIMARY KEY,
    default_maintenance_amount          FLOAT NOT NULL DEFAULT 800,
    default_water_amount                FLOAT DEFAULT 200,
    default_extraordinary_fee_amount    FLOAT DEFAULT 1000,
    payment_due_day                     INT NOT NULL DEFAULT 10,
    late_payment_penalty_amount         FLOAT NOT NULL DEFAULT 100,
    effective_from                      DATE NOT NULL,
    effective_until                     DATE,
    is_active                           BOOLEAN NOT NULL DEFAULT true,
    created_at                          TIMESTAMPTZ DEFAULT now(),
    updated_at                          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_period_config_effective_dates ON period_config(effective_from, effective_until);
CREATE INDEX idx_period_config_active ON period_config(is_active);
```

**Columnas Principales:**
- `default_maintenance_amount`: Monto por defecto de mantenimiento
- `default_water_amount`: Monto por defecto de agua
- `default_extraordinary_fee_amount`: Monto por defecto de cuota extraordinaria
- `payment_due_day`: Día límite de pago del mes
- `late_payment_penalty_amount`: Penalidad por pago tardío
- `effective_from`: Fecha desde la cual esta configuración es válida
- `effective_until`: Fecha hasta la cual es válida (NULL = indefinido)
- `is_active`: Indica si esta configuración está activa

#### house_balances
Tabla que mantiene los saldos acumulados de cada casa (centavos, saldo a favor, deuda).

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

**Columnas Principales:**
- `house_id`: FK única a house (relación OneToOne)
- `accumulated_cents`: Centavos acumulados de pagos (0.00 - 0.99)
- `credit_balance`: Saldo a favor por pagos adelantados
- `debit_balance`: Deuda acumulada por pagos incompletos

#### house_period_overrides
Tabla que permite montos personalizados por casa/período (convenios de pago, descuentos).

```sql
CREATE TABLE house_period_overrides (
    id              SERIAL PRIMARY KEY,
    house_id        INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
    period_id       INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    concept_type    house_period_overrides_concept_type_enum NOT NULL,
    custom_amount   FLOAT NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_house_period_overrides_unique ON house_period_overrides(house_id, period_id, concept_type);
CREATE INDEX idx_house_period_overrides_house_id ON house_period_overrides(house_id);
CREATE INDEX idx_house_period_overrides_period_id ON house_period_overrides(period_id);
```

**Columnas Principales:**
- `house_id`: FK a house
- `period_id`: FK a period
- `concept_type`: Tipo de concepto a sobrescribir (maintenance, water, extraordinary_fee)
- `custom_amount`: Monto personalizado para esta casa en este período
- `reason`: Razón del ajuste (ej: convenio, descuento)

#### record_allocations
Tabla que registra la distribución detallada de pagos a conceptos y períodos.

```sql
CREATE TABLE record_allocations (
    id              SERIAL PRIMARY KEY,
    record_id       INT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    house_id        INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
    period_id       INT NOT NULL REFERENCES periods(id) ON DELETE NO ACTION,
    concept_type    record_allocations_concept_type_enum NOT NULL,
    concept_id      INT NOT NULL,
    allocated_amount FLOAT NOT NULL,
    expected_amount FLOAT NOT NULL,
    payment_status  record_allocations_payment_status_enum NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_record_allocations_record_id ON record_allocations(record_id);
CREATE INDEX idx_record_allocations_house_id ON record_allocations(house_id);
CREATE INDEX idx_record_allocations_period_id ON record_allocations(period_id);
CREATE INDEX idx_record_allocations_payment_status ON record_allocations(payment_status);
```

**Columnas Principales:**
- `record_id`: FK al registro de pago
- `house_id`: FK a la casa
- `period_id`: FK al período
- `concept_type`: Tipo de concepto (maintenance, water, extraordinary_fee, penalties, other)
- `concept_id`: ID del concepto específico (relaciona con tabla CTA)
- `allocated_amount`: Monto aplicado del pago
- `expected_amount`: Monto esperado del concepto
- `payment_status`: Estado del pago (complete, partial, overpaid)
- `created_at` y `updated_at`: Auditoría de cambios

#### CTA Tables (Concept Tables)
Tablas que definen los conceptos/ítems de pago.

```sql
CREATE TABLE cta_maintenance (
    id              SERIAL PRIMARY KEY,
    period_id       INT NOT NULL REFERENCES periods(id),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cta_water (
    id              SERIAL PRIMARY KEY,
    period_id       INT NOT NULL REFERENCES periods(id),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cta_extraordinary_fee (
    id              SERIAL PRIMARY KEY,
    period_id       INT NOT NULL REFERENCES periods(id),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cta_penalties (
    id              SERIAL PRIMARY KEY,
    period_id       INT NOT NULL REFERENCES periods(id),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cta_other_payments (
    id              SERIAL PRIMARY KEY,
    period_id       INT NOT NULL REFERENCES periods(id),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

#### manual_validation_approvals
Tabla de auditoría para validaciones manuales de transacciones (v3.1+) - **ÚNICA FUENTE DE VERDAD** para aprobaciones.

```sql
CREATE TABLE manual_validation_approvals (
    id                      SERIAL PRIMARY KEY,
    transaction_id          BIGINT NOT NULL REFERENCES transactions_bank(id) ON DELETE RESTRICT,
    voucher_id              INT REFERENCES vouchers(id) ON DELETE SET NULL,
    approved_by_user_id     VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approval_notes          TEXT,
    rejection_reason        TEXT,
    approved_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_validation_approvals_transaction ON manual_validation_approvals(transaction_id);
CREATE INDEX idx_manual_validation_approvals_user ON manual_validation_approvals(approved_by_user_id);
CREATE INDEX idx_manual_validation_approvals_created ON manual_validation_approvals(approved_at);
```

**Columnas Principales:**
- `transaction_id`: FK a la transacción bancaria revisada
- `voucher_id`: FK al voucher elegido (NULL si fue rechazado)
- `approved_by_user_id`: FK al usuario que aprobó/rechazó
- `approval_notes`: Notas opcionales del operador
- `rejection_reason`: Razón específica del rechazo (si aplica)
- `approved_at`: Timestamp de la aprobación/rechazo (CreateDateColumn, no editable)

### Transactions Bank Module

### transactions_bank

Tabla principal que almacena todas las transacciones bancarias procesadas.

```sql
CREATE TABLE transactions_bank (
    id                  BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    date               DATE NOT NULL,
    time               TIME NOT NULL,
    concept            VARCHAR(225),
    amount             FLOAT NOT NULL,
    is_deposit         BOOLEAN NOT NULL COMMENT 'true=depósito, false=retiro',
    currency           VARCHAR(255),
    bank_name          TEXT,
    confirmation_status BOOLEAN DEFAULT false,
    created_at         TIMESTAMP DEFAULT now(),
    updated_at         TIMESTAMP DEFAULT now()
);
```

#### Columnas Principales

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `BIGINT` | Identificador único auto-incremental |
| `date` | `DATE` | Fecha de la transacción |
| `time` | `TIME` | Hora de la transacción |
| `concept` | `VARCHAR(225)` | Concepto/descripción de la transacción |
| `amount` | `FLOAT` | Monto de la transacción |
| `is_deposit` | `BOOLEAN` | `true` para depósitos, `false` para retiros |
| `currency` | `VARCHAR(255)` | Moneda de la transacción (ej: COP, USD) |
| `bank_name` | `TEXT` | Nombre del banco origen |
| `confirmation_status` | `BOOLEAN` | Estado de confirmación (default: `false`) |
| `created_at` | `TIMESTAMP` | Fecha de creación del registro |
| `updated_at` | `TIMESTAMP` | Fecha de última actualización |

### last_transaction_bank

Tabla de control que mantiene referencia a las últimas transacciones procesadas por banco.

```sql
CREATE TABLE last_transaction_bank (
    id                   INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    transactions_bank_id BIGINT REFERENCES transactions_bank(id) ON DELETE CASCADE,
    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now()
);
```

#### Relaciones

- `transactions_bank_id` → `transactions_bank.id` (FK con CASCADE)

#### Propósito

Esta tabla permite:
- Rastrear la última transacción procesada por banco
- Implementar lógica de detección de duplicados
- Optimizar el procesamiento incremental de archivos

## Indexes

### Primary Indexes

- `transactions_bank.id` (PRIMARY KEY)
- `last_transaction_bank.id` (PRIMARY KEY)

### Custom Indexes

#### idx_transactions_bank_deposits_unconfirmed

Índice parcial para optimizar consultas de depósitos no confirmados:

```sql
CREATE INDEX idx_transactions_bank_deposits_unconfirmed
ON transactions_bank (is_deposit, confirmation_status)
WHERE is_deposit = true AND confirmation_status = false;
```

**Optimiza:**
- Consultas de depósitos pendientes de confirmación
- Reportes de transacciones no validadas
- Procesos de reconciliación

**Beneficios:**
- Solo indexa registros relevantes (índice parcial)
- Reduce significativamente el tamaño del índice
- Mejora performance en consultas frecuentes

## Triggers (v3.1.0)

### update_updated_at_column()

Función PL/pgSQL que actualiza automáticamente la columna `updated_at` cada vez que se ejecuta un UPDATE en cualquier tabla.

**Función:**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Triggers Implementados (18 tablas):**
1. `users` - BEFORE UPDATE
2. `houses` - BEFORE UPDATE
3. `vouchers` - BEFORE UPDATE
4. `transactions_bank` - BEFORE UPDATE
5. `transactions_status` - BEFORE UPDATE
6. `last_transaction_bank` - BEFORE UPDATE
7. `records` - BEFORE UPDATE
8. `house_records` - BEFORE UPDATE
9. `periods` - BEFORE UPDATE
10. `period_config` - BEFORE UPDATE
11. `house_balances` - BEFORE UPDATE
12. `house_period_overrides` - BEFORE UPDATE
13. `record_allocations` - BEFORE UPDATE
14. `cta_maintenance` - BEFORE UPDATE
15. `cta_water` - BEFORE UPDATE
16. `cta_penalties` - BEFORE UPDATE
17. `cta_extraordinary_fee` - BEFORE UPDATE
18. `cta_other_payments` - BEFORE UPDATE

**Beneficios:**
- Auditoría automática de cambios (siempre sabemos cuándo cambió cada registro)
- Consistencia: todas las tablas tienen el mismo comportamiento
- Transparencia: los cambios se registran sin intervención de código
- Sincronización: TypeORM y BD siempre están sincronizados

---

## Constraints

### Foreign Keys

- `last_transaction_bank.transactions_bank_id` → `transactions_bank.id`
  - `ON UPDATE CASCADE`
  - `ON DELETE CASCADE`

### Check Constraints

Ninguno implementado actualmente, pero se recomienda considerar:
- `amount > 0` para validar montos positivos
- `bank_name IS NOT NULL` para requerir nombre de banco

## Performance Considerations

### Query Patterns

1. **Búsqueda por depósitos no confirmados** (optimizada):
   ```sql
   SELECT * FROM transactions_bank
   WHERE is_deposit = true AND confirmation_status = false;
   ```

2. **Búsqueda por banco y fecha**:
   ```sql
   SELECT * FROM transactions_bank
   WHERE bank_name = 'Santander' AND date >= '2024-01-01';
   ```

3. **Última transacción por banco**:
   ```sql
   SELECT tb.* FROM transactions_bank tb
   JOIN last_transaction_bank ltb ON ltb.transactions_bank_id = tb.id
   WHERE tb.bank_name = 'Santander'
   ORDER BY ltb.created_at DESC LIMIT 1;
   ```

### Recommended Additional Indexes

Para mejorar performance según patrones de uso:

```sql
-- Para búsquedas por banco y fecha
CREATE INDEX idx_transactions_bank_bank_date
ON transactions_bank (bank_name, date);

-- Para búsquedas por rango de fechas
CREATE INDEX idx_transactions_bank_date
ON transactions_bank (date);

-- Para búsquedas por monto
CREATE INDEX idx_transactions_bank_amount
ON transactions_bank (amount) WHERE amount > 10000;
```

## Data Types Rationale

### Transactions Bank
- **BIGINT para ID**: Soporta gran volumen de transacciones
- **DATE/TIME separados**: Permite búsquedas eficientes por fecha sin hora
- **FLOAT para amount**: Soporta decimales para montos monetarios
- **TEXT para bank_name**: Flexible para nombres de banco variables
- **BOOLEAN para flags**: Eficiente para campos true/false

### Vouchers & Houses
- **VARCHAR(128) para users.id**: Soporta Firebase UIDs (28 caracteres) y UUIDs legacy (36 caracteres)
- **NUMERIC para cel_phone**: Almacena números E.164 sin perder precisión (10-15 dígitos)
- **SERIAL para house_id**: Permite múltiples records por casa
- **INT UNIQUE para number_house**: Identifica casa única pero no es PK
- **BIGSERIAL para vouchers**: Soporta gran volumen de comprobantes
- **BOOLEAN para email_verified**: Indica si el email del usuario ha sido verificado (required para email/password auth)

## Migration History

### 2026-01: Firebase Auth and Email Verification
**Migrations:**
- `1769459798239-ChangeUserIdToVarchar.ts` - Cambio de `users.id` de `uuid` a `varchar(128)`
- `1769550000000-AddEmailVerificationFields.ts` - Adición de campos de verificación de email

**Cambios:**
1. Cambio de tipo `users.id`:
   - De: `uuid NOT NULL UNIQUE`
   - A: `varchar(128) NOT NULL` (soporta Firebase UIDs y UUIDs legacy)
2. Adición de columnas de verificación:
   - `email_verified: BOOLEAN NOT NULL DEFAULT false`
   - `email_verified_at: TIMESTAMPTZ` (nullable)
3. Actualización de tipos en:
   - `houses.user_id`: `uuid` → `varchar(128)`
   - `manual_validation_approvals.approved_by_user_id`: `uuid` → `varchar(128)`

**Objetivo:**
- Migración de Supabase Auth a Firebase Auth
- Soporte para verificación de email en flujos email/password
- OAuth skips email verification (provider ya lo verifica)

**Documentación:** [Firebase Auth Setup Guide](../../FIREBASE_GOOGLE_OAUTH_SETUP.md)

### 2024-10-13: Voucher Registration with Multiple Tables
**Migration:** `1729113600000-add-house-record-table-and-update-relations.ts`

**Cambios:**
1. Creación de tabla `house_records` (tabla intermedia)
2. Modificación de `houses`:
   - PK cambiado de `number_house` a `id SERIAL`
   - `number_house` ahora es `UNIQUE` (no PK)
   - Removido campo `record_id`
3. Modificación de `records`:
   - Relación actualizada a `houseRecords: HouseRecord[]`
4. Migración de datos existentes preservada

**Objetivo:** Permitir múltiples pagos por casa y cambio de propietarios

**Documentación completa:** [Vouchers Feature](../features/vouchers/README.md#registro-en-base-de-datos)

## Query Examples

### Vouchers Module Queries

#### Ver todos los pagos de una casa
```sql
SELECT
    h.number_house,
    u.cel_phone AS propietario,
    v.amount,
    v.date,
    v.confirmation_code,
    r.created_at AS fecha_registro
FROM house_records hr
JOIN houses h ON hr.house_id = h.id
JOIN users u ON h.user_id = u.id
JOIN records r ON hr.record_id = r.id
JOIN vouchers v ON r.vouchers_id = v.id
WHERE h.number_house = 42
ORDER BY v.date DESC;
```

#### Ver casas de un usuario
```sql
SELECT h.*, COUNT(hr.id) AS total_pagos
FROM houses h
LEFT JOIN house_records hr ON h.id = hr.house_id
JOIN users u ON h.user_id = u.id
WHERE u.cel_phone = 525512345678
GROUP BY h.id;
```

#### Buscar usuario por teléfono
```sql
SELECT * FROM users
WHERE cel_phone = 525512345678;
```

### Transactions Bank Queries

See existing queries above in "Query Patterns" section.

### Payment Management Queries

#### Ver historial de pagos de una casa
```sql
SELECT
    ra.allocated_amount,
    ra.payment_status,
    ra.concept_type,
    p.year,
    p.month,
    r.created_at
FROM record_allocations ra
JOIN records r ON ra.record_id = r.id
JOIN periods p ON ra.period_id = p.id
WHERE ra.house_id = 42
ORDER BY p.year DESC, p.month DESC;
```

#### Ver saldos actuales de una casa
```sql
SELECT
    h.number_house,
    hb.accumulated_cents,
    hb.credit_balance,
    hb.debit_balance
FROM houses h
LEFT JOIN house_balances hb ON h.id = hb.house_id
WHERE h.number_house = 42;
```

#### Ver montos por período para una casa
```sql
SELECT
    p.year,
    p.month,
    hpo.concept_type,
    hpo.custom_amount,
    hpo.reason
FROM house_period_overrides hpo
JOIN periods p ON hpo.period_id = p.id
WHERE hpo.house_id = 42
ORDER BY p.year DESC, p.month DESC;
```

## ENUM Types

### role_t
Roles de usuarios en el sistema.

```sql
CREATE TYPE role_t AS ENUM ('admin', 'owner', 'tenant');
```

**Valores:**
- `admin`: Administrador del sistema
- `owner`: Propietario de casa
- `tenant`: Inquilino

### status_t
Estados de cuentas de usuarios.

```sql
CREATE TYPE status_t AS ENUM ('active', 'suspend', 'inactive');
```

**Valores:**
- `active`: Usuario activo
- `suspend`: Usuario suspendido temporalmente
- `inactive`: Usuario inactivo

### validation_status_t
Estados de validación de transacciones en `transactions_status`.

```sql
CREATE TYPE validation_status_t AS ENUM (
    'not-found',             -- Transacción no encontrada en registros
    'pending',               -- Pendiente de validación manual
    'confirmed',             -- Confirmada automáticamente
    'requires-manual',       -- Requiere validación manual
    'conflict'               -- Conflicto detectado
);
```

**Valores:**
- `not-found`: No se encontró registro coincidente
- `pending`: En espera de validación manual
- `confirmed`: Validada automáticamente
- `requires-manual`: Requiere revisión manual (múltiples coincidencias)
- `conflict`: Conflicto entre voucher y transacción

### record_allocations_concept_type_enum
Tipos de conceptos para distribución de pagos en `record_allocations`.

```sql
CREATE TYPE record_allocations_concept_type_enum AS ENUM (
    'maintenance',           -- Mantenimiento/cuota ordinaria
    'water',                 -- Agua
    'extraordinary_fee',     -- Cuota extraordinaria
    'penalties',             -- Multas/mora
    'other'                  -- Otros
);
```

**Valores:**
- `maintenance`: Cuota de mantenimiento ordinaria del período
- `water`: Consumo de agua
- `extraordinary_fee`: Cuota extraordinaria aprobada
- `penalties`: Multas, mora o intereses
- `other`: Otros conceptos no clasificados

### record_allocations_payment_status_enum
Estados de pago en `record_allocations`.

```sql
CREATE TYPE record_allocations_payment_status_enum AS ENUM (
    'complete',              -- Pago completo del concepto
    'partial',               -- Pago parcial (falta dinero)
    'overpaid'               -- Pago en exceso (sobrepagado)
);
```

**Valores:**
- `complete`: El monto aplicado es exactamente igual al esperado
- `partial`: El monto aplicado es menor al esperado (deuda)
- `overpaid`: El monto aplicado es mayor al esperado (exceso)

### house_period_overrides_concept_type_enum
Tipos de conceptos para montos personalizados en `house_period_overrides`.

```sql
CREATE TYPE house_period_overrides_concept_type_enum AS ENUM (
    'maintenance',           -- Mantenimiento/cuota ordinaria
    'water',                 -- Agua
    'extraordinary_fee'      -- Cuota extraordinaria
);
```

**Valores:**
- `maintenance`: Cuota ordinaria personalizada
- `water`: Consumo de agua personalizado
- `extraordinary_fee`: Cuota extraordinaria personalizada

## Relaciones v3.1

```
Period (1) ──→ (N) PeriodConfig
             ──→ (N) HousePeriodOverride
             ──→ (N) RecordAllocation

House (1) ──→ (1) HouseBalance
           ──→ (N) HousePeriodOverride
           ──→ (N) RecordAllocation

Record (1) ──→ (N) RecordAllocation

User (1) ──→ (N) ManualValidationApproval
TransactionBank (1) ──→ (N) ManualValidationApproval
Voucher (1) ──→ (N) ManualValidationApproval
```