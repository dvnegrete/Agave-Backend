# Migraciones de Base de Datos para Payment Management

**Última actualización**: 2026-02-12

## Resumen

Este documento lista TODAS las migraciones del módulo Payment Management, incluyendo las tablas base y las migraciones incrementales recientes.

---

## Catálogo Completo de Migraciones

### Migraciones ejecutadas via TypeORM synchronize (tablas base)

Estas tablas fueron creadas por TypeORM `synchronize: true` en desarrollo, y por migraciones explícitas en staging/prod:

| Tabla | Descripción |
|-------|-------------|
| `period_config` | Configuración versionada de montos (maintenance, water, extraordinary, penalty, cents_credit_threshold) |
| `house_balances` | Balance financiero por casa (accumulated_cents, credit_balance, debit_balance) |
| `house_period_overrides` | Montos personalizados por casa-período-concepto |
| `record_allocations` | Distribución detallada de cada pago por concepto |
| `periods` | Períodos (year, month, period_config_id) |

### Migraciones explícitas (archivos TypeORM)

| # | Timestamp | Nombre | Archivo | Estado |
|---|-----------|--------|---------|--------|
| 1 | 1731590000000 | AddManualValidationFields | `1731590000000-AddManualValidationFields.ts` | ✅ Ejecutada |
| 2 | 1769800000000 | UpdatePaymentDueDay | `1769800000000-UpdatePaymentDueDay.ts` | ⏳ Pendiente staging |
| 3 | 1769810000000 | AddConceptActivationToPeriods | `1769810000000-AddConceptActivationToPeriods.ts` | ⏳ Pendiente staging |
| 4 | 1769820000000 | AddHouseIdToCtaPenalties | `1769820000000-AddHouseIdToCtaPenalties.ts` | ⏳ Pendiente staging |
| 5 | 1770000000000 | CreateHousePeriodCharges | `1770000000000-CreateHousePeriodCharges.ts` | ⏳ Pendiente staging |
| 6 | 1770100000000 | AddCentsCreditThreshold | `1770100000000-AddCentsCreditThreshold.ts` | ⏳ Pendiente staging |
| 7 | 1770200000000 | SeedLegacyHousePeriodCharges | `1770200000000-SeedLegacyHousePeriodCharges.ts` | ⏳ Pendiente staging |
| 8 | 1770300000000 | FixStaleEnumTypes | `1770300000000-FixStaleEnumTypes.ts` | ⏳ Pendiente staging |

---

## Detalle de Migraciones Recientes (2026-02)

### 5. `CreateHousePeriodCharges` (1770000000000)

Crea tabla `house_period_charges` para snapshot inmutable de cargos esperados.

```sql
CREATE TABLE house_period_charges (
  id SERIAL PRIMARY KEY,
  house_id INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  period_id INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  concept_type record_allocations_concept_type_enum NOT NULL,
  expected_amount FLOAT NOT NULL,
  source VARCHAR(50) DEFAULT 'period_config',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (house_id, period_id, concept_type)
);
```

### 6. `AddCentsCreditThreshold` (1770100000000)

Agrega columna `cents_credit_threshold` a `period_config`.

```sql
ALTER TABLE period_config
ADD COLUMN cents_credit_threshold FLOAT NOT NULL DEFAULT 100;
```

- **Propósito**: Umbral configurable para convertir centavos acumulados a crédito
- **Antes**: Hardcodeado a $1 (causaba crédito prematuro)
- **Ahora**: Default $100, configurable por PeriodConfig
- **Idempotente**: Check con `hasColumn` antes de ejecutar

### 7. `SeedLegacyHousePeriodCharges` (1770200000000)

Rellena `house_period_charges` para períodos existentes que no los tienen.

**Lógica**:
1. Busca períodos sin charges en `house_period_charges`
2. Para cada período: obtiene su `period_config` y todas las casas
3. Inserta cargo MAINTENANCE para cada casa (siempre)
4. Inserta WATER si `water_active = true` en el período
5. Inserta EXTRAORDINARY_FEE si `extraordinary_fee_active = true`
6. Inserta PENALTIES si existe en `cta_penalties` para esa casa+periodo
7. Respeta `house_period_overrides` para montos personalizados
8. Usa `ON CONFLICT DO NOTHING` para idempotencia

**SQL puro**: No depende de servicios TypeORM (safe para producción).

### 8. `FixStaleEnumTypes` (1770300000000)

Limpia tipos enum `_old` residuales que TypeORM synchronize puede dejar.

```sql
-- Busca y elimina tipos que terminan en _old
SELECT t.typname FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname LIKE '%_old';
-- DROP TYPE IF EXISTS "public"."<typname>" CASCADE para cada uno
```

**Contexto**: Cuando TypeORM synchronize detecta discrepancia entre `enumName` de la entity y el tipo en BD, intenta renombrar creando `_old`. Si falla a mitad, quedan tipos residuales. Esta migración los limpia.

---

## Ejecución

### Ejecutar todas las migraciones pendientes

```bash
cd agave-backend
npm run db:deploy
```

TypeORM ejecuta en orden de timestamp. Las migraciones son idempotentes.

### Verificación post-migración

```sql
-- Verificar que house_period_charges tiene datos
SELECT COUNT(*) FROM house_period_charges;

-- Verificar cents_credit_threshold
SELECT id, cents_credit_threshold FROM period_config;

-- Verificar que no hay tipos _old residuales
SELECT typname FROM pg_type WHERE typname LIKE '%_old';
```

---

## Notas Importantes

### TypeORM enumName

Las entities con enums deben especificar `enumName` que coincida con el tipo que existe en la BD:

| Entity | Column | enumName |
|--------|--------|----------|
| TransactionStatus | validation_status | `validation_status_t` |
| User | role | `role_t` |
| User | status | `status_t` |
| HousePeriodCharge | concept_type | `record_allocations_concept_type_enum` |

Si se crea una nueva entity con un enum existente, usar el `enumName` del tipo ya creado en BD. Ver `CURRENT_STATE.md` sección "Problemas Conocidos con TypeORM Enums" para más detalles.

### Backup

Siempre hacer backup antes de ejecutar en staging/producción:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Orden de dependencias

Las migraciones tienen dependencias implícitas:
1. `CreateHousePeriodCharges` debe ejecutarse antes que `SeedLegacyHousePeriodCharges`
2. `AddCentsCreditThreshold` es independiente (solo agrega columna)
3. `FixStaleEnumTypes` es independiente (solo limpieza)

Los timestamps ya garantizan el orden correcto.
