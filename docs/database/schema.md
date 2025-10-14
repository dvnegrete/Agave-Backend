# Database Schema

## Overview

Este documento describe el esquema de base de datos completo del sistema Agave, incluyendo transacciones bancarias, vouchers, usuarios y casas.

## Core Tables

### Vouchers & Houses Module

#### users
Tabla de usuarios del sistema con autenticación Supabase.

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    cel_phone       NUMERIC UNIQUE NOT NULL,
    email           VARCHAR(255),
    role            user_role NOT NULL DEFAULT 'tenant',
    status          user_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);

CREATE TYPE user_role AS ENUM ('tenant', 'admin', 'super_admin');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
```

**Columnas Principales:**
- `id`: UUID generado manualmente (uuid v4) o por Supabase Auth
- `cel_phone`: Número de teléfono en formato E.164 (incluye código de país)
- `role`: Rol del usuario (inquilino, admin, super admin)
- `status`: Estado del usuario

#### houses
Tabla de casas/propiedades en el sistema.

```sql
CREATE TABLE houses (
    id              SERIAL PRIMARY KEY,
    number_house    INT UNIQUE NOT NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_houses_user_id ON houses(user_id);
CREATE INDEX idx_houses_number_house ON houses(number_house);
```

**Columnas Principales:**
- `id`: PK autogenerada (permite múltiples registros por casa)
- `number_house`: Número único de casa/propiedad
- `user_id`: Propietario actual (puede cambiar con el tiempo)

#### vouchers
Tabla de comprobantes de pago procesados vía WhatsApp.

```sql
CREATE TABLE vouchers (
    id                      BIGSERIAL PRIMARY KEY,
    image_url               TEXT,
    amount                  FLOAT,
    date                    DATE,
    time                    TIME,
    casa                    INTEGER,
    no_referencia           VARCHAR(50),
    confirmation_status     BOOLEAN DEFAULT false,
    confirmation_code       VARCHAR(20) UNIQUE,
    created_at              TIMESTAMP DEFAULT now(),
    updated_at              TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_vouchers_casa ON vouchers(casa);
CREATE INDEX idx_vouchers_confirmation_status ON vouchers(confirmation_status);
```

**Columnas Principales:**
- `amount`: Monto del pago
- `casa`: Número de casa asociada (validación obligatoria)
- `confirmation_status`: Estado de confirmación del voucher
- `confirmation_code`: Código único generado para el voucher

#### records
Tabla central que relaciona vouchers con casas y estados de transacción.

```sql
CREATE TABLE records (
    id                          SERIAL PRIMARY KEY,
    vouchers_id                 BIGINT REFERENCES vouchers(id) ON DELETE CASCADE,
    transaction_status_id       INT REFERENCES transaction_status(id) ON DELETE SET NULL,
    cta_water_id               INT,
    cta_maintenance_id         INT,
    cta_ordinary_fee_id        INT,
    cta_extraordinary_fee_id   INT,
    created_at                 TIMESTAMP DEFAULT now(),
    updated_at                 TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_records_vouchers_id ON records(vouchers_id);
CREATE INDEX idx_records_transaction_status_id ON records(transaction_status_id);
```

**Columnas Principales:**
- `vouchers_id`: FK al voucher asociado
- `transaction_status_id`: Estado de la transacción (null inicialmente)
- `cta_*`: Campos para asociar cuentas específicas (null inicialmente, se llenan con transactions-bank)

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
- **NUMERIC para cel_phone**: Almacena números E.164 sin perder precisión (10-15 dígitos)
- **UUID para user_id**: Compatible con Supabase Auth
- **SERIAL para house_id**: Permite múltiples records por casa
- **INT UNIQUE para number_house**: Identifica casa única pero no es PK
- **BIGSERIAL para vouchers**: Soporta gran volumen de comprobantes

## Migration History

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

**Documentación completa:** [Database Integration](../features/vouchers/database-integration.md)

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