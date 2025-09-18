# Database Triggers - Duplicate Detection

## Overview

El sistema implementa detección automática de duplicados a nivel de base de datos utilizando triggers SQL. Esto garantiza la integridad de los datos independientemente del código de aplicación.

## Trigger: check_transaction_duplicate

### Propósito

Prevenir la inserción de transacciones duplicadas aplicando reglas de negocio automáticamente antes de cada INSERT en la tabla `transactions_bank`.

### Ubicación

```
src/shared/database/functions/duplicate_detection.sql
```

### Función SQL

```sql
CREATE OR REPLACE FUNCTION check_transaction_duplicate()
RETURNS TRIGGER AS $$
DECLARE
    last_transaction_record RECORD;
    existing_duplicate_count INTEGER;
BEGIN
    -- 1. Obtener el último registro de last_transaction_bank
    SELECT tb.date, tb.time, tb.concept, tb.amount, tb.bank_name
    INTO last_transaction_record
    FROM last_transaction_bank ltb
    JOIN transactions_bank tb ON ltb.transactions_bank_id = tb.id
    ORDER BY ltb.created_at DESC
    LIMIT 1;

    -- 2. Aplicar reglas de negocio
    -- [Ver implementación completa en el archivo SQL]

    RETURN NEW; -- O RETURN NULL para ignorar
END;
$$ LANGUAGE plpgsql;
```

### Trigger Definition

```sql
CREATE TRIGGER trigger_check_transaction_duplicate
    BEFORE INSERT ON transactions_bank
    FOR EACH ROW
    EXECUTE FUNCTION check_transaction_duplicate();
```

## Business Rules

### 1. Sin Registro de Referencia
**Condición**: No existe registro en `last_transaction_bank`
**Acción**: ✅ Permitir inserción
**Razón**: Primera vez que se procesa el banco

### 2. Banco Diferente
**Condición**: `NEW.bank_name != last_transaction_record.bank_name`
**Acción**: ✅ Permitir inserción
**Razón**: Diferentes bancos pueden tener transacciones en las mismas fechas

### 3. Fecha Anterior
**Condición**: `NEW.date < last_transaction_record.date`
**Acción**: ⏭️ Ignorar inserción (RETURN NULL)
**Razón**: No procesar transacciones anteriores al último punto procesado

### 4. Fecha Posterior
**Condición**: `NEW.date > last_transaction_record.date`
**Acción**: ✅ Permitir inserción
**Razón**: Nuevas transacciones después del último procesamiento

### 5. Misma Fecha - Verificación Profunda
**Condición**: `NEW.date = last_transaction_record.date`
**Acción**: Verificar duplicado exacto

#### Criterios de Duplicado Exacto
Una transacción se considera duplicada si **TODOS** estos campos son idénticos:
- `date`
- `time`
- `concept`
- `amount`
- `bank_name`

**Si es duplicado**: ⏭️ Ignorar inserción (RETURN NULL)
**Si NO es duplicado**: ✅ Permitir inserción

## Comportamiento del Trigger

### Modo Silencioso
- Los duplicados se **ignoran** sin generar errores
- Retorna `NULL` para omitir la inserción
- Las operaciones por lotes continúan procesando otros registros

### Logging
```sql
RAISE NOTICE 'Ignorando transacción duplicada. Fecha: %, Hora: %, Concepto: %, Monto: %, Banco: %',
    NEW.date, NEW.time, NEW.concept, NEW.amount, NEW.bank_name;
```

### Manejo de Errores
- En caso de error en la función: permite la inserción para evitar pérdida de datos
- Los errores se logean pero no interrumpen el proceso

## Ejemplos de Uso

### Inserción Exitosa (No Duplicada)
```sql
INSERT INTO transactions_bank (date, time, concept, amount, bank_name, is_deposit, currency)
VALUES ('2024-01-15', '10:30:00', 'Transferencia', 1000.00, 'Santander', true, 'COP');
-- ✅ Se inserta correctamente
```

### Inserción Ignorada (Duplicada)
```sql
-- Primer INSERT
INSERT INTO transactions_bank (date, time, concept, amount, bank_name, is_deposit, currency)
VALUES ('2024-01-15', '10:30:00', 'Transferencia', 1000.00, 'Santander', true, 'COP');

-- Segundo INSERT (idéntico)
INSERT INTO transactions_bank (date, time, concept, amount, bank_name, is_deposit, currency)
VALUES ('2024-01-15', '10:30:00', 'Transferencia', 1000.00, 'Santander', true, 'COP');
-- ⏭️ Se ignora silenciosamente
```

### Inserción Exitosa (Diferente Monto)
```sql
INSERT INTO transactions_bank (date, time, concept, amount, bank_name, is_deposit, currency)
VALUES ('2024-01-15', '10:30:00', 'Transferencia', 1500.00, 'Santander', true, 'COP');
-- ✅ Se inserta (monto diferente = no es duplicado)
```

## Performance Impact

### Overhead Mínimo
- Solo una consulta adicional por INSERT
- Consulta optimizada con índices en `last_transaction_bank`
- Lógica simple en PL/pgSQL

### Beneficios vs Costo
✅ **Beneficios**:
- Integridad de datos garantizada
- Eliminación de lógica compleja en backend
- Consistencia independiente del código de aplicación

⚠️ **Costos**:
- Consulta adicional por cada INSERT (~1-2ms)
- Espacio mínimo para la función almacenada

## Installation & Management

### Instalación
```bash
npm run db:install-triggers
```

### Verificación
```sql
-- Verificar que el trigger existe
SELECT tgname FROM pg_trigger
WHERE tgname = 'trigger_check_transaction_duplicate';

-- Verificar que la función existe
SELECT proname FROM pg_proc
WHERE proname = 'check_transaction_duplicate';
```

### Desinstalación
```sql
DROP TRIGGER IF EXISTS trigger_check_transaction_duplicate ON transactions_bank;
DROP FUNCTION IF EXISTS check_transaction_duplicate();
```

## Troubleshooting

### Problemas Comunes

1. **Error: column does not exist**
   - Verificar nombres de columnas en JOIN
   - Confirmar esquema de `last_transaction_bank`

2. **Trigger no se ejecuta**
   - Verificar que el trigger está activo: `SELECT * FROM pg_trigger`
   - Confirmar que la función existe: `SELECT * FROM pg_proc`

3. **Performance lenta**
   - Verificar índices en `last_transaction_bank`
   - Analizar plan de ejecución de la consulta en el trigger

### Debugging

Activar logging para ver comportamiento:
```sql
SET log_min_messages = NOTICE;
-- Ejecutar INSERTs y observar logs
```

## Future Enhancements

### Posibles Mejoras

1. **Cache de última transacción**
   - Mantener última transacción en memoria/variable temporal
   - Reducir consultas repetitivas en lotes grandes

2. **Métricas del trigger**
   - Contar duplicados detectados
   - Tiempo de ejecución promedio

3. **Configuración dinámica**
   - Tabla de configuración para habilitar/deshabilitar
   - Reglas de duplicados personalizables por banco