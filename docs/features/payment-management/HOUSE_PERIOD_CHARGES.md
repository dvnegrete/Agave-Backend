# House Period Charges - Sistema de Cargos Esperados por Casa-Período

## Estado Actual

**Status**: ✅ COMPLETAMENTE IMPLEMENTADO Y FUNCIONAL

Este documento describe el sistema `house_period_charges` que mantiene un snapshot inmutable de los cargos esperados para cada casa en cada período.

---

## Problema que Resuelve

**Antes**: El sistema calculaba dinámicamente los montos esperados cada vez que se distribuían pagos:
- ❌ Montos variaban si se cambiaba la configuración
- ❌ Sin registro de qué montos eran esperados en qué momento
- ❌ Difícil auditaría de pagos
- ❌ Imposible garantizar inmutabilidad

**Ahora**: Los montos se crean como snapshot inmutable al crear cada período:
- ✅ Montos congelados y trazables
- ✅ Base sólida para distribución FIFO
- ✅ Soporte para penalidades automáticas
- ✅ Reportes precisos de pagos esperados

---

## Arquitectura

### Tabla: `house_period_charges`

```sql
CREATE TABLE house_period_charges (
  id SERIAL PRIMARY KEY,
  house_id INT NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  period_id INT NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  concept_type VARCHAR(50) NOT NULL,  -- maintenance, water, extraordinary_fee, penalties
  expected_amount FLOAT NOT NULL,
  source VARCHAR(50) DEFAULT 'period_config',  -- period_config, override, auto_penalty, manual
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (house_id, period_id, concept_type)
);

-- Índices para queries rápidas
CREATE INDEX idx_hpc_house_period ON house_period_charges(house_id, period_id);
CREATE INDEX idx_hpc_period ON house_period_charges(period_id);
```

### Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Identificador único |
| `house_id` | INT | Casa (FK a houses) |
| `period_id` | INT | Período (FK a periods) |
| `concept_type` | ENUM | Tipo: maintenance, water, extraordinary_fee, penalties |
| `expected_amount` | FLOAT | Monto esperado (inmutable) |
| `source` | VARCHAR | Origen: period_config, override, auto_penalty, manual |
| `created_at` | TIMESTAMP | Creación |
| `updated_at` | TIMESTAMP | Última actualización |

### Constraint Único

**`UNIQUE (house_id, period_id, concept_type)`**

Previene duplicados: una casa no puede tener dos cargos del mismo tipo en un mismo período.

---

## Componentes Implementados

### 1. Entity y Migrations

**Entity**: `src/shared/database/entities/house-period-charge.entity.ts`
- TypeORM decorators
- Relaciones ManyToOne con House y Period
- Índices y constraints

**Migration**: `src/shared/database/migrations/1770000000000-CreateHousePeriodCharges.ts`
- Idempotente (IF EXISTS/NOT EXISTS)
- Reutiliza enum `allocation_concept_type_enum` existente
- Crea tabla, índices y foreign keys

### 2. Repository

**Interface**: `src/features/payment-management/interfaces/house-period-charge.repository.interface.ts`

```typescript
findById(id: number)
findByHouseAndPeriod(houseId, periodId)
findByPeriod(periodId)
create(charge)
createBatch(charges)
update(id, data)
delete(id)
getTotalExpectedByHousePeriod(houseId, periodId)
```

**Implementación**: `src/features/payment-management/infrastructure/repositories/house-period-charge.repository.ts`
- CRUD completo
- Queries con QueryBuilder optimizadas
- Batch insert para eficiencia

### 3. Servicios

#### **SeedHousePeriodChargesService**
**Ubicación**: `src/features/payment-management/infrastructure/services/seed-house-period-charges.service.ts`

Crea los cargos inmutables cuando se inicia un período:

```typescript
seedChargesForPeriod(periodId): Promise<void>
  // Para cada casa (1-66):
  // 1. Crear MAINTENANCE (siempre)
  // 2. Crear WATER (si water_active=true)
  // 3. Crear EXTRAORDINARY_FEE (si extraordinary_fee_active=true)
  // 4. Crear PENALTIES (si hay deuda anterior)
  // 5. Batch insert todos
```

