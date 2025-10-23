# Instrucciones: Migración de Constraint CHECK para Vouchers.amount

## 📋 Resumen

Este documento contiene las instrucciones paso a paso para ejecutar la migración que agrega un constraint CHECK a la tabla `vouchers` para prevenir valores inválidos en el campo `amount`.

**Fecha:** Octubre 22, 2025
**Migración:** `1729622400000-add-voucher-amount-constraint.ts`

---

## ⚠️ IMPORTANTE: Leer Antes de Ejecutar

### ¿Qué hace esta migración?

Esta migración agrega un **constraint CHECK** a nivel de base de datos que:

✅ **Permite:** Solo números positivos mayores a 0
❌ **Rechaza:** NaN, Infinity, -Infinity, valores negativos, cero

### ¿Por qué es necesaria?

- **Problema:** Se encontró un registro con `amount = NaN` en producción
- **Causa:** Falta de validación cuando el OCR no extrae el monto correctamente
- **Solución:** Doble capa de validación (código + BD)

---

## 📝 Pasos de Ejecución

### PASO 1: Verificar Registros Existentes ⚠️

Antes de ejecutar la migración, **DEBES** verificar si hay registros con valores inválidos:

```sql
-- Conectar a la base de datos
psql $DATABASE_URL

-- O si usas variables separadas:
PGPASSWORD=tu_password psql -h tu_host -p 5432 -U tu_usuario -d tu_database
```

```sql
-- Query para identificar registros inválidos
SELECT
  id,
  amount,
  date,
  authorization_number,
  confirmation_code,
  confirmation_status,
  created_at
FROM vouchers
WHERE amount = 'NaN'::float
   OR amount = 'Infinity'::float
   OR amount = '-Infinity'::float
   OR amount <= 0
ORDER BY created_at DESC;
```

**Posibles resultados:**

#### Caso A: No hay registros inválidos ✅
```
 id | amount | date | authorization_number | confirmation_code | ...
----+--------+------+---------------------+-------------------+-----
(0 rows)
```

**Acción:** ✅ Puedes proceder directamente al PASO 2

---

#### Caso B: Hay registros con NaN/Infinity ❌
```
 id  | amount |    date    | authorization_number | confirmation_code | ...
-----+--------+------------+----------------------+-------------------+-----
 123 |   NaN  | 2025-10-20 | ABC123               | 202510-XYZ12      | ...
 456 |   NaN  | 2025-10-21 | DEF456               | 202510-ABC34      | ...
```

**Acción:** ⚠️ **DEBES** corregir estos registros ANTES de ejecutar la migración

---

### PASO 2: Corregir Registros Inválidos (si aplica)

Si encontraste registros inválidos en el PASO 1, tienes 3 opciones:

#### Opción A: Marcar como no confirmados y setear amount = 0 ⚠️

**Usa esta opción si:**
- Los registros son pocos (< 10)
- Quieres mantener el historial
- Puedes validarlos manualmente después

```sql
-- Backup primero (recomendado)
CREATE TABLE vouchers_nan_backup AS
SELECT * FROM vouchers
WHERE amount = 'NaN'::float OR amount <= 0;

-- Actualizar registros
UPDATE vouchers
SET
  amount = 0,
  confirmation_status = false,
  updated_at = NOW()
WHERE amount = 'NaN'::float
   OR amount = 'Infinity'::float
   OR amount = '-Infinity'::float
   OR amount <= 0;

-- Verificar
SELECT COUNT(*) as corregidos FROM vouchers WHERE amount = 0;
```

---

#### Opción B: Eliminar registros corruptos ❌

**Usa esta opción si:**
- Los registros son claramente inválidos
- No hay manera de recuperar el monto real
- Los usuarios pueden volver a enviar el comprobante

```sql
-- Backup OBLIGATORIO
CREATE TABLE vouchers_nan_backup AS
SELECT * FROM vouchers
WHERE amount = 'NaN'::float OR amount <= 0;

-- Verificar qué se va a eliminar
SELECT id, confirmation_code, date, created_at
FROM vouchers
WHERE amount = 'NaN'::float OR amount <= 0;

-- Eliminar
DELETE FROM vouchers
WHERE amount = 'NaN'::float
   OR amount = 'Infinity'::float
   OR amount = '-Infinity'::float
   OR amount <= 0;

-- Verificar
SELECT COUNT(*) as eliminados FROM vouchers_nan_backup;
```

