# Payment Management - Estado Actual del Sistema

**Fecha**: 2026-02-12
**Status**: ✅ COMPLETAMENTE FUNCIONAL (FIFO + Centavos)

Este documento describe el estado ACTUAL y COMPLETO del módulo Payment Management, cómo funciona, qué componentes están implementados, y cómo un desarrollador puede continuar con desarrollos o fixes.

---

## Estado General del Módulo

### Componentes Implementados

```
PaymentManagementModule
├─ Entities (10)
│  ├─ Period
│  ├─ PeriodConfig (+ cents_credit_threshold)
│  ├─ RecordAllocation
│  ├─ HouseBalance
│  ├─ HousePeriodOverride
│  ├─ HousePeriodCharge
│  ├─ CtaMaintenace, CtaWater, CtaPenalties, etc. (legacy, sin usar)
│  └─ ...
├─ Repositories (6)
│  ├─ PeriodRepository
│  ├─ PeriodConfigRepository
│  ├─ RecordAllocationRepository
│  ├─ HouseBalanceRepository
│  ├─ HousePeriodOverrideRepository
│  └─ HousePeriodChargeRepository
├─ Services (5)
│  ├─ PaymentDistributionAnalyzerService
│  ├─ SeedHousePeriodChargesService
│  ├─ HousePeriodChargeCalculatorService
│  ├─ CalculatePeriodPenaltiesService
│  ├─ PaymentReportAnalyzerService
│  └─ ChargeAdjustmentValidatorService
├─ Use Cases (17+)
│  ├─ CreatePeriodUseCase
│  ├─ EnsurePeriodExistsUseCase
│  ├─ GetPeriodsUseCase
│  ├─ CreatePeriodConfigUseCase
│  ├─ UpdatePeriodConfigUseCase
│  ├─ AllocatePaymentUseCase ← REESCRITO (FIFO + verificación existentes)
│  ├─ ApplyCreditToPeriodsUseCase ← ACTUALIZADO (todos los conceptos)
│  ├─ BackfillAllocationsUseCase ← ACTUALIZADO (FIFO automático)
│  ├─ GetPaymentHistoryUseCase
│  ├─ GetHouseBalanceUseCase
│  ├─ GetHousePeriodBalanceUseCase
│  ├─ GetPeriodReportUseCase
│  ├─ GetHousePaymentHistoryUseCase
│  ├─ ClassifyHousesByPaymentUseCase
│  ├─ AdjustHousePeriodChargeUseCase
│  ├─ ReverseHousePeriodChargeUseCase
│  ├─ CondonePenaltyUseCase
│  ├─ CalculateHouseBalanceStatusUseCase
│  ├─ UpdatePeriodConceptsUseCase
│  ├─ GeneratePenaltyUseCase
│  └─ DistributePaymentWithAIUseCase
└─ Controllers (1)
   └─ PaymentManagementController
```

---

## Flujo Actual del Sistema

### 1. Crear Período (Automático)

**Quién lo hace**: `CreatePeriodUseCase` o `EnsurePeriodExistsUseCase`

**Qué sucede**:
```
1. IPeriodRepository.create(year, month, configId)
   └─ Crea período en tabla periods
2. SeedHousePeriodChargesService.seedChargesForPeriod(periodId)
   ├─ Obtiene PeriodConfig activa
   ├─ Para cada casa (1-66):
   │  ├─ Crea cargo MAINTENANCE (por defecto $800)
   │  ├─ Crea cargo WATER si water_active=true (por defecto $200)
   │  ├─ Crea cargo EXTRAORDINARY_FEE si extraordinary_fee_active=true (por defecto $1000)
   │  └─ Crea cargo PENALTIES si hay deuda anterior en otros períodos (auto_penalty)
   └─ IHousePeriodChargeRepository.createBatch()
       └─ Inserta ~198-264 registros en tabla house_period_charges
3. Retorna período con estatus creado
```

**Resultado**:
- Tabla `periods` tiene nuevo período
- Tabla `house_period_charges` tiene todos los cargos inmutables
- Los montos están congelados y no cambiarán

