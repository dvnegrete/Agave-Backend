# FASE 1: Migrations Completadas ✅

## 📋 Resumen

Se han creado exitosamente las migrations para extender el schema de `transactions_status` y soportar la persistencia completa de estados de conciliación.

---

## 📄 Archivos Creados

### 1. **add-validation-status-enum-values.ts**
**Ubicación:** `src/shared/database/migrations/add-validation-status-enum-values.ts`

**Propósito:** Agregar nuevos valores al enum `validation_status_t`

**Valores agregados:**
- `'requires-manual'` - Para casos que requieren validación manual
- `'conflict'` - Para conflictos entre centavos y concepto

**SQL generado:**
```sql
ALTER TYPE validation_status_t ADD VALUE 'requires-manual';
ALTER TYPE validation_status_t ADD VALUE 'conflict';
```

**Nota:** Esta migration usa un bloque `DO $$` para evitar errores si los valores ya existen.

---

### 2. **add-transactions-status-tracking-fields.ts**
**Ubicación:** `src/shared/database/migrations/add-transactions-status-tracking-fields.ts`

**Propósito:** Agregar campos de tracking a la tabla `transactions_status`

**Campos agregados:**
- `reason` (text) - Razón del estado actual
- `identified_house_number` (int) - Casa identificada (aunque requiera validación)
- `processed_at` (timestamptz) - Timestamp de última conciliación
- `metadata` (jsonb) - Información adicional (candidatos, scores, etc.)

**SQL generado:**
```sql
ALTER TABLE "transactions_status"
ADD COLUMN "reason" text,
ADD COLUMN "identified_house_number" int,
ADD COLUMN "processed_at" timestamptz,
ADD COLUMN "metadata" jsonb;
```

**Índices creados:**
- `idx_transactions_status_validation` - En `validation_status`
- `idx_transactions_status_processed_at` - En `processed_at`
- `idx_transactions_status_house_number` - En `identified_house_number`

---

## 🚀 Cómo Ejecutar las Migrations

### Opción 1: Usando npm scripts (Recomendado)

```bash
# Ejecutar todas las migrations pendientes
npm run db:dev
```

### Opción 2: Manualmente con psql

Si prefieres ejecutar manualmente (útil para desarrollo):

```bash
# 1. Conectar a la base de datos
psql -U postgres -d agave_db

# 2. Ejecutar SQL del enum (manualmente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'requires-manual'
    AND enumtypid = 'validation_status_t'::regtype
  ) THEN
    ALTER TYPE validation_status_t ADD VALUE 'requires-manual';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'conflict'
    AND enumtypid = 'validation_status_t'::regtype
  ) THEN
    ALTER TYPE validation_status_t ADD VALUE 'conflict';
  END IF;
END $$;

# 3. Ejecutar SQL de las columnas
ALTER TABLE "transactions_status"
ADD COLUMN IF NOT EXISTS "reason" text,
ADD COLUMN IF NOT EXISTS "identified_house_number" int,
ADD COLUMN IF NOT EXISTS "processed_at" timestamptz,
ADD COLUMN IF NOT EXISTS "metadata" jsonb;

# 4. Crear índices
CREATE INDEX IF NOT EXISTS "idx_transactions_status_validation"
ON "transactions_status" ("validation_status");

CREATE INDEX IF NOT EXISTS "idx_transactions_status_processed_at"
ON "transactions_status" ("processed_at");

CREATE INDEX IF NOT EXISTS "idx_transactions_status_house_number"
ON "transactions_status" ("identified_house_number");
```

---

## ✅ Verificación Post-Migration

### 1. Verificar que el enum tiene los nuevos valores

```sql
SELECT enumlabel FROM pg_enum
WHERE enumtypid = 'validation_status_t'::regtype
ORDER BY enumsortorder;
```

**Resultado esperado:**
```
enumlabel
-----------------
not-found
pending
confirmed
requires-manual  ← NUEVO
conflict         ← NUEVO
```

---