**⚠️ ADVERTENCIA:** Esto eliminará los registros permanentemente. Solo hazlo si estás seguro.

---

#### Opción C: Investigar y corregir manualmente 🔍

**Usa esta opción si:**
- Puedes recuperar el monto real del comprobante
- Los registros son importantes
- Tienes acceso al archivo GCS original

```sql
-- Ver detalles completos del registro
SELECT
  id,
  amount,
  date,
  authorization_number,
  confirmation_code,
  url,  -- Nombre del archivo en GCS
  created_at,
  updated_at
FROM vouchers
WHERE id = 123;  -- ID del registro a corregir

-- Si puedes determinar el monto real:
UPDATE vouchers
SET
  amount = 1000.15,  -- Monto real
  updated_at = NOW()
WHERE id = 123;
```

---

### PASO 3: Verificar que NO quedan registros inválidos ✅

Después de corregir, **DEBES** verificar que no quedan registros inválidos:

```sql
-- Esta query DEBE retornar 0 rows
SELECT COUNT(*) as registros_invalidos
FROM vouchers
WHERE amount = 'NaN'::float
   OR amount = 'Infinity'::float
   OR amount = '-Infinity'::float
   OR amount <= 0;
```

**Resultado esperado:**
```
 registros_invalidos
---------------------
                   0
(1 row)
```

✅ Si retorna 0, puedes proceder al PASO 4

---

### PASO 4: Ejecutar Migración 🚀

Hay 2 formas de ejecutar la migración:

#### Opción A: Usando TypeORM CLI (Recomendado)

```bash
# Desarrollo
npm run db:dev

# Producción
npm run db:deploy
```

**Resultado esperado:**
```
📋 Iniciando migración: add-voucher-amount-constraint...
✅ Constraint check_amount_valid agregado correctamente
   - Rechaza: NaN, Infinity, -Infinity, valores <= 0
   - Acepta: Solo números positivos válidos
```

---

#### Opción B: Ejecutar SQL directamente

```sql
-- Conectar a la base de datos
psql $DATABASE_URL

-- Ejecutar constraint
ALTER TABLE vouchers
ADD CONSTRAINT check_amount_valid
CHECK (
  amount > 0 AND                  -- Solo valores positivos
  amount < 'Infinity'::float AND  -- No permite Infinity
  amount = amount                 -- Rechaza NaN (NaN != NaN)
);
```

**Resultado esperado:**
```
ALTER TABLE
```

---

### PASO 5: Verificar Constraint ✅

Después de ejecutar la migración, verifica que el constraint fue creado:

```sql
-- Ver constraint
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'check_amount_valid';
```

**Resultado esperado:**
```
   constraint_name   |                    constraint_definition
---------------------+--------------------------------------------------------------
 check_amount_valid  | CHECK (((amount > (0)::double precision) AND
                     |        (amount < 'Infinity'::double precision) AND
                     |        (amount = amount)))
(1 row)
```

---

### PASO 6: Probar Constraint 🧪

Verifica que el constraint está funcionando correctamente:

```sql
-- Test 1: Intentar insertar NaN (DEBE FALLAR)
INSERT INTO vouchers (date, amount, confirmation_status)
VALUES (NOW(), 'NaN'::float, false);

-- Resultado esperado:
-- ERROR: new row for relation "vouchers" violates check constraint "check_amount_valid"
-- DETAIL: Failing row contains (..., NaN, ...).


-- Test 2: Intentar insertar monto negativo (DEBE FALLAR)
INSERT INTO vouchers (date, amount, confirmation_status)
VALUES (NOW(), -100.50, false);

-- Resultado esperado:
-- ERROR: new row for relation "vouchers" violates check constraint "check_amount_valid"


-- Test 3: Intentar insertar monto cero (DEBE FALLAR)
INSERT INTO vouchers (date, amount, confirmation_status)
VALUES (NOW(), 0, false);

-- Resultado esperado:
-- ERROR: new row for relation "vouchers" violates check constraint "check_amount_valid"


-- Test 4: Insertar monto válido (DEBE FUNCIONAR)
INSERT INTO vouchers (date, amount, confirmation_status)
VALUES (NOW(), 1000.15, false);

-- Resultado esperado:
-- INSERT 0 1


-- Limpiar test
DELETE FROM vouchers WHERE amount = 1000.15 AND confirmation_status = false;
```

