# Database Indexes - Performance Optimization

## Overview

Este documento describe todos los índices implementados en el sistema para optimizar el rendimiento de consultas frecuentes. La arquitectura de índices se optimizó en la versión 3.2.0 (Enero 2026) para mejorar el sistema de conciliación bancaria automática y validación manual.

## Version History

| Versión | Cambios | Fecha |
|---------|---------|-------|
| 3.2.0 | Agregados 6 índices nuevos para conciliación bancaria | Enero 2026 |
| 3.1.0 | Índices iniciales de manual_validation_approvals | Noviembre 2025 |

## Performance Indexes (v3.2.0)

These indexes were added in version 3.2.0 to optimize the bank reconciliation system:

### idx_transactions_bank_date

Partial index on transactions_bank for date range queries.

#### Definition
```sql
CREATE INDEX idx_transactions_bank_date
ON transactions_bank (date DESC)
WHERE is_deposit = true;
```

#### Purpose
Optimizes range queries for deposits by date, used in:
- `findByDateRange()` - filtrado por rango de fechas
- Dashboard de reportes - exportación de transacciones
- Búsquedas por período

#### Optimized Queries
```sql
SELECT * FROM transactions_bank
WHERE date >= '2024-01-01' AND date <= '2024-01-31'
  AND is_deposit = true;

SELECT COUNT(*) FROM transactions_bank
WHERE date >= '2024-01-01' AND is_deposit = true;
```

#### Benefits
- **Performance**: 10-20x más rápido que table scan
- **Coverage**: Solo cubre depósitos (is_deposit=true)
- **Space**: ~100MB estimado

---

### idx_transactions_bank_date_bank

Composite partial index for date + bank_name queries.

#### Definition
```sql
CREATE INDEX idx_transactions_bank_date_bank
ON transactions_bank (date DESC, bank_name)
WHERE is_deposit = true;
```

#### Purpose
Optimizes searches by both date range AND bank_name, used in:
- `findTransactionsByDateAndBank()` - búsquedas por banco
- Reportes por banco
- Conciliación por institución financiera

#### Optimized Queries
```sql
SELECT * FROM transactions_bank
WHERE date >= '2024-01-01' AND date <= '2024-01-31'
  AND bank_name = 'BANCO_VALOR'
  AND is_deposit = true;
```

#### Benefits
- **Performance**: 5-10x más rápido que table scan
- **Coverage**: Cubre tanto date como bank_name en una búsqueda
- **Space**: ~150MB estimado

---

### idx_transaction_status_validation_status

Partial index on transaction_status for validation state filtering.

#### Definition
```sql
CREATE INDEX idx_transaction_status_validation_status
ON transactions_status (validation_status)
WHERE validation_status IN ('requires-manual', 'not-found', 'conflict');
```

#### Purpose
Optimizes queries that need to find transactions requiring action:
- `getPendingManualCases()` - listado de casos pendientes
- `getManualValidationStats()` - estadísticas de validación
- `getUnclaimedDeposits()` - depósitos no reclamados

#### Optimized Queries
```sql
-- Casos pendientes de validación manual
SELECT COUNT(*) FROM transactions_status
WHERE validation_status = 'requires-manual';

-- Depósitos no reclamados
SELECT * FROM transactions_status
WHERE validation_status IN ('not-found', 'conflict');
```

#### Benefits
- **Performance**: 20-50x más rápido que table scan (especialmente COUNT queries)
- **Coverage**: Solo cubre ~5% de registros (estados accionables)
- **Space**: ~50MB estimado
- **Impact**: Crítico para dashboard performance

---

### idx_transaction_status_created_at

Index on transaction_status for ordering in paginated queries.

#### Definition
```sql
CREATE INDEX idx_transaction_status_created_at
ON transactions_status (created_at DESC);
```

#### Purpose
Optimizes sorting and pagination:
- `getPendingManualCases()` - ORDER BY created_at DESC
- `getUnclaimedDeposits()` - paginación con ORDER BY
- Avoids expensive sort operations in memory

