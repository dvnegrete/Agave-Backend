# Database Schema Updates - Version 2.0

## 📋 Resumen de Cambios

Este documento detalla las actualizaciones realizadas al esquema de base de datos para soportar la **conciliación bancaria automática** y otras mejoras del sistema.

---

## 🆕 Cambios Principales

### 1. Tabla `houses` - Nueva Estructura

**Antes (v1.0):**
```sql
CREATE TABLE "houses" (
  "number_house" int NOT NULL UNIQUE,
  "user_id" uuid NOT NULL,
  "record_id" int NOT NULL,
  PRIMARY KEY("number_house")
);
```

**Después (v2.0):**
```sql
CREATE TABLE "houses" (
  "id" serial NOT NULL UNIQUE,
  "number_house" int NOT NULL UNIQUE,
  "user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY("id")
);
```

**Cambios:**
- ✅ Nuevo campo `id` como PRIMARY KEY (serial auto-increment)
- ✅ `number_house` ahora es UNIQUE en lugar de PRIMARY KEY
- ✅ Eliminado campo `record_id` (reemplazado por tabla junction)
- ✅ Agregados campos `created_at` y `updated_at` para auditoría

**Razón:**
- Permite múltiples records por casa (relación many-to-many)
- Facilita la creación automática de casas durante conciliación
- Mejora el tracking de cambios

---

### 2. Nueva Tabla `house_records` (Junction Table)

**Nueva tabla (v2.0):**
```sql
CREATE TABLE "house_records" (
  "id" serial NOT NULL UNIQUE,
  "house_id" int NOT NULL,
  "record_id" int NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY("id")
);
```

**Propósito:**
- Implementa relación **many-to-many** entre casas y registros de pago
- Una casa puede tener múltiples pagos
- Un pago puede estar asociado a múltiples casas (pagos compartidos)

**Foreign Keys:**
```sql
ALTER TABLE "house_records"
ADD FOREIGN KEY("house_id") REFERENCES "houses"("id")
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "house_records"
ADD FOREIGN KEY("record_id") REFERENCES "records"("id")
ON UPDATE CASCADE ON DELETE CASCADE;
```

---

### 3. Tabla `records` - Campos Opcionales

**Cambio:**
```sql
CREATE TABLE "records" (
  "id" serial NOT NULL UNIQUE,
  "transaction_status_id" int,
  "vouchers_id" int,  -- ✅ Ahora NULLABLE (antes era NOT NULL implícito)
  ...
);
```

**Razón:**
- Soporta conciliaciones automáticas **sin voucher**
- Permite crear records basados solo en transacciones bancarias identificadas por centavos/concepto

**Ejemplo de uso:**
```typescript
// Conciliación automática sin voucher
const record = await recordRepository.create({
  vouchers_id: null, // ✅ Permitido en v2.0
  transaction_status_id: transactionStatus.id,
});
```

---

### 4. Tabla `vouchers` - Nuevo Campo `confirmation_code`

**Nuevo campo (v2.0):**
```sql
CREATE TABLE "vouchers" (
  ...
  "confirmation_code" varchar(20) UNIQUE,  -- ✅ Nuevo
  ...
);
```

**Propósito:**
- Código único de confirmación generado para el usuario
- Facilita la verificación de vouchers por WhatsApp/SMS
- Mejora la experiencia del usuario

---

### 5. Timestamps en Todas las Tablas

**Agregado a TODAS las tablas:**
```sql
"created_at" timestamptz NOT NULL DEFAULT NOW(),
"updated_at" timestamptz NOT NULL DEFAULT NOW(),
```

**Tablas actualizadas:**
- ✅ users
- ✅ houses
- ✅ transactions_bank
- ✅ vouchers
- ✅ transactions_status
- ✅ last_transaction_bank
- ✅ records
- ✅ house_records
- ✅ periods
- ✅ cta_extraordinary_fee
- ✅ cta_maintenance
- ✅ cta_penalties
- ✅ cta_water
- ✅ cta_other_payments