### 2. Verificar estructura de la tabla transactions_status

```sql
\d transactions_status
```

**Resultado esperado:**
```
Column                    | Type                     | Nullable | Default
--------------------------|--------------------------|----------|--------
id                        | integer                  | not null | nextval(...)
validation_status         | validation_status_t      | not null | 'pending'
transactions_bank_id      | bigint                   | yes      |
vouchers_id               | integer                  | yes      |
reason                    | text                     | yes      | ← NUEVO
identified_house_number   | integer                  | yes      | ← NUEVO
processed_at              | timestamptz              | yes      | ← NUEVO
metadata                  | jsonb                    | yes      | ← NUEVO
created_at                | timestamptz              | not null | now()
updated_at                | timestamptz              | not null | now()
```

---

### 3. Verificar índices creados

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transactions_status'
ORDER BY indexname;
```

**Resultado esperado (debe incluir):**
```
indexname                                   | indexdef
--------------------------------------------|----------------------------------
idx_transactions_status_house_number        | CREATE INDEX ... (identified_house_number)
idx_transactions_status_processed_at        | CREATE INDEX ... (processed_at)
idx_transactions_status_validation          | CREATE INDEX ... (validation_status)
```

---

### 4. Verificar que las migrations compilaron correctamente

```bash
npx tsc --noEmit src/shared/database/migrations/add-validation-status-enum-values.ts
npx tsc --noEmit src/shared/database/migrations/add-transactions-status-tracking-fields.ts
```

**Resultado esperado:** Sin errores de compilación ✅

---

## 🔄 Reversión (Si es necesario)

### Migration 1: Enum Values
**⚠️ ADVERTENCIA:** PostgreSQL no permite eliminar valores de enums fácilmente. Esta migration NO tiene down automático.

Si realmente necesitas revertir:
1. Crear nuevo enum sin esos valores
2. Alterar tabla para usar nuevo enum
3. Eliminar enum antiguo
4. Renombrar nuevo enum

### Migration 2: Tracking Fields
Esta migration SÍ tiene down automático:

```bash
# Si usas TypeORM CLI
npm run typeorm migration:revert -- -d src/shared/config/datasource.ts
```

O manualmente:
```sql
DROP INDEX IF EXISTS "idx_transactions_status_house_number";
DROP INDEX IF EXISTS "idx_transactions_status_processed_at";
DROP INDEX IF EXISTS "idx_transactions_status_validation";

ALTER TABLE "transactions_status"
DROP COLUMN IF EXISTS "metadata",
DROP COLUMN IF EXISTS "processed_at",
DROP COLUMN IF EXISTS "identified_house_number",
DROP COLUMN IF EXISTS "reason";
```

---

## 📊 Impacto

### Tablas Afectadas
- ✅ `transactions_status` - 4 nuevas columnas, 3 nuevos índices

### Enums Modificados
- ✅ `validation_status_t` - 2 nuevos valores

### Datos Existentes
- ✅ **Sin pérdida de datos** - Solo se agregan columnas (nullable)
- ✅ **Sin downtime** - Las columnas son opcionales
- ✅ **Backward compatible** - El código existente sigue funcionando

---

## 🎯 Siguiente Paso

**FASE 2:** Actualizar Entities y DTOs TypeORM

Ver: `docs/features/bank-reconciliation/IMPLEMENTACION-PERSISTENCIA-ESTADOS.md` - FASE 2

---

## 📝 Checklist FASE 1

- [x] Migration para enum values creada
- [x] Migration para nuevas columnas creada
- [x] Migrations compilan sin errores TypeScript
- [x] Documentación de verificación incluida
- [x] Documentación de reversión incluida
- [ ] Migrations ejecutadas en base de datos (pendiente de usuario)
- [ ] Verificación post-migration completada (pendiente de usuario)

---

**Creado:** Octubre 2025
**Estado:** ✅ COMPLETADO
**Siguiente Fase:** FASE 2 - Actualizar Entities y DTOs