**Resolución de montos**:
- Obtiene PeriodConfig activa → valor por defecto
- Busca HousePeriodOverride → sobrescribe si existe
- Calcula penalidades automáticamente si hay deuda

#### **HousePeriodChargeCalculatorService**
**Ubicación**: `src/features/payment-management/infrastructure/services/house-period-charge-calculator.service.ts`

Cálculos basados en cargos inmutables:

```typescript
getTotalExpectedByHousePeriod(houseId, periodId)
getTotalPaidByHousePeriod(houseId, periodId)
calculateBalance(houseId, periodId)  // expected - paid
getPaymentDetails(houseId, periodId) // por concepto
isPeriodFullyCharged(periodId)
```

#### **CalculatePeriodPenaltiesService**
**Ubicación**: `src/features/payment-management/infrastructure/services/calculate-period-penalties.service.ts`

Calcula penalidades automáticas:

```typescript
calculatePenaltyForHouse(houseId, newPeriodId): Promise<number>
  // Busca deuda en TODOS los períodos anteriores
  // Si hay deuda → retorna monto de penalidad
  // Si no → retorna 0
```

#### **PaymentReportAnalyzerService**
**Ubicación**: `src/features/payment-management/infrastructure/services/payment-report-analyzer.service.ts`

Análisis de reportes:

```typescript
getPeriodReport(periodId)           // Reporte agregado del período
getHousePaymentHistory(houseId)     // Historial multi-período
classifyHousesByPaymentBehavior()   // Pagadores, en riesgo, morosos
```

#### **ChargeAdjustmentValidatorService**
**Ubicación**: `src/features/payment-management/infrastructure/services/charge-adjustment-validator.service.ts`

Validaciones para ajustes:

```typescript
validateAdjustment(currentAmount, newAmount, period)
validateReversal(chargeAmount, paidAmount, period)
validatePenaltyCondonation(conceptType, paidAmount)
```

### 4. Use Cases

#### **CreatePeriodUseCase & EnsurePeriodExistsUseCase**
**Ubicación**: `src/features/payment-management/application/`

Modificados para ejecutar seed automáticamente:

```typescript
execute() {
  // 1. Crear período
  // 2. SeedHousePeriodChargesService.seedChargesForPeriod()
  // 3. Retornar período
}
```

#### **AllocatePaymentUseCase**
**Ubicación**: `src/features/payment-management/application/allocate-payment.use-case.ts`

Modificado para usar cargos inmutables:

```typescript
preparePaymentConcepts(houseId, periodId) {
  // 1. SELECT FROM house_period_charges (lookup inmutable)
  // 2. Si existen → usar esos montos
  // 3. Si no → fallback a método legacy (retrocompatibilidad)
  // Retorna array de conceptos con expected_amount
}
```

#### **GetHousePeriodBalanceUseCase**
**Ubicación**: `src/features/payment-management/application/get-house-period-balance.use-case.ts`

Obtiene balance usando cargos inmutables:

```typescript
execute(houseId, periodId): Promise<{
  houseId,
  periodId,
  totalExpected,     // Desde house_period_charges
  totalPaid,         // Desde record_allocations
  balance,           // expected - paid
  isPaid,            // bool
  details: [{ conceptType, expected, paid, balance, isPaid }]
}>
```

#### **GetPeriodReportUseCase**
**Ubicación**: `src/features/payment-management/application/get-period-report.use-case.ts`

Reporte agregado del período:

```typescript
execute(periodId): Promise<{
  periodYear, periodMonth,
  totalExpected, totalPaid, totalDebt,
  collectionPercentage,
  conceptBreakdown: [{ concept, expected, paid, debt, percentage }],
  housesWithDebt, housesFullyPaid, housesPartiallyPaid
}>
```

#### **GetHousePaymentHistoryUseCase**
**Ubicación**: `src/features/payment-management/application/get-house-payment-history.use-case.ts`

Historial de pagos multi-período:

```typescript
execute(houseId, limitMonths=12): Promise<{
  houseId, houseNumber,
  periods: [{ periodId, year, month, expected, paid, debt, isPaid, percentage }],
  totalExpectedAllTime, totalPaidAllTime, totalDebtAllTime,
  averagePaymentPercentage,
  debtTrend: 'improving' | 'stable' | 'worsening'
}>
```

#### **ClassifyHousesByPaymentUseCase**
**Ubicación**: `src/features/payment-management/application/classify-houses-by-payment.use-case.ts`

Clasifica casas por comportamiento:

```typescript
execute(periodId): Promise<{
  goodPayers: [{ houseId, houseNumber, fullyPaidPercentage }],
  atRisk: [{ houseId, houseNumber, debt, monthsBehind, lastPaymentDate }],
  delinquent: [{ houseId, houseNumber, totalDebt, monthsDelinquent }]
}>
```

#### **AdjustHousePeriodChargeUseCase**
**Ubicación**: `src/features/payment-management/application/adjust-house-period-charge.use-case.ts`

Ajustar monto de un cargo:

```typescript
execute(chargeId, newAmount): Promise<{
  chargeId, houseId, periodId,
  previousAmount, newAmount, difference,
  isPaid
}>
```

Validaciones:
- Período no > 3 meses atrás
- Nuevo monto diferente
- No reduce por debajo de lo pagado

#### **ReverseHousePeriodChargeUseCase**
**Ubicación**: `src/features/payment-management/application/reverse-house-period-charge.use-case.ts`

Eliminar un cargo:

```typescript
execute(chargeId): Promise<{
  chargeId, houseId, periodId,
  removedAmount, message
}>
```

Validaciones:
- Período no > 3 meses atrás
- Sin pagos asignados

#### **CondonePenaltyUseCase**
**Ubicación**: `src/features/payment-management/application/condone-penalty.use-case.ts`

Condonar penalidades:

```typescript
execute(houseId, periodId)
executeMultiple(periodId, houseIds?)  // Masiva
```

---

## Flujos de Datos

### Crear Período

```
CreatePeriodUseCase.execute()
  ↓
1. IPeriodRepository.create()
2. SeedHousePeriodChargesService.seedChargesForPeriod()
   ├─ Para cada casa (1-66):
   │  ├─ MAINTENANCE: resolver monto
   │  ├─ WATER: si water_active
   │  ├─ EXTRAORDINARY_FEE: si extraordinary_fee_active
   │  └─ PENALTIES: calcular si hay deuda anterior
   └─ IHousePeriodChargeRepository.createBatch()
3. Retornar período
```

**Resultado**:
- ~198 cargos (66 casas × 3 conceptos)
- ~66 cargos adicionales de penalidad (si hay deuda)
- = ~264 cargos totales por período

### Distribuir Pagos

```
AllocatePaymentUseCase.execute(recordId, houseId, periodId, amount)
  ↓
1. Obtener período
2. preparePaymentConcepts()
   ├─ IHousePeriodChargeRepository.findByHouseAndPeriod()
   └─ Extraer montos inmutables (snapshot)
3. Para cada concepto:
   ├─ Calcular allocated_amount (FIFO)
   └─ IRecordAllocationRepository.create()
4. Actualizar house_balance
5. Retornar resultado
```

### Obtener Balance

```
GetHousePeriodBalanceUseCase.execute(houseId, periodId)
  ↓
1. IPeriodRepository.findById()
2. HousePeriodChargeCalculatorService.getTotalExpectedByHousePeriod()
   └─ SELECT SUM FROM house_period_charges
3. HousePeriodChargeCalculatorService.getTotalPaidByHousePeriod()
   └─ SELECT SUM FROM record_allocations
4. Calcular diferencia
5. Retornar con detalles por concepto
```

---

## Integración con el Sistema

### Con AllocatePaymentUseCase

Cuando se distribuye un pago:
1. **Antes**: Se calculaba dinámicamente expected_amount
2. **Ahora**: Se obtiene de `house_period_charges` (inmutable)

Retrocompatibilidad: Si no hay cargos en HPC (períodos antiguos), cae a cálculo legacy.

### Con PeriodConfig