---

## ✅ Checklist Post-Migración

Después de ejecutar la migración, verifica:

- [ ] La migración se ejecutó sin errores
- [ ] El constraint `check_amount_valid` existe en la tabla `vouchers`
- [ ] Los tests de constraint funcionan correctamente
- [ ] No hay registros existentes con amount inválido
- [ ] El build de la aplicación compila sin errores
- [ ] La aplicación puede crear vouchers normalmente

---

## 🔄 Rollback (si es necesario)

Si necesitas revertir la migración por alguna razón:

### Opción A: TypeORM CLI
```bash
npm run db:revert
```

### Opción B: SQL directo
```sql
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS check_amount_valid;
```

---

## 📊 Queries Útiles Post-Migración

### Ver todos los constraints de la tabla vouchers
```sql
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'vouchers'::regclass
ORDER BY conname;
```

### Estadísticas de vouchers
```sql
SELECT
  COUNT(*) as total_vouchers,
  COUNT(*) FILTER (WHERE confirmation_status = true) as confirmados,
  COUNT(*) FILTER (WHERE confirmation_status = false) as pendientes,
  MIN(amount) as monto_minimo,
  MAX(amount) as monto_maximo,
  AVG(amount) as monto_promedio,
  SUM(amount) FILTER (WHERE confirmation_status = true) as total_confirmado
FROM vouchers;
```

### Vouchers creados hoy
```sql
SELECT
  id,
  amount,
  date,
  confirmation_code,
  confirmation_status,
  created_at
FROM vouchers
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;
```

---

## 🚨 Troubleshooting

### Error: "violates check constraint check_amount_valid"

**Causa:** Intentas insertar un voucher con amount inválido

**Solución:** Verifica que el amount sea:
- Un número válido (no NaN, no Infinity)
- Mayor a 0

**Ejemplo de código correcto:**
```typescript
const amount = parseFloat(montoString);

if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
  throw new Error('Amount inválido');
}

await voucherRepository.create({ amount, ... });
```

---

### Error: "constraint already exists"

**Causa:** Ya ejecutaste la migración anteriormente

**Solución:**
```sql
-- Verificar si existe
SELECT 1 FROM pg_constraint WHERE conname = 'check_amount_valid';

-- Si existe y quieres recrearlo:
ALTER TABLE vouchers DROP CONSTRAINT check_amount_valid;
ALTER TABLE vouchers ADD CONSTRAINT check_amount_valid CHECK (...);
```

---

### Error: "cannot add check constraint - existing data violates constraint"

**Causa:** Hay registros existentes con amount inválido

**Solución:** Vuelve al PASO 2 y corrige los registros inválidos primero

---

## 📚 Referencias

### Archivos Relacionados
- **Migración:** `src/shared/database/migrations/1729622400000-add-voucher-amount-constraint.ts`
- **Validación en código:** `src/features/vouchers/application/confirm-voucher.use-case.ts:95-121`
- **Validación en helper:** `src/features/vouchers/shared/helpers/confirmation-code.helper.ts:23-38`

### Documentación
- [ANALISIS-PROBLEMA-NAN-AMOUNT.md](./ANALISIS-PROBLEMA-NAN-AMOUNT.md) - Análisis del problema
- [VALIDACION-AMOUNT-IMPLEMENTADA.md](./VALIDACION-AMOUNT-IMPLEMENTADA.md) - Validaciones en código
- PostgreSQL CHECK constraints: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS

---

## 💡 Consejos

1. **Siempre haz backup** antes de modificar datos en producción
2. **Ejecuta primero en desarrollo** para validar que funciona
3. **Coordina con el equipo** antes de ejecutar en producción
4. **Monitorea los logs** después de la migración por 24-48 horas
5. **Documenta cualquier issue** que encuentres

---

**Creado por:** Claude Code
**Fecha:** Octubre 22, 2025
**Estado:** ✅ Listo para ejecutar
**Prioridad:** Alta (previene corrupción de datos)