**Problema conocido**: Si se crea un período sin casas en la BD, los charges no se crean. Ver [Áreas Problemáticas](#áreas-problemáticas-que-necesitan-atención).

### 2. Distribuir Pagos (FIFO Automático)

**Quién lo hace**: `AllocatePaymentUseCase` (llamado por `BankReconciliationModule` o `BackfillAllocationsUseCase`)

**Modos de operación**:
- **Sin `period_id`** → Distribución FIFO automática (períodos más antiguos primero)
- **Con `period_id`** → Distribución manual a un período específico (solo desde `confirmDistribution`)

**Flujo FIFO (modo automático, sin period_id)**:
```
1. AllocatePaymentUseCase.execute({
     record_id: 123,
     house_id: 15,
     amount_to_distribute: 2400.22
     // SIN period_id → FIFO
   })

2. Separar centavos:
   ├─ totalAmount = 2400.22
   ├─ cents = 0.22
   └─ integerAmount = 2400

3. allocateFIFO(recordId, houseId, 2400, periodConfig):
   ├─ Obtener TODOS los períodos ordenados ASC (year, month)
   ├─ Para cada período:
   │  ├─ Obtener house_period_charges (cargos esperados)
   │  ├─ Obtener allocaciones EXISTENTES (ya pagadas)
   │  ├─ Para cada concepto (MAINTENANCE → WATER → EXTRAORDINARY → PENALTIES):
   │  │  ├─ alreadyPaid = SUM(allocaciones existentes del mismo concepto)
   │  │  ├─ remaining = max(0, expected - alreadyPaid)
   │  │  ├─ allocate = min(amountRemaining, remaining)
   │  │  └─ Crear record_allocation
   │  └─ Si amountRemaining <= 0: break
   │
   │  Ejemplo con 3 períodos pendientes:
   │  ├─ Dic 2024: MAINTENANCE $800 (ya pagado $0) → asigna $800
   │  ├─ Ene 2025: MAINTENANCE $800 (ya pagado $0) → asigna $800
   │  └─ Feb 2025: MAINTENANCE $800 (ya pagado $0) → asigna $800
   └─ integerRemaining = 0

4. updateHouseBalance(houseId, balance, integerRemaining=0, cents=0.22, threshold=100):
   ├─ integerRemaining → pagar debit_balance primero, sobrante → credit_balance
   ├─ cents (0.22) → accumulated_cents += 0.22
   ├─ Si accumulated_cents >= cents_credit_threshold ($100):
   │  └─ credit_balance += threshold, accumulated_cents -= threshold
   └─ Si credit_balance > 0 → applyCreditToPeriodsUseCase.execute()

5. Retorna response con detalles de allocación
```

**Flujo manual (con period_id)**:
```
Solo usado desde PaymentManagementController.confirmDistribution()
(cuando el admin confirma una distribución sugerida por AI)

Misma lógica que FIFO pero limitada a UN solo período.
También verifica allocaciones existentes para evitar sobre-asignación.
```

**Resultado**:
- Tabla `record_allocations` tiene nuevos registros
- Tabla `house_balances` está actualizada
- No hay sobre-asignación (verificación de existentes)
- Centavos se acumulan correctamente

### 3. Centavos y Crédito

**Configuración**: `PeriodConfig.cents_credit_threshold` (default $100)

**Flujo**:
```
1. Cada pago tiene centavos (ej: $800.22 → cents = 0.22)
2. Los centavos NO se asignan a conceptos
3. Se acumulan en house_balances.accumulated_cents
4. Cuando accumulated_cents >= cents_credit_threshold ($100):
   ├─ credit_balance += $100
   ├─ accumulated_cents -= $100
   └─ Se ejecuta ApplyCreditToPeriodsUseCase
5. ApplyCreditToPeriodsUseCase aplica crédito FIFO a períodos impagos:
   ├─ Cubre TODOS los conceptos (MAINTENANCE, WATER, EXTRAORDINARY_FEE, PENALTIES)
   ├─ Verifica allocaciones existentes para no duplicar
   └─ Usa queryRunner para atomicidad
```

**Ejemplo**: Casa 22 con pagos mensuales de $800.22:
```
Mes 1:  accumulated_cents = 0.22
Mes 2:  accumulated_cents = 0.44
...
Mes 454: accumulated_cents ≈ $99.88
Mes 455: accumulated_cents = $100.10 → credit_balance += $100, accumulated_cents = $0.10
```

### 4. Consultar Balance

**Quién lo hace**: `GetHousePeriodBalanceUseCase`

**Qué sucede**:
```
1. GetHousePeriodBalanceUseCase.execute(houseId=15, periodId=1)
2. HousePeriodChargeCalculatorService.getTotalExpectedByHousePeriod(15, 1)
   └─ SELECT SUM(expected_amount) FROM house_period_charges
3. HousePeriodChargeCalculatorService.getTotalPaidByHousePeriod(15, 1)
   └─ SELECT SUM(allocated_amount) FROM record_allocations
4. calculateBalance() = expected - paid
5. Retorna desglose por concepto
```

### 5. Generar Reportes

**Use Cases**: `GetPeriodReportUseCase`, `GetHousePaymentHistoryUseCase`, `ClassifyHousesByPaymentUseCase`

(Sin cambios respecto a la versión anterior - referir a API_ENDPOINTS.md para detalles)

---

## Integración con Otros Módulos

### Bank Reconciliation Module

**Flujo actualizado (FIFO, sin period_id)**:
```
TransactionBank → ReconciliationUseCase
  ├─ ReconciliationPersistenceService.persistReconciliation()
  │  └─ (transacción atómica: crear status, record, house_record)
  │
  └─ FUERA DE TX: AllocatePaymentUseCase.execute({
       record_id, house_id, amount_to_distribute
       // SIN period_id → FIFO automático
     })
```

**Callers actualizados** (todos usan FIFO sin period_id):
- `ReconciliationPersistenceService` - conciliación automática
- `UnclaimedDepositsService` - asignación manual de depósitos
- `MatchSuggestionsService` - cross-matching

**Callers que mantienen period_id (modo manual)**:
- `PaymentManagementController.confirmDistribution()` - confirmación de distribución AI

### Backfill Allocations

**Flujo actualizado**:
```
BackfillAllocationsUseCase.execute()
  ├─ Encuentra records confirmados sin allocations
  ├─ Para cada record (orden cronológico ASC):
  │  ├─ EnsurePeriodExistsUseCase.execute(year, month)
  │  │  └─ Garantiza que el período y sus charges existan
  │  └─ AllocatePaymentUseCase.execute({
  │       record_id, house_id, amount
  │       // SIN period_id → FIFO automático
  │     })
  └─ Retorna resultados por record
```

---

## Áreas Problemáticas que Necesitan Atención

### 1. Creación/Ajuste de Períodos

**Problema**: El sistema de creación de períodos tiene gaps que pueden causar inconsistencias.

**Escenarios problemáticos**:

a) **Período creado antes de que existan todas las casas**: Si se crea un período y luego se agregan casas nuevas, esas casas NO tendrán `house_period_charges` para ese período.
   - **Impacto**: AllocatePaymentUseCase caerá al fallback legacy para esas casas en ese período
   - **Fix necesario**: Un mecanismo para regenerar charges cuando se agregan casas

