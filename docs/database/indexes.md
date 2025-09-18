# Database Indexes - Performance Optimization

## Overview

Este documento describe todos los índices implementados en el módulo de transacciones bancarias para optimizar el rendimiento de consultas frecuentes.

## Partial Indexes

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

## Recommended Additional Indexes

Para casos de uso específicos, se recomienda considerar estos índices adicionales:

### Bank and Date Composite Index
```sql
CREATE INDEX idx_transactions_bank_bank_date
ON transactions_bank (bank_name, date);
```

**Optimiza:**
```sql
SELECT * FROM transactions_bank
WHERE bank_name = 'Santander' AND date >= '2024-01-01';
```

### Date Range Index
```sql
CREATE INDEX idx_transactions_bank_date
ON transactions_bank (date);
```

**Optimiza:**
```sql
SELECT * FROM transactions_bank
WHERE date BETWEEN '2024-01-01' AND '2024-01-31';
```

### High Amount Partial Index
```sql
CREATE INDEX idx_transactions_bank_high_amount
ON transactions_bank (amount)
WHERE amount > 100000;
```

**Optimiza:**
```sql
SELECT * FROM transactions_bank
WHERE amount > 100000;
```

### Bank Name Pattern Index
```sql
CREATE INDEX idx_transactions_bank_bank_name_pattern
ON transactions_bank (bank_name)
WHERE bank_name IS NOT NULL;
```

**Optimiza:**
```sql
SELECT * FROM transactions_bank
WHERE bank_name LIKE 'Santander%';
```

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

## Future Considerations

### Scaling Strategies

1. **Partitioning by Date**
   - Cuando la tabla supere 10M+ registros
   - Partición mensual o anual

2. **Additional Partial Indexes**
   - Por tipo de moneda: `WHERE currency = 'USD'`
   - Por rangos de monto: `WHERE amount > 10000`

3. **Expression Indexes**
   - Para búsquedas de texto: `LOWER(concept)`
   - Para cálculos frecuentes: `(amount * exchange_rate)`