# Queries SQL - Conciliación Bancaria

## 📋 Descripción

Colección de queries SQL útiles para consultar, analizar y dar seguimiento a los resultados de conciliación bancaria almacenados en la tabla `transactions_status`.

**Fecha:** Octubre 22, 2025

---

## 📊 1. Consultas de Resumen

### 1.1 Resumen General de Última Conciliación

```sql
SELECT
  validation_status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM transactions_status
WHERE processed_at > NOW() - INTERVAL '1 hour'
GROUP BY validation_status
ORDER BY total DESC;
```

**Resultado esperado:**
```
validation_status    | total | porcentaje
---------------------+-------+-----------
confirmed            |    65 |     81.25
not-found            |     8 |     10.00
requires-manual      |     5 |      6.25
conflict             |     2 |      2.50
```

---

### 1.2 Estadísticas por Día

```sql
SELECT
  DATE(processed_at) as fecha,
  validation_status,
  COUNT(*) as total
FROM transactions_status
WHERE processed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(processed_at), validation_status
ORDER BY fecha DESC, validation_status;
```

---

### 1.3 Total de Transacciones Procesadas vs Pendientes

```sql
-- Total de transacciones de depósito
WITH total_deposits AS (
  SELECT COUNT(*) as total
  FROM transactions_bank
  WHERE is_deposit = true
),
-- Transacciones procesadas (con TransactionStatus)
processed AS (
  SELECT COUNT(*) as total
  FROM transactions_bank tb
  INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
  WHERE tb.is_deposit = true
),
-- Transacciones pendientes (sin TransactionStatus y sin conciliar)
pending AS (
  SELECT COUNT(*) as total
  FROM transactions_bank tb
  LEFT JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
  WHERE tb.is_deposit = true
    AND tb.confirmation_status = false
    AND ts.id IS NULL
)

SELECT
  (SELECT total FROM total_deposits) as total_depositos,
  (SELECT total FROM processed) as procesadas,
  (SELECT total FROM pending) as pendientes,
  ROUND((SELECT total FROM processed) * 100.0 / (SELECT total FROM total_deposits), 2) as porcentaje_procesado;
```

**Resultado esperado:**
```
total_depositos | procesadas | pendientes | porcentaje_procesado
----------------+------------+------------+---------------------
           1000 |        800 |        200 |                80.00
```

---

## 🔍 2. Consultas de Sobrantes

### 2.1 Ver Todos los Sobrantes (Conflictos y No Encontrados)

```sql
SELECT
  tb.id as transaction_id,
  tb.amount,
  tb.date as transaction_date,
  tb.concept,
  ts.validation_status,
  ts.reason,
  ts.identified_house_number,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('conflict', 'not-found')
ORDER BY ts.processed_at DESC;
```

---

### 2.2 Sobrantes por Tipo (Conflicto vs No Encontrado)

```sql
SELECT
  ts.validation_status,
  COUNT(*) as total,
  MIN(tb.amount) as monto_minimo,
  MAX(tb.amount) as monto_maximo,
  AVG(tb.amount) as monto_promedio
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('conflict', 'not-found')
GROUP BY ts.validation_status;
```

---

### 2.3 Sobrantes con Casa Identificada (Conflictos)

```sql
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.identified_house_number as casa_sugerida,
  ts.reason,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'conflict'
  AND ts.identified_house_number IS NOT NULL
ORDER BY ts.processed_at DESC;
```

---

### 2.4 Sobrantes sin Información (Not Found)

```sql
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.reason,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'not-found'
ORDER BY ts.processed_at DESC;
```

---

## 🛠️ 3. Consultas de Casos Manuales

### 3.1 Ver Todos los Casos que Requieren Validación Manual

```sql
SELECT
  tb.id as transaction_id,
  tb.amount,
  tb.date as transaction_date,
  tb.concept,
  ts.reason,
  jsonb_array_length(ts.metadata->'possibleMatches') as num_candidatos,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'requires-manual'
ORDER BY ts.processed_at DESC;
```

---

### 3.2 Detalle de Candidatos para un Caso Manual Específico