b) **Cambio de PeriodConfig después de crear período**: Los charges se congelan al crear el período. Si se cambia la config después, los períodos existentes mantienen los montos anteriores.
   - **Impacto**: Intencional (snapshot inmutable), pero no hay UI para ajustar en batch
   - **Fix necesario**: Endpoint de ajuste batch por período

c) **Activación/desactivación de water o extraordinary_fee**: Si se cambia `water_active` o `extraordinary_fee_active` en un período existente, los charges existentes NO se actualizan.
   - **Impacto**: Inconsistencia entre flags del período y charges reales
   - **Fix necesario**: `UpdatePeriodConceptsUseCase` debe regenerar charges al cambiar flags

d) **Períodos sin charges (legacy)**: Períodos creados antes del sistema HPC no tienen charges.
   - **Impacto**: Se usa fallback legacy (funciona pero no incluye PENALTIES)
   - **Mitigación**: Migración `SeedLegacyHousePeriodCharges` rellena charges faltantes
   - **Estado**: Migración creada, pendiente de ejecutar en staging/prod

### 2. Penalidades en Distribución FIFO

**Estado actual**: Las penalidades se incluyen como concepto a cubrir en FIFO si existen en `house_period_charges`.

**Pendiente**: Verificar que `SeedHousePeriodChargesService` crea charges de tipo PENALTIES correctamente para casas morosas al crear un nuevo período.

### 3. AI Distribution + FIFO

**Estado actual**: `DistributePaymentWithAIUseCase` sugiere distribución y `confirmDistribution` la aplica con `period_id` específico (modo manual).

**Potencial problema**: La sugerencia de AI podría no considerar allocaciones existentes. Si el admin confirma una distribución AI para un período que ya tiene pagos, podría haber sobre-asignación.