#### Optimized Queries
```sql
SELECT * FROM transactions_status
WHERE validation_status = 'requires-manual'
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

#### Benefits
- **Performance**: 5-10x más rápido (avoid sort in memory)
- **Impact**: Essential para paginación eficiente
- **Space**: ~80MB estimado

---

### idx_vouchers_confirmation_status

Partial index on vouchers for pending (unconfirmed) vouchers.

#### Definition
```sql
CREATE INDEX idx_vouchers_confirmation_status
ON vouchers (confirmation_status)
WHERE confirmation_status = false;
```

#### Purpose
Optimizes queries to find available vouchers for matching:
- `findByConfirmationStatus(false)` - obtener vouchers disponibles
- `findByConfirmationStatusWithHouse()` - vouchers con casas asociadas
- Matching logic durante conciliación automática

#### Optimized Queries
```sql
-- Obtener vouchers disponibles para matching
SELECT v.* FROM vouchers v
WHERE v.confirmation_status = false;

-- Contar vouchers pendientes
SELECT COUNT(*) FROM vouchers
WHERE confirmation_status = false;
```

#### Benefits
- **Performance**: 100x más rápido (reduce 1M registros a ~10K)
- **Impact**: CRÍTICO para performance de conciliación automática
- **Coverage**: Solo indexa ~0.67% de registros (vouchers pendientes)
- **Space**: ~50MB estimado

---

### idx_vouchers_date

Index on vouchers for date range queries.

#### Definition
```sql
CREATE INDEX idx_vouchers_date
ON vouchers (date DESC);
```

#### Purpose
Optimizes date-based searches on vouchers:
- Range queries en vouchers
- Matching by date proximity
- Reportes por período de vouchers

#### Optimized Queries
```sql
SELECT * FROM vouchers
WHERE date >= '2024-01-01' AND date <= '2024-01-31'
ORDER BY date DESC;
```

#### Benefits
- **Performance**: 5-10x más rápido que table scan
- **Complement**: Trabaja junto con idx_vouchers_confirmation_status
- **Space**: ~60MB estimado

---

## Legacy Partial Indexes

### idx_transactions_bank_deposits_unconfirmed

Índice parcial especializado para consultas de depósitos no confirmados.

#### Definition
```sql
CREATE INDEX idx_transactions_bank_deposits_unconfirmed
ON transactions_bank (is_deposit, confirmation_status)
WHERE is_deposit = true AND confirmation_status = false;
```

#### Purpose
Optimiza consultas frecuentes para encontrar depósitos que requieren confirmación manual.

#### Optimized Queries
```sql
-- Query principal optimizada
SELECT * FROM transactions_bank
WHERE is_deposit = true AND confirmation_status = false;

-- Queries con filtros adicionales (también se benefician)
SELECT * FROM transactions_bank
WHERE is_deposit = true
  AND confirmation_status = false
  AND date >= '2024-01-01';