```sql
SELECT
  tb.id as transaction_id,
  tb.amount as transaction_amount,
  tb.date as transaction_date,
  tb.concept as transaction_concept,
  ts.reason,
  jsonb_pretty(ts.metadata->'possibleMatches') as candidatos
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'requires-manual'
  AND tb.id = 'TRANSACTION_ID_AQUI';  -- Reemplazar con ID real
```

**Resultado esperado:**
```
transaction_id | transaction_amount | transaction_date    | transaction_concept | reason                    | candidatos
---------------+--------------------+---------------------+---------------------+---------------------------+------------
tx123          |            1000.15 | 2025-10-15 10:00:00 | DEPOSITO CASA 15    | Múltiples vouchers...     | [
               |                    |                     |                     |                           |   {
               |                    |                     |                     |                           |     "voucherId": 1,
               |                    |                     |                     |                           |     "similarity": 0.95,
               |                    |                     |                     |                           |     "dateDifferenceHours": 2
               |                    |                     |                     |                           |   },
               |                    |                     |                     |                           |   {
               |                    |                     |                     |                           |     "voucherId": 2,
               |                    |                     |                     |                           |     "similarity": 0.92,
               |                    |                     |                     |                           |     "dateDifferenceHours": 5
               |                    |                     |                     |                           |   }
               |                    |                     |                     |                           | ]
```

---

### 3.3 Casos Manuales con Candidatos y Detalles de Vouchers

```sql
SELECT
  tb.id as transaction_id,
  tb.amount as tx_amount,
  tb.date as tx_date,
  tb.concept as tx_concept,
  (match_item->>'voucherId')::int as voucher_id,
  (match_item->>'similarity')::numeric as similarity_score,
  (match_item->>'dateDifferenceHours')::int as hours_diff,
  v.amount as voucher_amount,
  v.date as voucher_date,
  v.house_number as voucher_casa
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
CROSS JOIN LATERAL jsonb_array_elements(ts.metadata->'possibleMatches') as match_item
LEFT JOIN vouchers v ON v.id = (match_item->>'voucherId')::int
WHERE ts.validation_status = 'requires-manual'
ORDER BY tb.id, (match_item->>'similarity')::numeric DESC;
```

**Resultado esperado:**
```
transaction_id | tx_amount | tx_date             | tx_concept       | voucher_id | similarity_score | hours_diff | voucher_amount | voucher_date        | voucher_casa
---------------+-----------+---------------------+------------------+------------+------------------+------------+----------------+---------------------+-------------
tx123          |   1000.15 | 2025-10-15 10:00:00 | DEPOSITO CASA 15 |          1 |             0.95 |          2 |           1000 | 2025-10-15 10:05:00 |           15
tx123          |   1000.15 | 2025-10-15 10:00:00 | DEPOSITO CASA 15 |          2 |             0.92 |          5 |           1000 | 2025-10-15 10:10:00 |           15
```

---

### 3.4 Casos Manuales Ordenados por Número de Candidatos

```sql
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  jsonb_array_length(ts.metadata->'possibleMatches') as num_candidatos,
  ts.reason,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'requires-manual'
ORDER BY jsonb_array_length(ts.metadata->'possibleMatches') DESC, ts.processed_at DESC;
```

---

## ✅ 4. Consultas de Conciliados

### 4.1 Ver Conciliaciones Exitosas Recientes

```sql
SELECT
  tb.id as transaction_id,
  tb.amount as transaction_amount,
  tb.date as transaction_date,
  tb.concept,
  ts.vouchers_id,
  v.amount as voucher_amount,
  v.date as voucher_date,
  v.house_number as casa,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
LEFT JOIN vouchers v ON v.id = ts.vouchers_id
WHERE ts.validation_status = 'confirmed'
  AND ts.processed_at > NOW() - INTERVAL '24 hours'
ORDER BY ts.processed_at DESC;
```

---

### 4.2 Conciliaciones Automáticas (sin Voucher)

```sql
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.identified_house_number as casa_identificada,
  ts.reason,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'confirmed'
  AND ts.vouchers_id IS NULL
ORDER BY ts.processed_at DESC;
```

---

### 4.3 Conciliaciones con Voucher

