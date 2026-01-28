# Payment Management System - v3.0+

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Conceptos Clave](#conceptos-clave)
3. [Entidades Principales](#entidades-principales)
4. [Flujo de Procesamiento](#flujo-de-procesamiento)
5. [Ejemplos Prácticos](#ejemplos-prácticos)
6. [Integración con Reconciliación Bancaria](#integración-con-reconciliación-bancaria)
7. [Queries Útiles](#queries-útiles)

---

## Descripción General

El **Payment Management System** es un módulo de gestión de pagos que permite:

- ✅ Configurar montos por período (mantenimiento, agua, cuota extraordinaria)
- ✅ Registrar montos personalizados por casa/período (convenios de pago, descuentos)
- ✅ Rastrear la distribución detallada de pagos a conceptos específicos
- ✅ Detectar pagos incompletos, completos o con excedente
- ✅ Mantener saldos acumulados por casa (centavos, crédito, deuda)
- ✅ Integración automática con transacciones bancarias

**Versión:** 3.0.0 (lanzada Nov 2025)
**Estado:** Producción

---

## Conceptos Clave

### 1. Período (Period)

Un **período** representa un mes de facturación con fechas generadas automáticamente.

**Ejemplo:**
```
Período: Noviembre 2024
├─ year: 2024
├─ month: 11
├─ start_date: 2024-11-01 (generado automáticamente)
└─ end_date: 2024-11-30 (generado automáticamente)
```

**Características:**
- Período único por mes/año (índice único garantiza)
- Fechas calculadas automáticamente (no editables)
- Base para toda la gestión de pagos

---

### 2. Configuración del Período (PeriodConfig)

Una **configuración del período** define los montos globales por concepto en un período.

**Ejemplo:**
```
Período: Nov 2024
├─ Mantenimiento: $100,000
├─ Agua: $50,000
└─ Cuota Extraordinaria: $25,000
```

**Características:**
- Un registro por concepto por período
- Configurable para cambios entre períodos
- Base para calcular montos esperados

**Conceptos permitidos:**
- `maintenance`: Cuota ordinaria/mantenimiento
- `water`: Consumo de agua
- `extraordinary_fee`: Cuota extraordinaria aprobada

---

### 3. Saldo de Casa (HouseBalance)

Un **saldo de casa** mantiene tres tipos de dinero acumulado:

```
Casa #42 Balance:
├─ accumulated_cents: $0.73
│  └─ Centavos de pagos anteriores (0.00-0.99)
│
├─ credit_balance: $15,500.00
│  └─ Saldo a favor (pagó más de lo debido)
│
└─ debit_balance: $8,300.50
   └─ Deuda acumulada (pagó menos de lo debido)
```

**Actualización:**
- Se actualiza automáticamente cuando se registran pagos
- `credit_balance` se puede aplicar a futuros pagos
- `debit_balance` debe pagarse antes de cerrar período

**Relación:**
- Una casa tiene exactamente un saldo (OneToOne)

---

### 4. Montos Personalizados (HousePeriodOverride)

Un **override de período** permite montos personalizados para una casa en un período específico.

**Casos de uso:**

#### A) Convenio de Pago
```sql
INSERT INTO house_period_overrides
  (house_id, period_id, concept_type, custom_amount, reason)
VALUES
  (42, 1, 'maintenance', 50000, 'Convenio: pago en 6 cuotas');
```
Casa 42 paga $50,000 en lugar del monto global ($100,000)

#### B) Descuento por Antigüedad
```sql
INSERT INTO house_period_overrides
  (house_id, period_id, concept_type, custom_amount, reason)
VALUES
  (42, 1, 'maintenance', 85000, 'Descuento 15% antiguos inquilinos');
```

#### C) Exención Temporal
```sql
INSERT INTO house_period_overrides
  (house_id, period_id, concept_type, custom_amount, reason)
VALUES
  (42, 1, 'water', 0, 'Exención por daño en acometida');
```

**Características:**
- Válida solo para el período especificado
- Un override por casa/período/concepto
- Registra razón para auditoría

---

### 5. Asignación de Pago (RecordAllocation)

Una **asignación** registra cómo se distribuye un pago a conceptos específicos.

**Ejemplo - Pago de Casa #42:**
```
Pago: $125,000 (Voucher#123, Noviembre 2024)
├─ Asignación 1: Mantenimiento
│  ├─ allocated_amount: $75,000 (lo que pagó)
│  ├─ expected_amount: $100,000 (lo que debería pagar)
│  └─ payment_status: PARTIAL ⚠️ (faltaron $25,000)
│
├─ Asignación 2: Agua
│  ├─ allocated_amount: $50,000
│  ├─ expected_amount: $50,000
│  └─ payment_status: COMPLETE ✅
│
└─ [Excedente: $0]
   └─ Este dinero se aplica a centavos/saldo a favor
```

**Estados de Pago:**
- `COMPLETE`: Pago exacto (allocated = expected)
- `PARTIAL`: Pago insuficiente (allocated < expected)
- `OVERPAID`: Pago en exceso (allocated > expected)

---

## Entidades Principales

### Period Entity
```typescript
@Entity('periods')
export class Period {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({
    type: 'date',
    generatedType: 'STORED',
    asExpression: `date_trunc('month', make_date(year, month, 1))::date`
  })
  start_date: Date;

  @Column({
    type: 'date',
    generatedType: 'STORED',
    asExpression: `(date_trunc('month', make_date(year, month, 1)) + interval '1 month' - interval '1 day')::date`
  })
  end_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relaciones
  @OneToMany(() => PeriodConfig, config => config.period)
  periodConfigs: PeriodConfig[];

  @OneToMany(() => HousePeriodOverride, override => override.period)
  housePeriodOverrides: HousePeriodOverride[];

  @OneToMany(() => RecordAllocation, allocation => allocation.period)
  recordAllocations: RecordAllocation[];
}
```

### PeriodConfig Entity
```typescript
@Entity('period_configs')
export class PeriodConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  period_id: number;

  @Column({
    type: 'enum',
    enum: ConceptType,
    comment: 'Tipo de concepto: maintenance, water, extraordinary_fee'
  })
  concept_type: ConceptType;

  @Column({ type: 'float' })
  default_amount: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Period)
  @JoinColumn({ name: 'period_id' })
  period: Period;
}
```

### HouseBalance Entity
```typescript
@Entity('house_balances')
export class HouseBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  house_id: number;

  @Column({ type: 'float', default: 0 })
  accumulated_cents: number;

  @Column({ type: 'float', default: 0 })
  credit_balance: number;

  @Column({ type: 'float', default: 0 })
  debit_balance: number;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => House, house => house.houseBalance, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'house_id' })
  house: House;
}
```

### HousePeriodOverride Entity
```typescript
@Entity('house_period_overrides')
@Index(['house_id', 'period_id', 'concept_type'], { unique: true })
export class HousePeriodOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  house_id: number;

  @Column({ type: 'int' })
  period_id: number;

  @Column({
    type: 'enum',
    enum: ConceptType
  })
  concept_type: ConceptType;

  @Column({ type: 'float' })
  custom_amount: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => House, house => house.housePeriodOverrides)
  @JoinColumn({ name: 'house_id' })
  house: House;

  @ManyToOne(() => Period, period => period.housePeriodOverrides)
  @JoinColumn({ name: 'period_id' })
  period: Period;
}
```

### RecordAllocation Entity
```typescript
@Entity('record_allocations')
export class RecordAllocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  record_id: number;

  @Column({ type: 'int' })
  house_id: number;

  @Column({ type: 'int' })
  period_id: number;

  @Column({
    type: 'enum',
    enum: AllocationConceptType
  })
  concept_type: AllocationConceptType;

  @Column({ type: 'int' })
  concept_id: number;

  @Column({ type: 'float' })
  allocated_amount: number;

  @Column({ type: 'float' })
  expected_amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus
  })
  payment_status: PaymentStatus;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Record, record => record.allocations)
  @JoinColumn({ name: 'record_id' })
  record: Record;

  @ManyToOne(() => Period)
  @JoinColumn({ name: 'period_id' })
  period: Period;

  @ManyToOne(() => House, house => house.recordAllocations)
  @JoinColumn({ name: 'house_id' })
  house: House;
}
```

---

## Flujo de Procesamiento

### 1. Creación de Período
```
Admin crea período Nov 2024
        ↓
Sistema genera start_date: 2024-11-01
Sistema genera end_date: 2024-11-30
        ↓
Período listo para configuración
```

### 2. Configuración del Período
```
Admin establece montos globales
├─ Mantenimiento: $100,000
├─ Agua: $50,000
└─ Cuota Extraordinaria: $25,000
        ↓
Sistema crea period_configs
        ↓
Configuración lista (aplicada a todas las casas)
```

### 3. Overrides por Casa
```
Algunos casos especiales:
├─ Casa #42: Convenio de pago ($50,000 en lugar de $100,000)
├─ Casa #15: Descuento antigüedad ($85,000 en lugar de $100,000)
└─ Casa #88: Exención agua ($0 en lugar de $50,000)
        ↓
Sistema crea house_period_overrides
        ↓
Montos personalizados listos
```

### 4. Recepción de Pago
```
Llega pago de Casa #42: $125,000 (voucher/transacción)
        ↓
Sistema crea record + registra en records table
        ↓
Sistema busca montos esperados:
├─ Mantenimiento (override): $50,000
├─ Agua (global config): $50,000
└─ Total esperado: $100,000
```

### 5. Distribución de Pago
```
Pago disponible: $125,000
Conceptos a pagar:
├─ Mantenimiento: esperado $50,000
│  ├─ Asigna: $50,000
│  ├─ Falta: $0
│  └─ Estado: COMPLETE ✅
│
├─ Agua: esperado $50,000
│  ├─ Asigna: $50,000
│  ├─ Falta: $0
│  └─ Estado: COMPLETE ✅
│
└─ Excedente disponible: $25,000
   └─ Sistema aplica a:
      1. Centavos acumulados (si existen)
      2. Deuda anterior (si existe)
      3. Crédito a favor (saldo positivo)
```

### 6. Actualización de Saldo
```
Después de procesar pago:
├─ house_balances.accumulated_cents: +$0.00
├─ house_balances.credit_balance: +$25,000 (excedente)
└─ house_balances.updated_at: NOW()
```

---

## Ejemplos Prácticos

### Ejemplo 1: Pago Completo Exacto

**Setup:**
- Casa #10, Período Nov 2024
- Monto global mantenimiento: $100,000
- Monto global agua: $50,000
- Total esperado: $150,000
- No hay overrides

**Pago recibido:**
```
Voucher #001: $150,000
```

**Resultado:**
```sql
INSERT INTO record_allocations VALUES
(1, 1, 10, 1, 'maintenance', 1, 100000, 100000, 'complete'),
(2, 1, 10, 1, 'water', 2, 50000, 50000, 'complete');

UPDATE house_balances SET
  accumulated_cents = 0,
  credit_balance = 0,
  updated_at = NOW()
WHERE house_id = 10;
```

✅ **Resultado:** Casa al día

---

### Ejemplo 2: Pago Parcial (Falta Dinero)

**Setup:**
- Casa #20, Período Nov 2024
- Monto esperado: $150,000
- Saldo anterior: $0

**Pago recibido:**
```
Voucher #002: $100,000 (falta $50,000)
```

**Resultado:**
```sql
INSERT INTO record_allocations VALUES
(1, 2, 20, 1, 'maintenance', 1, 100000, 100000, 'complete'),
(2, 2, 20, 1, 'water', 2, 0, 50000, 'partial');

UPDATE house_balances SET
  accumulated_cents = 0,
  debit_balance = 50000,  -- Debe $50,000 de agua
  updated_at = NOW()
WHERE house_id = 20;
```

⚠️ **Resultado:** Casa con deuda de $50,000

---

### Ejemplo 3: Pago en Exceso (Sobrepagado)

**Setup:**
- Casa #30, Período Nov 2024
- Monto esperado: $150,000
- Saldo anterior: $0

**Pago recibido:**
```
Voucher #003: $175,000 (sobrepagó $25,000)
```

**Resultado:**
```sql
INSERT INTO record_allocations VALUES
(1, 3, 30, 1, 'maintenance', 1, 100000, 100000, 'complete'),
(2, 3, 30, 1, 'water', 2, 50000, 50000, 'complete');

UPDATE house_balances SET
  accumulated_cents = 0,
  credit_balance = 25000,  -- $25,000 a su favor
  updated_at = NOW()
WHERE house_id = 30;
```

✅ **Resultado:** Casa con crédito de $25,000

---

### Ejemplo 4: Convenio de Pago

**Setup:**
- Casa #40, Período Nov 2024
- Monto global mantenimiento: $100,000
- Override para Casa #40: mantenimiento $50,000 (convenio)
- Monto global agua: $50,000
- Total esperado: $100,000 (no $150,000)

**Pago recibido:**
```
Voucher #004: $100,000 (pago exacto según convenio)
```

**Resultado:**
```sql
-- El override fue considerado en el cálculo
INSERT INTO record_allocations VALUES
(1, 4, 40, 1, 'maintenance', 1, 50000, 50000, 'complete'),
(2, 4, 40, 1, 'water', 2, 50000, 50000, 'complete');

UPDATE house_balances SET
  accumulated_cents = 0,
  credit_balance = 0,
  updated_at = NOW()
WHERE house_id = 40;
```

✅ **Resultado:** Casa al día (convenio honrado)

---

## Integración con Reconciliación Bancaria

### Flujo Integrado

```
1. Archivo de transacciones bancarias
   ↓
2. Reconciliación Bancaria detecta transacciones
   ├─ Crea/busca voucher
   ├─ Identifica casa (por centavos en monto)
   └─ Crea record
   ↓
3. Payment Allocation (PENDIENTE en Sprint 2)
   ├─ Busca período actual
   ├─ Obtiene configuración del período
   ├─ Busca overrides para la casa
   ├─ Distribuye pago a conceptos
   ├─ Crea record_allocations
   └─ Actualiza house_balances
   ↓
4. Sistema actualizado
```

### Dependencias

Payment Management **depende de:**
- ✅ Bank Reconciliation (proporciona records/vouchers)
- ✅ Periods (ya creados)
- ✅ PeriodConfigs (ya configurados)

Payment Management **es requerida por:**
- ❌ Payment History API (Sprint 2 - en desarrollo)
- ❌ Balance Reports (Sprint 2 - en desarrollo)

---

## Queries Útiles

### 1. Ver Historial de Pagos de una Casa
```sql
SELECT
    ra.id,
    r.created_at as fecha_pago,
    v.amount as monto_total,
    ra.concept_type,
    ra.allocated_amount,
    ra.expected_amount,
    ra.payment_status,
    p.year,
    p.month
FROM record_allocations ra
JOIN records r ON ra.record_id = r.id
JOIN periods p ON ra.period_id = p.id
LEFT JOIN vouchers v ON r.vouchers_id = v.id
WHERE ra.house_id = 42
ORDER BY r.created_at DESC;
```

### 2. Ver Saldos Actuales de una Casa
```sql
SELECT
    h.id,
    h.number_house,
    hb.accumulated_cents,
    hb.credit_balance,
    hb.debit_balance,
    CASE
        WHEN hb.credit_balance > 0 THEN 'Crédito'
        WHEN hb.debit_balance > 0 THEN 'Deuda'
        ELSE 'Al día'
    END as estado
FROM houses h
LEFT JOIN house_balances hb ON h.id = hb.house_id
WHERE h.number_house = 42;
```

### 3. Ver Overrides Aplicados a una Casa
```sql
SELECT
    hpo.id,
    p.year,
    p.month,
    hpo.concept_type,
    hpo.custom_amount,
    pc.default_amount,
    hpo.custom_amount - pc.default_amount as ajuste,
    hpo.reason
FROM house_period_overrides hpo
JOIN periods p ON hpo.period_id = p.id
LEFT JOIN period_configs pc ON p.id = pc.period_id
    AND hpo.concept_type = pc.concept_type
WHERE hpo.house_id = 42
ORDER BY p.year DESC, p.month DESC;
```

### 4. Ver Comparación de Montos (Global vs Override)
```sql
SELECT
    h.number_house,
    p.year,
    p.month,
    pc.concept_type,
    pc.default_amount as monto_global,
    hpo.custom_amount as monto_personalizado,
    COALESCE(hpo.custom_amount, pc.default_amount) as monto_final,
    hpo.reason
FROM houses h
CROSS JOIN period_configs pc
JOIN periods p ON pc.period_id = p.id
LEFT JOIN house_period_overrides hpo ON h.id = hpo.house_id
    AND p.id = hpo.period_id
    AND pc.concept_type = hpo.concept_type
WHERE h.number_house = 42
ORDER BY p.year DESC, p.month DESC;
```

### 5. Ver Pagos por Estatus
```sql
SELECT
    h.number_house,
    p.year,
    p.month,
    ra.payment_status,
    COUNT(*) as cantidad,
    SUM(ra.allocated_amount) as total_pagado,
    SUM(ra.expected_amount - ra.allocated_amount) as deuda
FROM record_allocations ra
JOIN houses h ON ra.house_id = h.id
JOIN periods p ON ra.period_id = p.id
GROUP BY h.id, h.number_house, p.year, p.month, ra.payment_status
ORDER BY p.year DESC, p.month DESC;
```

### 6. Ver Casas con Deuda
```sql
SELECT
    h.id,
    h.number_house,
    hb.debit_balance,
    hb.accumulated_cents
FROM houses h
LEFT JOIN house_balances hb ON h.id = hb.house_id
WHERE hb.debit_balance > 0
ORDER BY hb.debit_balance DESC;
```

---

## Notas Importantes

### Generación Automática de Fechas (Period)
- Las columnas `start_date` y `end_date` se **calculan automáticamente**
- No se pueden editar directamente
- Se actualizan si cambian `year` y `month`

### Relación OneToOne en HouseBalance
- Cada casa tiene **exactamente un** saldo
- Se crea automáticamente cuando se asigna un pago
- Se elimina si se elimina la casa (CASCADE)

### Índices de Unicidad
- `periods`: Unique (year, month)
- `house_period_overrides`: Unique (house_id, period_id, concept_type)
- `house_balances`: Unique (house_id)

### Manejo de Excedentes
El dinero excedente se aplica en este orden:
1. Pagar deuda anterior (`debit_balance`)
2. Acumular centavos (`accumulated_cents` hasta 0.99)
3. Crear crédito a favor (`credit_balance`)

---

## Documentación Relacionada

- **Documentation Index:** `docs/database/README.md` (navigation guide)
- **Schema Completo:** `docs/database/schema.md` (includes complete version history)
- **Reconciliación Bancaria:** `docs/features/bank-reconciliation/`
- **Entidades TypeORM:** `src/shared/database/entities/`

---

**Última actualización:** Noviembre 2025
**Versión:** 3.0.0
**Estado:** Producción (✅ Sincronizado)