- **Cargos normales**: Se resuelven desde PeriodConfig defaults
- **Sobrescrituras**: Se aplican desde HousePeriodOverride
- **Penalidades**: Se calculan automáticamente basadas en deuda anterior

### Con Reportes

- **GetPeriodReportUseCase**: Agrega datos de HPC por período
- **GetHousePaymentHistoryUseCase**: Analiza tendencias multi-período
- **ClassifyHousesByPaymentUseCase**: Clasifica basado en patrones

### Límites de Edición

- **Ajustes/Reversiones**: No permite editar > 3 meses atrás
- **Condonaciones**: Solo penalidades, sin pagos asignados
- **Protecciones**: Validación de negocio estricta

---

## Características del Sistema

### Inmutabilidad
✅ Los cargos se crean al iniciar período y no cambian dinámicamente

### Trazabilidad
✅ Campo `source` registra origen (period_config, override, auto_penalty)

### Automatización
✅ Penalidades se calculan y crean automáticamente

### Flexibilidad
✅ Permite ajustes (aumentar/disminuir) y reversiones (eliminar) con validaciones

### Retrocompatibilidad
✅ Funciona con períodos sin cargos (fallback a cálculo legacy)

### Reportes
✅ Base sólida para análisis, no hay recálculos

---

## Consultas Importantes

### Obtener todos los cargos de un período
```typescript
const charges = await chargeRepository.findByPeriod(periodId);
// Retorna: 198-264 cargos
```

### Obtener balance de una casa
```typescript
const balance = await calculator.calculateBalance(houseId, periodId);
// Retorna: expected - paid
```

### Clasificar casas
```typescript
const classification = await classifyUseCase.execute(periodId);
// Retorna: goodPayers, atRisk, delinquent
```

### Ajustar un cargo
```typescript
const result = await adjustUseCase.execute(chargeId, newAmount);
// Validaciones: período < 3 meses, monto diferente, sin pagos parciales
```

---

## Validaciones de Negocio

| Validación | Límite | Motivo |
|------------|--------|--------|
| Período histórico | < 3 meses atrás | Proteger datos históricos |
| Ajuste | Monto diferente | No permitir cambios sin efecto |
| Reversión | Sin pagos | No permitir editar datos pagados |
| Penalidad | Solo penalties | Limitar condonación a penalidades |

---

## Próximos Desarrollos Posibles

### 1. Notificaciones Automáticas
- Alerta cuando se crea penalidad
- Recordatorio de vencimiento
- Aviso de cambios de cargos

### 2. Penalidades Progresivas
- Aumentan si siguen impagadas
- Tope máximo
- Condonación con autorización

### 3. Planes de Pago
- Distribuir deuda en cuotas
- Tracking de cumplimiento
- Actualización automática de balances

### 4. Auditoría Completa
- Registro de cada ajuste/condonación
- Quién, cuándo, por qué
- Trail completo de cambios

---

## Performance y Optimizaciones

### Índices
```sql
CREATE INDEX idx_hpc_house_period ON house_period_charges(house_id, period_id);
CREATE INDEX idx_hpc_period ON house_period_charges(period_id);
```

### Batch Insert
```typescript
createBatch(charges)  // ~264 registros en una query
```

### QueryBuilder Optimizado
```typescript
.select('SUM(expected_amount)')
.where('house_id = :houseId')
```

---

## Compilación y Testing

**Status**: ✅ Compilación exitosa

```bash
npm run build
# Resultado: Sin errores
```

---

## Referencias Técnicas

- **Entity**: `src/shared/database/entities/house-period-charge.entity.ts`
- **Migration**: `src/shared/database/migrations/1770000000000-CreateHousePeriodCharges.ts`
- **Repository**: `src/features/payment-management/infrastructure/repositories/house-period-charge.repository.ts`
- **Servicios**: `src/features/payment-management/infrastructure/services/`
- **Use Cases**: `src/features/payment-management/application/`
- **Módulo**: `src/features/payment-management/payment-management.module.ts`

---

**Última actualización**: 2026-02-11
**Status**: ✅ COMPLETAMENTE IMPLEMENTADO Y FUNCIONAL