```sql
SELECT
  tb.id as transaction_id,
  tb.amount as tx_amount,
  v.id as voucher_id,
  v.amount as voucher_amount,
  ABS(tb.amount - v.amount) as diferencia_monto,
  EXTRACT(EPOCH FROM (v.date - tb.date))/3600 as diferencia_horas,
  v.house_number as casa,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
INNER JOIN vouchers v ON v.id = ts.vouchers_id
WHERE ts.validation_status = 'confirmed'
  AND ts.vouchers_id IS NOT NULL
ORDER BY ts.processed_at DESC;
```

---

### 4.4 Conciliaciones por Casa

```sql
SELECT
  COALESCE(v.house_number, ts.identified_house_number) as casa,
  COUNT(*) as total_conciliados,
  SUM(tb.amount) as monto_total,
  AVG(tb.amount) as monto_promedio,
  MIN(ts.processed_at) as primera_conciliacion,
  MAX(ts.processed_at) as ultima_conciliacion
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
LEFT JOIN vouchers v ON v.id = ts.vouchers_id
WHERE ts.validation_status = 'confirmed'
GROUP BY COALESCE(v.house_number, ts.identified_house_number)
ORDER BY total_conciliados DESC;
```

---

## 📅 5. Consultas de Auditoría

### 5.1 Auditoría Completa de una Transacción

```sql
SELECT
  tb.id,
  tb.amount,
  tb.date as transaction_date,
  tb.concept,
  tb.is_deposit,
  tb.confirmation_status,
  ts.validation_status,
  ts.vouchers_id,
  ts.reason,
  ts.identified_house_number,
  ts.processed_at,
  ts.metadata,
  ts.created_at as status_created_at,
  ts.updated_at as status_updated_at
FROM transactions_bank tb
LEFT JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE tb.id = 'TRANSACTION_ID_AQUI'  -- Reemplazar con ID real
ORDER BY ts.created_at DESC;
```

---

### 5.2 Historial de Procesamiento por Rango de Fechas

```sql
SELECT
  DATE(ts.processed_at) as fecha_procesamiento,
  ts.validation_status,
  COUNT(*) as total,
  ARRAY_AGG(tb.id ORDER BY ts.processed_at) as transaction_ids
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.processed_at BETWEEN '2025-10-01' AND '2025-10-31'
GROUP BY DATE(ts.processed_at), ts.validation_status
ORDER BY fecha_procesamiento DESC, ts.validation_status;
```

---

### 5.3 Transacciones Reprocesadas (Duplicados)

```sql
SELECT
  ts.transactions_bank_id,
  COUNT(*) as veces_procesado,
  ARRAY_AGG(ts.validation_status ORDER BY ts.processed_at) as estados,
  ARRAY_AGG(ts.processed_at ORDER BY ts.processed_at) as fechas_procesamiento
FROM transactions_status ts
GROUP BY ts.transactions_bank_id
HAVING COUNT(*) > 1
ORDER BY veces_procesado DESC;
```

**Nota:** Si el sistema funciona correctamente (FASE 5 implementada), este query NO debería retornar resultados.

---

### 5.4 Últimas Modificaciones en TransactionStatus

```sql
SELECT
  ts.transactions_bank_id,
  tb.amount,
  tb.date as transaction_date,
  ts.validation_status,
  ts.reason,
  ts.processed_at,
  ts.updated_at,
  EXTRACT(EPOCH FROM (ts.updated_at - ts.created_at))/60 as minutos_desde_creacion
FROM transactions_status ts
INNER JOIN transactions_bank tb ON tb.id = ts.transactions_bank_id
WHERE ts.updated_at > NOW() - INTERVAL '24 hours'
  AND ts.updated_at != ts.created_at  -- Solo registros actualizados
ORDER BY ts.updated_at DESC;
```

---

## 🔧 6. Consultas de Mantenimiento

### 6.1 Limpiar TransactionStatus Huérfanos

```sql
-- Primero verificar cuántos hay
SELECT COUNT(*) as huerfanos
FROM transactions_status ts
LEFT JOIN transactions_bank tb ON tb.id = ts.transactions_bank_id
WHERE tb.id IS NULL;

-- Si hay huérfanos, eliminarlos
DELETE FROM transactions_status ts
WHERE NOT EXISTS (
  SELECT 1 FROM transactions_bank tb
  WHERE tb.id = ts.transactions_bank_id
);
```

