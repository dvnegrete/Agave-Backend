# Migraciones de Base de Datos para Payment Management

## Resumen de Cambios Requeridos

Este documento describe las migraciones necesarias para el feature `payment-management`.

## Nuevas Tablas

### 1. `period_config`
```sql
CREATE TABLE period_config (
  id SERIAL PRIMARY KEY,
  default_maintenance_amount FLOAT NOT NULL DEFAULT 800,
  default_water_amount FLOAT,
  default_extraordinary_fee_amount FLOAT,
  payment_due_day INT NOT NULL DEFAULT 10,
  late_payment_penalty_amount FLOAT NOT NULL DEFAULT 100,
  effective_from DATE NOT NULL,
  effective_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN period_config.payment_due_day IS 'Día límite de pago del mes';
COMMENT ON COLUMN period_config.late_payment_penalty_amount IS 'Monto fijo de penalidad por pago tardío';
COMMENT ON COLUMN period_config.effective_from IS 'Fecha desde la cual esta configuración es válida';
COMMENT ON COLUMN period_config.effective_until IS 'Fecha hasta la cual esta configuración es válida (null = indefinido)';
```

### 2. `house_balances`
```sql
CREATE TABLE house_balances (
  id SERIAL PRIMARY KEY,
  house_id INT NOT NULL UNIQUE,
  accumulated_cents FLOAT NOT NULL DEFAULT 0,
  credit_balance FLOAT NOT NULL DEFAULT 0,
  debit_balance FLOAT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_house_balances_house
    FOREIGN KEY (house_id) REFERENCES houses(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON COLUMN house_balances.accumulated_cents IS 'Centavos acumulados de pagos (solo decimales, 0.00 - 0.99). Pendiente definir aplicación automática.';
COMMENT ON COLUMN house_balances.credit_balance IS 'Saldo a favor por pagos adelantados o pagos mayores';
COMMENT ON COLUMN house_balances.debit_balance IS 'Deuda acumulada por pagos incompletos o faltantes';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_house_balances_updated_at
  BEFORE UPDATE ON house_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 3. `house_period_overrides`
```sql
CREATE TABLE house_period_overrides (
  id SERIAL PRIMARY KEY,
  house_id INT NOT NULL,
  period_id INT NOT NULL,
  concept_type VARCHAR(50) NOT NULL,
  custom_amount FLOAT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_house_period_overrides_house
    FOREIGN KEY (house_id) REFERENCES houses(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_house_period_overrides_period
    FOREIGN KEY (period_id) REFERENCES periods(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT uq_house_period_concept
    UNIQUE (house_id, period_id, concept_type)
);

COMMENT ON COLUMN house_period_overrides.concept_type IS 'Tipo de concepto que se está sobrescribiendo';
COMMENT ON COLUMN house_period_overrides.custom_amount IS 'Monto personalizado para esta casa en este período';
COMMENT ON COLUMN house_period_overrides.reason IS 'Razón del ajuste (ej: convenio de pago, descuento, etc.)';

CREATE INDEX idx_house_period_overrides_house ON house_period_overrides(house_id);
CREATE INDEX idx_house_period_overrides_period ON house_period_overrides(period_id);
```

### 4. `record_allocations`
```sql
CREATE TABLE record_allocations (
  id SERIAL PRIMARY KEY,
  record_id INT NOT NULL,
  house_id INT NOT NULL,
  period_id INT NOT NULL,
  concept_type VARCHAR(50) NOT NULL,
  concept_id INT NOT NULL,
  allocated_amount FLOAT NOT NULL,
  expected_amount FLOAT NOT NULL,
  payment_status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_record_allocations_record
    FOREIGN KEY (record_id) REFERENCES records(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_record_allocations_house
    FOREIGN KEY (house_id) REFERENCES houses(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_record_allocations_period
    FOREIGN KEY (period_id) REFERENCES periods(id)
    ON UPDATE CASCADE ON DELETE NO ACTION
);

COMMENT ON COLUMN record_allocations.concept_type IS 'Tipo de concepto al que se aplica el pago';
COMMENT ON COLUMN record_allocations.concept_id IS 'ID del concepto específico (cta_maintenance_id, cta_water_id, etc.)';
COMMENT ON COLUMN record_allocations.allocated_amount IS 'Monto aplicado de este pago a este concepto';
COMMENT ON COLUMN record_allocations.expected_amount IS 'Monto esperado del concepto (sin centavos, siempre entero)';
COMMENT ON COLUMN record_allocations.payment_status IS 'Estado del pago: complete, partial o overpaid';

CREATE INDEX idx_record_allocations_record ON record_allocations(record_id);
CREATE INDEX idx_record_allocations_house ON record_allocations(house_id);
CREATE INDEX idx_record_allocations_period ON record_allocations(period_id);
CREATE INDEX idx_record_allocations_status ON record_allocations(payment_status);
```

## Modificaciones a Tablas Existentes

### 5. Tabla `periods`

```sql
-- Añadir nueva columna period_config_id
ALTER TABLE periods
ADD COLUMN period_config_id INT;

ALTER TABLE periods
ADD CONSTRAINT fk_periods_period_config
  FOREIGN KEY (period_config_id) REFERENCES period_config(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- Remover constraints únicos individuales y crear constraint compuesto
ALTER TABLE periods DROP CONSTRAINT IF EXISTS periods_year_key;
ALTER TABLE periods DROP CONSTRAINT IF EXISTS periods_month_key;

ALTER TABLE periods
ADD CONSTRAINT uq_periods_year_month UNIQUE (year, month);

-- Remover índices duplicados si existen
DROP INDEX IF EXISTS idx_periods_year;
DROP INDEX IF EXISTS idx_periods_month;

-- Crear índice compuesto para búsqueda eficiente
CREATE INDEX idx_periods_year_month ON periods(year, month);
```

## Comandos para Ejecutar

### Opción 1: Generación Automática (Recomendado)

TypeORM puede generar las migraciones automáticamente comparando las entidades con el estado actual de la BD:

```bash
# Generar migración automática
npm run db:generate -- src/shared/database/migrations/PaymentManagementFeature

# Revisar el archivo generado en:
# src/shared/database/migrations/<timestamp>-PaymentManagementFeature.ts

# Ejecutar migración
npm run db:deploy
```

### Opción 2: Migración Manual

Si prefieres crear las migraciones manualmente:

```bash
# Crear archivo de migración vacío
npm run typeorm migration:create -- src/shared/database/migrations/PaymentManagementFeature

# Editar el archivo generado y copiar el SQL de arriba

# Ejecutar migración
npm run db:deploy
```

## Datos Iniciales Recomendados

Después de ejecutar las migraciones, se recomienda insertar una configuración inicial:

```sql
-- Configuración default inicial
INSERT INTO period_config (
  default_maintenance_amount,
  default_water_amount,
  default_extraordinary_fee_amount,
  payment_due_day,
  late_payment_penalty_amount,
  effective_from,
  is_active
) VALUES (
  800,    -- mantenimiento
  200,    -- agua
  1000,   -- cuota extraordinaria
  10,     -- día límite
  100,    -- multa
  '2025-01-01',  -- efectivo desde
  true    -- activa
);
```

## Validación Post-Migración

Después de ejecutar las migraciones, verifica que todo esté correcto:

```bash
# Verificar que las tablas se crearon
npm run db:check-schema

# O manualmente con psql:
psql $DATABASE_URL -c "\dt period*"
psql $DATABASE_URL -c "\dt house_*"
psql $DATABASE_URL -c "\dt record_allocations"

# Verificar constraints
psql $DATABASE_URL -c "\d periods"
psql $DATABASE_URL -c "\d+ house_period_overrides"
```

## Rollback (en caso de problemas)

Si necesitas revertir las migraciones:

```sql
-- Revertir modificaciones a periods
ALTER TABLE periods DROP CONSTRAINT IF EXISTS fk_periods_period_config;
ALTER TABLE periods DROP COLUMN IF EXISTS period_config_id;
ALTER TABLE periods DROP CONSTRAINT IF EXISTS uq_periods_year_month;
ALTER TABLE periods ADD CONSTRAINT periods_year_key UNIQUE (year);
ALTER TABLE periods ADD CONSTRAINT periods_month_key UNIQUE (month);

-- Eliminar tablas nuevas (en orden inverso por dependencias)
DROP TABLE IF EXISTS record_allocations CASCADE;
DROP TABLE IF EXISTS house_period_overrides CASCADE;
DROP TABLE IF EXISTS house_balances CASCADE;
DROP TABLE IF EXISTS period_config CASCADE;
```

## Notas Importantes

1. **Backup**: Antes de ejecutar migraciones en producción, hacer backup de la base de datos
2. **Testing**: Probar las migraciones en ambiente de desarrollo primero
3. **Datos Existentes**: Si ya existen períodos en la BD, considerar migrar datos:
   ```sql
   -- Asignar configuración default a períodos existentes
   UPDATE periods
   SET period_config_id = (SELECT id FROM period_config WHERE is_active = true LIMIT 1)
   WHERE period_config_id IS NULL;
   ```

4. **Índices**: Los índices se crearán automáticamente por TypeORM para las foreign keys y constraints únicos

## Próximos Pasos

Después de ejecutar las migraciones exitosamente:

1. ✅ Verificar que el build compile sin errores: `npm run build`
2. ✅ Crear configuración inicial en `period_config`
3. ⏳ Implementar endpoints pendientes (ver README.md)
4. ⏳ Integrar con módulo de conciliación bancaria
5. ⏳ Crear tests unitarios