SELECT COUNT(*) FROM transactions_bank
WHERE is_deposit = true AND confirmation_status = false;
```

#### Benefits

| Aspecto | Beneficio |
|---------|-----------|
| **Tamaño** | Solo indexa registros relevantes (~5-10% de tabla típica) |
| **Performance** | Consultas 10-100x más rápidas en tablas grandes |
| **Mantenimiento** | Actualizaciones automáticas solo para registros relevantes |
| **Espacio** | Significativamente menor que índice completo |

#### Use Cases

1. **Dashboard de Administración**
   - Mostrar depósitos pendientes de validación
   - Conteo de transacciones no confirmadas

2. **Procesos de Reconciliación**
   - Identificar depósitos que requieren revisión manual
   - Reportes de transacciones pendientes

3. **Alertas y Notificaciones**
   - Detectar acumulación de depósitos sin confirmar
   - Métricas de procesamiento

#### Location
```
src/shared/database/indexes/deposits_unconfirmed_index.sql
```

## Primary Indexes

### transactions_bank Primary Key
```sql
-- Automático por definición de tabla
id BIGINT PRIMARY KEY
```

**Optimiza:**
- Búsquedas por ID específico
- JOINs con otras tablas
- Operaciones CRUD individuales

### last_transaction_bank Primary Key
```sql
-- Automático por definición de tabla
id INTEGER PRIMARY KEY
```

**Optimiza:**
- Control de última transacción procesada
- Relaciones con transactions_bank

## Foreign Key Indexes

### FK_last_transaction_bank_transactions_bank_id
```sql
-- Automático por foreign key constraint
FOREIGN KEY (transactions_bank_id) REFERENCES transactions_bank(id)
```

**Optimiza:**
- JOINs entre last_transaction_bank y transactions_bank
- Operaciones CASCADE en deletes/updates

## Recommended Additional Indexes (Future)

Para casos de uso específicos que aún no están implementados, se recomienda considerar estos índices adicionales:

### High Amount Partial Index
Cuando haya queries frecuentes para transacciones de alto monto.

```sql
CREATE INDEX idx_transactions_bank_high_amount
ON transactions_bank (amount)
WHERE amount > 100000;
```

**Casos de uso:**
```sql
SELECT * FROM transactions_bank
WHERE amount > 100000;
```

### Bank Name Pattern Index
Cuando haya búsquedas por patrón de nombre de banco.

```sql
CREATE INDEX idx_transactions_bank_bank_name_pattern
ON transactions_bank (bank_name)
WHERE bank_name IS NOT NULL;
```

**Casos de uso:**
```sql
SELECT * FROM transactions_bank
WHERE bank_name LIKE 'Santander%';
```

**Nota:** idx_transactions_bank_date_bank ya cubre búsquedas combinadas de fecha + banco, que es el caso más común.

## Complete Index Summary (v3.2.0)

| Índice | Tabla | Campos | Tipo | Mejora | Uso Crítico |
|--------|-------|--------|------|--------|------------|
| `idx_transactions_bank_date` | transactions_bank | date DESC | Parcial | 10-20x | SÍ |
| `idx_transactions_bank_date_bank` | transactions_bank | date DESC, bank_name | Parcial | 5-10x | MEDIA |
| `idx_transactions_bank_deposits_unconfirmed` | transactions_bank | is_deposit, confirmation_status | Parcial | 10-100x | SÍ |
| `idx_transaction_status_validation_status` | transactions_status | validation_status | Parcial | 20-50x | SÍ |
| `idx_transaction_status_created_at` | transactions_status | created_at DESC | Simple | 5-10x | SÍ |
| `idx_vouchers_confirmation_status` | vouchers | confirmation_status | Parcial | 100x | SÍ |
| `idx_vouchers_date` | vouchers | date DESC | Simple | 5-10x | MEDIA |

**Impacto total estimado en reconciliación:**
- Reconciliación automática: 30-40s → 2-5s (10-20x más rápido)
- Dashboard validación manual: 5-10s → 100-500ms (10-50x más rápido)
- Depósitos no reclamados: 5-10s → 500ms-1s (10-20x más rápido)

---

## Index Performance Analysis

### Monitoring Queries

#### Index Usage Statistics
```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'transactions_bank'
ORDER BY idx_scan DESC;
```

#### Index Size Information
```sql
SELECT
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename = 'transactions_bank'
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### Query Performance Analysis
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM transactions_bank
WHERE is_deposit = true AND confirmation_status = false;
```

### Expected Performance Metrics

#### Without Index (Full Table Scan)
```
Seq Scan on transactions_bank (cost=0.00..25000.00 rows=1000 width=64)
  Filter: (is_deposit AND (NOT confirmation_status))
  Rows Removed by Filter: 99000
Planning Time: 0.1 ms
Execution Time: 45.2 ms
```

#### With Partial Index
```
Index Scan using idx_transactions_bank_deposits_unconfirmed (cost=0.28..120.50 rows=1000 width=64)
Planning Time: 0.2 ms
Execution Time: 2.1 ms
```

**Improvement: ~95% faster**

## Installation & Management

### Installation
```bash
# Instalar todos los componentes de BD
npm run db:setup

# Solo índices
npm run db:install-indexes
```

### Verification
```sql
-- Verificar índices existentes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'transactions_bank'
ORDER BY indexname;