---

### 6.2 Recalcular Estadísticas de Última Semana

```sql
WITH stats AS (
  SELECT
    validation_status,
    COUNT(*) as total,
    MIN(processed_at) as desde,
    MAX(processed_at) as hasta
  FROM transactions_status
  WHERE processed_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY validation_status
)
SELECT
  validation_status,
  total,
  ROUND(total * 100.0 / SUM(total) OVER (), 2) as porcentaje,
  desde::date as primera_ejecucion,
  hasta::date as ultima_ejecucion
FROM stats
ORDER BY total DESC;
```

---

### 6.3 Identificar Sobrantes Candidatos a Reconciliación Manual

```sql
SELECT
  tb.id,
  tb.amount,
  tb.date as transaction_date,
  tb.concept,
  ts.validation_status,
  ts.reason,
  ts.identified_house_number as casa_sugerida,
  -- Buscar vouchers cercanos en fecha y monto
  (
    SELECT COUNT(*)
    FROM vouchers v
    WHERE ABS(v.amount - tb.amount) <= 10
      AND v.date BETWEEN tb.date - INTERVAL '24 hours' AND tb.date + INTERVAL '24 hours'
      AND v.confirmation_status = false
  ) as vouchers_similares_disponibles,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('conflict', 'not-found')
  AND ts.processed_at > NOW() - INTERVAL '7 days'
ORDER BY vouchers_similares_disponibles DESC, ts.processed_at DESC;
```

---

## 📈 7. Consultas Avanzadas

### 7.1 Análisis de Efectividad de Conciliación

```sql
WITH totals AS (
  SELECT
    validation_status,
    COUNT(*) as total
  FROM transactions_status
  WHERE processed_at > NOW() - INTERVAL '30 days'
  GROUP BY validation_status
)
SELECT
  validation_status,
  total,
  ROUND(total * 100.0 / SUM(total) OVER (), 2) as porcentaje,
  CASE
    WHEN validation_status = 'confirmed' THEN 'Exitoso ✅'
    WHEN validation_status = 'requires-manual' THEN 'Requiere Acción ⚠️'
    WHEN validation_status IN ('conflict', 'not-found') THEN 'Problema ❌'
    ELSE 'Otros'
  END as categoria
FROM totals
ORDER BY
  CASE
    WHEN validation_status = 'confirmed' THEN 1
    WHEN validation_status = 'requires-manual' THEN 2
    ELSE 3
  END;
```

---

### 7.2 Tiempo Promedio de Procesamiento (estimado)

```sql
SELECT
  DATE(processed_at) as fecha,
  COUNT(*) as transacciones_procesadas,
  MIN(processed_at) as inicio_procesamiento,
  MAX(processed_at) as fin_procesamiento,
  EXTRACT(EPOCH FROM (MAX(processed_at) - MIN(processed_at)))/60 as duracion_minutos
FROM transactions_status
WHERE processed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(processed_at)
ORDER BY fecha DESC;
```

**Nota:** Este query asume que todas las transacciones de un día se procesaron en una sola ejecución.

---

### 7.3 Distribución de Similarity Scores en Casos Manuales

```sql
SELECT
  ROUND((match_item->>'similarity')::numeric, 1) as similarity_range,
  COUNT(*) as total_candidatos,
  COUNT(DISTINCT ts.transactions_bank_id) as transacciones_afectadas
FROM transactions_status ts
CROSS JOIN LATERAL jsonb_array_elements(ts.metadata->'possibleMatches') as match_item
WHERE ts.validation_status = 'requires-manual'
GROUP BY ROUND((match_item->>'similarity')::numeric, 1)
ORDER BY similarity_range DESC;
```

**Resultado esperado:**
```
similarity_range | total_candidatos | transacciones_afectadas
-----------------+------------------+------------------------
             1.0 |               12 |                       8
             0.9 |               45 |                      20
             0.8 |               30 |                      15
             0.7 |               10 |                       5
```

---

### 7.4 Razones Más Comunes de Sobrantes

```sql
SELECT
  ts.reason,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM transactions_status ts
WHERE ts.validation_status IN ('conflict', 'not-found')
  AND ts.processed_at > NOW() - INTERVAL '30 days'
GROUP BY ts.reason
ORDER BY total DESC
LIMIT 10;
```