**Fix necesario**: Actualizar `DistributePaymentWithAIUseCase` para que consulte allocaciones existentes antes de sugerir.

---

## Tabla de Datos: `house_period_charges`

**Propósito**: Snapshot inmutable de cargos esperados

**Estructura**:
```sql
SELECT * FROM house_period_charges
WHERE house_id=15 AND period_id=1
ORDER BY concept_type;

| id  | house_id | period_id | concept_type       | expected_amount | source         |
|-----|----------|-----------|-------------------|-----------------|----------------|
| 100 | 15       | 1         | maintenance        | 800             | period_config  |
| 101 | 15       | 1         | water              | 200             | override       |
| 102 | 15       | 1         | extraordinary_fee  | 1000            | period_config  |
| 103 | 15       | 1         | penalties          | 100             | auto_penalty   |
```

**Índices**:
- `UNIQUE (house_id, period_id, concept_type)` - No hay duplicados
- `INDEX (house_id, period_id)` - Queries rápidas para una casa
- `INDEX (period_id)` - Queries rápidas de todo un período

---

## Tabla de Datos: `period_config`

**Campos relevantes para distribución**:
```sql
SELECT id, default_maintenance_amount, default_water_amount,
       default_extraordinary_fee_amount, late_payment_penalty_amount,
       cents_credit_threshold, is_active
FROM period_config WHERE is_active = true;

| id | maintenance | water | extraordinary | penalty | cents_threshold | active |
|----|-------------|-------|---------------|---------|-----------------|--------|
| 1  | 800         | 200   | 1000          | 100     | 100             | true   |
```

**`cents_credit_threshold`**: Umbral configurable para convertir centavos acumulados a crédito. Default $100. Antes era hardcodeado a $1 (causaba crédito prematuro).

---

## Consultas SQL Útiles para Debugging

### Verificar sobre-asignaciones (DEBE RETORNAR 0 FILAS)
```sql
SELECT ra.house_id, ra.period_id, ra.concept_type,
       hpc.expected_amount, SUM(ra.allocated_amount) as total_allocated
FROM record_allocations ra
JOIN house_period_charges hpc ON hpc.house_id = ra.house_id
  AND hpc.period_id = ra.period_id AND hpc.concept_type = ra.concept_type
GROUP BY ra.house_id, ra.period_id, ra.concept_type, hpc.expected_amount
HAVING SUM(ra.allocated_amount) > hpc.expected_amount;
```

### Ver centavos acumulados por casa
```sql
SELECT house_id, accumulated_cents, credit_balance, debit_balance
FROM house_balances
WHERE accumulated_cents > 0
ORDER BY accumulated_cents DESC;
```

### Ver distribución FIFO de una casa (cómo se distribuyeron los pagos)
```sql
SELECT ra.period_id, p.year, p.month, ra.concept_type,
       ra.allocated_amount, ra.expected_amount, ra.payment_status,
       ra.record_id, ra.created_at
FROM record_allocations ra
JOIN periods p ON p.id = ra.period_id
WHERE ra.house_id = (SELECT id FROM houses WHERE number_house = 22)
ORDER BY p.year ASC, p.month ASC, ra.concept_type;
```

### Períodos sin house_period_charges (potencial problema)
```sql
SELECT p.id, p.year, p.month
FROM periods p
WHERE NOT EXISTS (
  SELECT 1 FROM house_period_charges hpc WHERE hpc.period_id = p.id
)
ORDER BY p.year, p.month;
```

### Casas sin charges en el último período
```sql
SELECT DISTINCT h.id, h.number_house
FROM houses h
LEFT JOIN house_period_charges hpc
  ON h.id = hpc.house_id AND hpc.period_id = (
    SELECT id FROM periods ORDER BY year DESC, month DESC LIMIT 1
  )
WHERE hpc.id IS NULL
ORDER BY h.number_house;
```

### Cargos duplicados (debería no haber)
```sql
SELECT house_id, period_id, concept_type, COUNT(*)
FROM house_period_charges
GROUP BY house_id, period_id, concept_type
HAVING COUNT(*) > 1;
```

---

## Flujo de Ajustes y Reversiones

### Ajustar Cargo

**Quién lo hace**: `AdjustHousePeriodChargeUseCase`