-- Verificar índice específico
\d+ transactions_bank
```

### Maintenance Commands

#### Rebuild Index
```sql
REINDEX INDEX idx_transactions_bank_deposits_unconfirmed;
```

#### Analyze Statistics
```sql
ANALYZE transactions_bank;
```

#### Drop Index (if needed)
```sql
DROP INDEX IF EXISTS idx_transactions_bank_deposits_unconfirmed;
```

## Best Practices

### Index Design Guidelines

1. **Partial Indexes para Subconjuntos**
   - Usar cuando solo un porcentaje pequeño de filas es relevante
   - Incluir condición WHERE específica y selectiva

2. **Composite Indexes Orden**
   - Columna más selectiva primero
   - Considera patrones de consulta frecuentes

3. **Evitar Over-Indexing**
   - Cada índice tiene costo de mantenimiento
   - Analizar realmente si se usa con `pg_stat_user_indexes`

### Query Optimization Tips

1. **Usar EXPLAIN ANALYZE**
   - Verificar que el índice se está usando
   - Medir performance real vs esperada

2. **WHERE Clause Matching**
   - Condiciones deben coincidir exactamente con índice parcial
   - Usar same data types y operadores

3. **Index Hints (si es necesario)**
   ```sql
   SET enable_seqscan = OFF; -- Forzar uso de índice para testing
   ```

## Troubleshooting

### Problemas Comunes

1. **Índice no se usa**
   - Verificar estadísticas: `ANALYZE transactions_bank`
   - Confirmar WHERE clause coincide con condición del índice
   - Revisar selectividad de la consulta

2. **Performance no mejora**
   - Verificar que hay suficientes datos para beneficiarse
   - Analizar si el índice es demasiado general
   - Considerar índice compuesto en lugar de simple

3. **Espacio de almacenamiento alto**
   - Considerar índices parciales en lugar de completos
   - Evaluar si todos los índices son necesarios
   - Ejecutar `VACUUM` y `REINDEX` periódicamente

### Debugging Tools

```sql
-- Ver plan de ejecución detallado
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM transactions_bank
WHERE is_deposit = true AND confirmation_status = false;

-- Verificar estadísticas de columnas
SELECT
    attname,
    n_distinct,
    most_common_vals,
    most_common_freqs
FROM pg_stats
WHERE tablename = 'transactions_bank';
```

## Migration Information (v3.2.0)

Los índices nuevos se agregan mediante la migración TypeORM:

**Archivo:** `src/shared/database/migrations/1761900000000-AddPerformanceIndexes.ts`

**Ejecutar migración:**
```bash
npm run typeorm migration:run
```

**Verificar índices creados:**
```bash
psql agave_db -c "\di" | grep "idx_"
```

**Actualizar estadísticas (importante después de crear índices):**
```bash
psql agave_db -c "ANALYZE transactions_bank; ANALYZE transactions_status; ANALYZE vouchers;"
```

---

## Future Considerations

### Scaling Strategies

1. **Partitioning by Date**
   - Cuando la tabla supere 10M+ registros
   - Partición mensual o anual
   - Reduce tamaño de índices aún más

2. **Additional Partial Indexes**
   - Por tipo de moneda: `WHERE currency = 'USD'`
   - Por rangos de monto: `WHERE amount > 10000`
   - Por montos altos: `WHERE amount > 100000` (ya documentado como futura)

3. **Expression Indexes**
   - Para búsquedas de texto: `LOWER(concept)`
   - Para cálculos frecuentes: `(amount * exchange_rate)`

4. **Materialized Views**
   - Para estadísticas de validación manual (actualmente 4 queries COUNT)
   - Cache de resultados de reconciliación
   - Reportes agregados por período

5. **Denormalization**
   - Agregar `validation_status` a TransactionBank para evitar JOINs costosos
   - Agregar `status` denormalizado para rápido acceso

### Performance Targets (v3.2.0)

| Operación | Objetivo |
|-----------|----------|
| Reconciliación completa | < 5 segundos |
| Dashboard validación manual | < 1 segundo |
| Estadísticas de validación | < 500ms (4 queries) |
| Depósitos no reclamados | < 2 segundos (con paginación) |
| Exportación CSV/JSON | < 10 segundos (hasta 100K registros) |

**Monitoreo:**
```bash
# Ver tiempos de ejecución en logs
grep "Conciliación completada\|Duración" app.log

# Analyzeplan de ejecución
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```