**Beneficios:**
- Auditoría completa del sistema
- Tracking de cambios
- Debugging más fácil
- Cumplimiento de mejores prácticas

---

### 6. Usuario Sistema (SYSTEM_USER_ID)

**Nuevo registro obligatorio:**
```sql
INSERT INTO users (id, mail, role, status, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  'tenant',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

**Propósito:**
- Propietario temporal de casas creadas automáticamente durante conciliación
- Requerido para satisfacer constraint NOT NULL de `houses.user_id`
- Las casas se reasignan al propietario real cuando se confirma su identidad

**Documentación:** Ver `docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md`

---

## 📊 Índices Agregados para Performance

**Nuevos índices (v2.0):**

### Houses
```sql
CREATE INDEX idx_houses_number_house ON houses(number_house);
CREATE INDEX idx_houses_user_id ON houses(user_id);
```

### House-Records
```sql
CREATE INDEX idx_house_records_house_id ON house_records(house_id);
CREATE INDEX idx_house_records_record_id ON house_records(record_id);
```

### Transactions Bank
```sql
CREATE INDEX idx_transactions_bank_date ON transactions_bank(date);
CREATE INDEX idx_transactions_bank_confirmation ON transactions_bank(confirmation_status);
CREATE INDEX idx_transactions_bank_amount ON transactions_bank(amount);
```

### Vouchers
```sql
CREATE INDEX idx_vouchers_date ON vouchers(date);
CREATE INDEX idx_vouchers_confirmation ON vouchers(confirmation_status);
CREATE INDEX idx_vouchers_confirmation_code ON vouchers(confirmation_code);
```

### Transaction Status
```sql
CREATE INDEX idx_transactions_status_bank_id ON transactions_status(transactions_bank_id);
CREATE INDEX idx_transactions_status_voucher_id ON transactions_status(vouchers_id);
```

### Records
```sql
CREATE INDEX idx_records_transaction_status_id ON records(transaction_status_id);
CREATE INDEX idx_records_vouchers_id ON records(vouchers_id);
```

### Periods
```sql
CREATE INDEX idx_periods_year_month ON periods(year, month);
```

**Impacto:**
- ⚡ Queries más rápidas en búsquedas por fecha
- ⚡ Joins optimizados entre tablas
- ⚡ Filtrado eficiente por status de confirmación

---

## 🔄 Migración desde v1.0 a v2.0

### Pasos para Migrar Base de Datos Existente

#### 1. Respaldar Base de Datos
```bash
pg_dump -h localhost -U postgres -d agave_db > backup_v1.sql
```

#### 2. Crear Usuario Sistema
```sql
INSERT INTO users (id, mail, role, status, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  'tenant',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

#### 3. Modificar Tabla Houses

**⚠️ IMPORTANTE:** Esta migración eliminará datos existentes en `houses.record_id`

```sql
-- Paso 1: Crear tabla temporal
CREATE TABLE houses_temp (
  id serial NOT NULL UNIQUE,
  number_house int NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(id)
);

-- Paso 2: Copiar datos
INSERT INTO houses_temp (number_house, user_id, created_at, updated_at)
SELECT
  number_house,
  user_id,
  NOW(),
  NOW()
FROM houses;

-- Paso 3: Eliminar tabla antigua (después de verificar datos)
DROP TABLE houses CASCADE;

-- Paso 4: Renombrar tabla temporal
ALTER TABLE houses_temp RENAME TO houses;

-- Paso 5: Recrear foreign keys
ALTER TABLE houses
ADD FOREIGN KEY(user_id) REFERENCES users(id)
ON UPDATE CASCADE ON DELETE CASCADE;
```

#### 4. Crear Tabla house_records
```sql
CREATE TABLE house_records (
  id serial NOT NULL UNIQUE,
  house_id int NOT NULL,
  record_id int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(id)
);

ALTER TABLE house_records
ADD FOREIGN KEY(house_id) REFERENCES houses(id)
ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE house_records
ADD FOREIGN KEY(record_id) REFERENCES records(id)
ON UPDATE CASCADE ON DELETE CASCADE;
```

#### 5. Migrar Datos de houses.record_id a house_records

**Si tienes backup de houses.record_id:**
```sql
-- Asumiendo que tienes backup en houses_backup
INSERT INTO house_records (house_id, record_id, created_at, updated_at)
SELECT
  h.id,
  hb.record_id,
  NOW(),
  NOW()
FROM houses h
JOIN houses_backup hb ON h.number_house = hb.number_house
WHERE hb.record_id IS NOT NULL;
```

#### 6. Agregar Timestamps a Tablas Existentes

**Ejemplo para cada tabla:**
```sql
-- Users
ALTER TABLE users
ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW(),
ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();

-- Transactions Bank
ALTER TABLE transactions_bank
ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW(),
ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();

-- Vouchers
ALTER TABLE vouchers
ADD COLUMN created_at timestamptz NOT NULL DEFAULT NOW(),
ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();

-- (Repetir para todas las tablas)
```

#### 7. Agregar confirmation_code a vouchers
```sql
ALTER TABLE vouchers
ADD COLUMN confirmation_code varchar(20) UNIQUE;
```

#### 8. Crear Índices
```bash
# Ejecutar todo el bloque de índices del archivo bd_initial.sql
psql -h localhost -U postgres -d agave_db < indices.sql
```

---

## ✅ Verificación Post-Migración

### 1. Verificar Usuario Sistema
```sql
SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000';
```

**Resultado esperado:**
```
id                                   | mail                        | role
-------------------------------------|-----------------------------|---------
00000000-0000-0000-0000-000000000000 | sistema@conciliacion.local  | tenant
```

### 2. Verificar Estructura de houses
```sql
\d houses
```

**Resultado esperado:**
```
Column        | Type                     | Nullable | Default
--------------|--------------------------|----------|--------
id            | integer                  | not null | nextval(...)
number_house  | integer                  | not null |
user_id       | uuid                     | not null |
created_at    | timestamp with time zone | not null | now()
updated_at    | timestamp with time zone | not null | now()
```

### 3. Verificar house_records
```sql
SELECT COUNT(*) FROM house_records;
```

### 4. Verificar Índices
```sql
\di houses
\di house_records
\di transactions_bank
```

---

## 🚀 Base de Datos Nueva (Sin Migración)

Si estás creando una base de datos desde cero:

```bash
# Ejecutar el script completo
psql -h localhost -U postgres -d agave_db < bd_initial.sql
```

Este script crea:
- ✅ Todos los tipos enum
- ✅ Todas las tablas con estructura v2.0
- ✅ Todas las foreign keys
- ✅ Usuario Sistema
- ✅ Todos los índices
- ✅ Comentarios en tablas/columnas

---

## 📚 Documentación Relacionada

- **Conciliación Bancaria:** `docs/features/bank-reconciliation/`
- **Setup Usuario Sistema:** `docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md`
- **Reglas de Conciliación:** `docs/features/bank-reconciliation/CAMBIOS-REGLAS-CONCILIACION.md`

---

## 🔧 Troubleshooting

### Error: "null value in column user_id violates not-null constraint"
**Solución:** Asegúrate de que el usuario sistema existe antes de ejecutar conciliación automática.

```sql
-- Verificar
SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000';

-- Si no existe, crear
INSERT INTO users (id, mail, role, status, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  'tenant',
  'active',
  NOW(),
  NOW()
);
```

### Error: "relation house_records does not exist"
**Solución:** Asegúrate de crear la tabla house_records antes de usar conciliación.

```sql
CREATE TABLE house_records (
  id serial NOT NULL UNIQUE,
  house_id int NOT NULL,
  record_id int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY(id)
);
```

---

**Última actualización:** Octubre 2025
**Versión del esquema:** 2.0.0