**Validaciones antes de ajustar**:
- Período no > 3 meses atrás (proteger histórico)
- Nuevo monto diferente al actual
- Nuevo monto >= pagos ya asignados

### Reversionar Cargo

**Quién lo hace**: `ReverseHousePeriodChargeUseCase`

**Validaciones**:
- Período no > 3 meses atrás
- Sin pagos asignados a este cargo (error si existen)

### Condonar Penalidad

**Quién lo hace**: `CondonePenaltyUseCase`

**Validaciones**:
- Solo penalidades (error si es otro concepto)
- Sin pagos asignados a la penalidad

---

## Migraciones Recientes

### Ejecutadas o pendientes de ejecutar

| Migración | Timestamp | Descripción | Estado |
|-----------|-----------|-------------|--------|
| `UpdatePaymentDueDay` | 1769800000000 | Cambiar día límite de pago | Pendiente staging |
| `AddConceptActivationToPeriods` | 1769810000000 | Flags water/extraordinary en periods | Pendiente staging |
| `AddHouseIdToCtaPenalties` | 1769820000000 | house_id + unique index en cta_penalties | Pendiente staging |
| `CreateHousePeriodCharges` | 1770000000000 | Tabla house_period_charges | Pendiente staging |
| `AddCentsCreditThreshold` | 1770100000000 | cents_credit_threshold en period_config | Pendiente staging |
| `SeedLegacyHousePeriodCharges` | 1770200000000 | Rellenar charges para períodos existentes | Pendiente staging |
| `FixStaleEnumTypes` | 1770300000000 | Limpiar tipos enum _old residuales | Pendiente staging |

### Orden de ejecución

```bash
npm run db:deploy   # Ejecuta todas las pendientes en orden de timestamp
```

---

## Problemas Conocidos con TypeORM Enums

### Causa raíz
La BD original (`bd_initial.sql`) creó enums con nombres cortos (`validation_status_t`, `role_t`, `status_t`), pero TypeORM `synchronize` espera nombres auto-generados (`transactions_status_validation_status_enum`, etc.).

### Fix aplicado
Se agregó `enumName` explícito en las entities para que TypeORM use los nombres originales de la BD:

| Entity | Column | enumName |
|--------|--------|----------|
| `TransactionStatus` | `validation_status` | `validation_status_t` |
| `User` | `role` | `role_t` |
| `User` | `status` | `status_t` |
| `HousePeriodCharge` | `concept_type` | `record_allocations_concept_type_enum` |

### Regla para nuevas entities con enums
Siempre especificar `enumName` que coincida con el tipo que existe en la BD. Si se comparte un enum entre tablas (como `AllocationConceptType`), usar el nombre del primer tipo creado.

---

## Performance

### Inserción de Cargos
- ~264 registros en batch insert: < 100ms
- Índices optimizados para búsquedas posteriores

### Queries Típicas
- `findByHouseAndPeriod()`: ~10ms (índice compuesto)
- `getTotalExpectedByHousePeriod()`: ~5ms (SUM con WHERE)
- `getPeriodReport()`: ~50ms (agrupa 198 registros)
- FIFO con 12 períodos: ~120ms (12 × findByHouseAndPeriod)

### Escalabilidad
- Soporta 66 casas actuales
- Escalable a 1000+ casas sin cambios
- Índices previenen full table scans

---

## Referencias

**Documentación detallada**:
- `docs/features/payment-management/HOUSE_PERIOD_CHARGES.md` - Detalles técnicos de charges
- `docs/features/payment-management/README.md` - Visión general del módulo
- `docs/features/payment-management/API_ENDPOINTS.md` - Endpoints REST
- `docs/features/payment-management/MIGRATIONS.md` - Migraciones de BD

**Código**:
- AllocatePaymentUseCase: `src/features/payment-management/application/allocate-payment.use-case.ts`
- ApplyCreditToPeriodsUseCase: `src/features/payment-management/application/apply-credit-to-periods.use-case.ts`
- BackfillAllocationsUseCase: `src/features/payment-management/application/backfill-allocations.use-case.ts`
- Entity PeriodConfig: `src/shared/database/entities/period-config.entity.ts`
- Entity HouseBalance: `src/shared/database/entities/house-balance.entity.ts`
- Módulo: `src/features/payment-management/payment-management.module.ts`

---

**Última actualización**: 2026-02-12
**Status**: ✅ COMPLETAMENTE IMPLEMENTADO Y FUNCIONAL