---

## 🎯 8. Consultas para Validación Manual

### 8.1 Dashboard para Validador Manual

```sql
SELECT
  'Casos Manuales Pendientes' as tipo,
  COUNT(*) as total
FROM transactions_status
WHERE validation_status = 'requires-manual'

UNION ALL

SELECT
  'Sobrantes por Revisar' as tipo,
  COUNT(*) as total
FROM transactions_status
WHERE validation_status IN ('conflict', 'not-found')

UNION ALL

SELECT
  'Conciliados Hoy' as tipo,
  COUNT(*) as total
FROM transactions_status
WHERE validation_status = 'confirmed'
  AND processed_at::date = CURRENT_DATE;
```

---

### 8.2 Siguiente Caso Manual a Revisar (por antigüedad)

```sql
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.reason,
  jsonb_array_length(ts.metadata->'possibleMatches') as candidatos,
  jsonb_pretty(ts.metadata->'possibleMatches') as detalle_candidatos,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'requires-manual'
ORDER BY ts.processed_at ASC
LIMIT 1;
```

---

### 8.3 Resolver Caso Manual (actualizar a confirmed)

```sql
-- Primero verificar el caso
SELECT
  tb.id,
  tb.amount,
  ts.metadata->'possibleMatches' as candidatos
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE tb.id = 'TRANSACTION_ID_AQUI';

-- Luego actualizar (después de validación manual)
UPDATE transactions_status ts
SET
  validation_status = 'confirmed',
  vouchers_id = VOUCHER_ID_SELECCIONADO,  -- ID del voucher elegido
  reason = 'Validado manualmente',
  updated_at = NOW()
WHERE ts.transactions_bank_id = 'TRANSACTION_ID_AQUI';

-- Actualizar confirmation_status en ambas tablas
UPDATE transactions_bank
SET confirmation_status = true, updated_at = NOW()
WHERE id = 'TRANSACTION_ID_AQUI';

UPDATE vouchers
SET confirmation_status = true, updated_at = NOW()
WHERE id = VOUCHER_ID_SELECCIONADO;
```

---

## 💾 9. Índices Recomendados

Los siguientes índices ya están creados (FASE 1):

```sql
-- Índice para filtrar por validation_status
CREATE INDEX IF NOT EXISTS idx_transactions_status_validation_status
ON transactions_status(validation_status);

-- Índice para ordenar por processed_at
CREATE INDEX IF NOT EXISTS idx_transactions_status_processed_at
ON transactions_status(processed_at DESC);

-- Índice compuesto para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_transactions_status_validation_processed
ON transactions_status(validation_status, processed_at DESC);
```

---

## 📝 Notas de Uso

### JSONB Queries

Para acceder a campos dentro de `metadata`:
- `metadata->'possibleMatches'`: Retorna JSONB
- `metadata->>'possibleMatches'`: Retorna TEXT
- `jsonb_array_elements(metadata->'possibleMatches')`: Expande array

### Date Filters

```sql
-- Últimas 24 horas
WHERE processed_at > NOW() - INTERVAL '24 hours'

-- Hoy
WHERE processed_at::date = CURRENT_DATE

-- Rango específico
WHERE processed_at BETWEEN '2025-10-01' AND '2025-10-31'
```

### Performance Tips

1. **Usar índices**: Asegúrate de que `idx_transactions_status_validation_processed` exista
2. **LIMIT**: En queries exploratorias, usa LIMIT para evitar cargar miles de rows
3. **EXPLAIN**: Usa `EXPLAIN ANALYZE` antes de queries en producción
4. **Materialized Views**: Considera crear vistas materializadas para reports frecuentes

---

## 🔗 Referencias

- [FASE 1: Migraciones](./FASE1-VERIFICACION-EXITOSA.md)
- [FASE 2: Entidades](./FASE2-ENTIDADES-COMPLETADA.md)
- [FASE 3: Persistencia](./FASE3-PERSISTENCE-COMPLETADA.md)
- [Análisis de Persistencia](./ANALISIS-PERSISTENCIA-ESTADOS.md)

---

**Creado por:** Claude Code
**Fecha:** Octubre 22, 2025
**Versión:** 1.0
