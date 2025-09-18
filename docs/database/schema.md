# Database Schema - Transactions Bank

## Overview

Este documento describe el esquema de base de datos del módulo de transacciones bancarias y las optimizaciones implementadas.

## Core Tables

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

- **BIGINT para ID**: Soporta gran volumen de transacciones
- **DATE/TIME separados**: Permite búsquedas eficientes por fecha sin hora
- **FLOAT para amount**: Soporta decimales para montos monetarios
- **TEXT para bank_name**: Flexible para nombres de banco variables
- **BOOLEAN para flags**: Eficiente para campos true/false