# Balance Features Pending - Analisis de Arquitectura y Opciones de Implementacion

> **Fecha de analisis:** 2026-02-09 (actualizado 2026-02-10, reglas de negocio corregidas)
> **Estado:** Documento de decision — Opcion D seleccionada, plan de implementacion definido
> **Autor:** Analisis automatizado Claude Code
> **Objetivo:** Documentar el estado actual de la distribucion de pagos, los gaps identificados, y las opciones de implementacion para conectar pagos conciliados con las cuentas de cada casa.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura Actual: Flujo Completo de Pagos](#2-arquitectura-actual-flujo-completo-de-pagos)
3. [Dos Modelos de Datos Coexistentes](#3-dos-modelos-de-datos-coexistentes)
4. [Gaps Identificados](#4-gaps-identificados)
5. [Consumidores de Tablas cta_*](#5-consumidores-de-tablas-cta)
6. [Consumidores de record_allocations](#6-consumidores-de-record_allocations)
7. [Opciones de Implementacion](#7-opciones-de-implementacion)
8. [Matriz de Decision](#8-matriz-de-decision)
9. [Archivos Clave de Referencia](#9-archivos-clave-de-referencia)
10. [Decisiones Pendientes](#10-decisiones-pendientes)
11. [Reglas de Negocio Confirmadas](#11-reglas-de-negocio-confirmadas)
12. [Analisis de Escenarios con Reglas Corregidas](#12-analisis-de-escenarios-con-reglas-corregidas)
13. [Mejoras de Logica de Negocio Requeridas](#13-mejoras-de-logica-de-negocio-requeridas)
14. [Nuevo Endpoint: Pagos Esperados por Ano](#14-nuevo-endpoint-pagos-esperados-por-ano)
15. [Tabla Comparativa Final por Escenario](#15-tabla-comparativa-final-por-escenario)
16. [Veredicto y Plan de Implementacion Final](#16-veredicto-y-plan-de-implementacion-final)

---

## 1. Resumen Ejecutivo

### Problema

Tras ejecutar `POST /bank-reconciliation/reconcile`, el sistema identifica correctamente a que casa pertenece cada deposito bancario. La conciliacion crea los registros necesarios (`TransactionStatus`, `Record`, `HouseRecord`) y **ya invoca** `AllocatePaymentUseCase` para distribuir el pago a conceptos via `record_allocations`.

Sin embargo, existen **dos modelos de datos paralelos** para rastrear pagos:

| Modelo | Tablas | Usado por | Estado |
|--------|--------|-----------|--------|
| **Legacy (cta_*)** | `cta_maintenance`, `cta_water`, `cta_penalties`, `cta_extraordinary_fee`, `cta_other_payments` | Historical Records (import Excel) | Solo datos historicos |
| **Nuevo (record_allocations)** | `record_allocations` + `house_balances` | Bank Reconciliation, Payment Management | Activo para nuevos pagos |

Las tablas `cta_*` quedan **sin poblar** cuando se procesan pagos nuevos via conciliacion bancaria. Solo el feature de Historical Records las utiliza.

### Estado Actual

- **Funcional:** La distribucion de pagos a conceptos ya ocurre via `AllocatePaymentUseCase`
- **Funcional:** El estado de cuenta (`GET /houses/:houseId/status`) ya lee de `record_allocations`
- **Funcional:** El credito automatico se aplica via `ApplyCreditToPeriodsUseCase` (FIFO)
- **Gap:** Las FK `record.cta_*_id` quedan NULL para pagos conciliados
- **Gap:** `record_allocations.concept_id` usa valores hardcodeados (1, 2, 3), no IDs reales de cta_*
- **Gap:** No se crean registros cta_* por casa+periodo cuando se crea un periodo nuevo

---

## 2. Arquitectura Actual: Flujo Completo de Pagos

### 2.1 Flujo de Conciliacion Bancaria

```
POST /bank-reconciliation/reconcile
  |
  +-- ReconcileUseCase.execute()
  |     Match: TransactionBank <-> Voucher <-> House
  |
  +-- ReconciliationPersistenceService.persistReconciliation()
        |
        +-- [DENTRO DE TRANSACCION]
        |     1. TransactionStatus (validation_status: CONFIRMED)
        |     2. Record (vouchers_id + transaction_status_id)
        |        -> record.cta_*_id = NULL (no se populan)
        |     3. HouseRecord (house_id <-> record_id)
        |     4. TransactionBank.confirmation_status = true
        |     5. Voucher.confirmation_status = true
        |
        +-- [FUERA DE TRANSACCION]
              6. getOrCreateCurrentPeriod()
              7. AllocatePaymentUseCase.execute()
                   -> Crea RecordAllocation por cada concepto
                   -> Actualiza HouseBalance
                   -> ApplyCreditToPeriodsUseCase (si sobra credito)
```

**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts` (lineas 89-226)

### 2.2 Flujo de AllocatePaymentUseCase

```
AllocatePaymentUseCase.execute({record_id, house_id, amount, period_id})
  |
  +-- 1. Validar amount > 0
  +-- 2. Obtener Period (por ID o fecha actual)
  +-- 3. Obtener HouseBalance (getOrCreate)
  +-- 4. Obtener PeriodConfig activo
  +-- 5. preparePaymentConcepts()
  |     +-- Maintenance: siempre (default o HousePeriodOverride)
  |     +-- Water: si config tiene default_water_amount
  |     +-- Extraordinary Fee: si config tiene default_extraordinary_fee_amount
  |     -> conceptId HARDCODEADO: 1 (maint), 2 (water), 3 (extra fee)
  |
  +-- 6. distributePayment() [FIFO secuencial]
  |     Para cada concepto:
  |       allocated = min(remaining, expected)
  |       -> Crea RecordAllocation {record_id, house_id, period_id, concept_type, concept_id, allocated_amount, expected_amount, payment_status}
  |       remaining -= allocated
  |
  +-- 7. updateHouseBalance(remaining)
        +-- Paga debit_balance primero
        +-- Separa centavos -> accumulated_cents
        +-- Parte entera -> credit_balance
        +-- Si credit > 0 -> ApplyCreditToPeriodsUseCase
```

**Archivo:** `src/features/payment-management/application/allocate-payment.use-case.ts`

### 2.3 Flujo de Importacion Historica (el unico que usa cta_*)

```
POST /historical-records/upload (Excel)
  |
  +-- HistoricalRowProcessorService.processRow()
        |
        +-- [DENTRO DE TRANSACCION con retry x3]
              1. EnsurePeriodExists
              2. Create TransactionBank
              3. Create TransactionStatus
              4. CtaRecordCreatorService.createCtaRecords()
              |     -> cta_maintenance.create({amount, period_id})  // SI amount > 0
              |     -> cta_water.create({amount, period_id})        // SI amount > 0
              |     -> cta_penalties.create({amount, period_id})    // SI amount > 0
              |     -> cta_extraordinary_fee.create({amount, period_id})
              |     -> Retorna {ctaMaintenanceId, ctaWaterId, ...}
              |
              5. Record.create({
              |     vouchers_id, transaction_status_id,
              |     cta_maintenance_id,       // <- ID REAL del cta_maintenance
              |     cta_water_id,             // <- ID REAL del cta_water
              |     cta_penalties_id,         // <- ID REAL
              |     cta_extraordinary_fee_id  // <- ID REAL
              |  })
              |
              6. HouseRecord.create({house_id, record_id})  // Si casa > 0
```

**Archivos:**
- `src/features/historical-records/infrastructure/processors/cta-record-creator.service.ts`
- `src/features/historical-records/infrastructure/processors/historical-row-processor.service.ts`

---

## 3. Dos Modelos de Datos Coexistentes

### 3.1 Modelo Legacy: Tablas cta_*

```
Period (1) ----< cta_maintenance (N)
           ----< cta_water (N)
           ----< cta_extraordinary_fee (N)
           ----< cta_penalties (N) ----> House (opcional)

Record ----> cta_maintenance (FK nullable)
       ----> cta_water (FK nullable)
       ----> cta_penalties (FK nullable)
       ----> cta_extraordinary_fee (FK nullable)
       ----> cta_other_payments (FK nullable)
```

**Caracteristicas:**
- Registros de CARGO (lo que se debe), no de PAGO
- `cta_maintenance`, `cta_water`, `cta_extraordinary_fee`: Solo `period_id` (no `house_id`)
- `cta_penalties`: Tiene `house_id` + unique index (house_id, period_id)
- `cta_other_payments`: Sin `period_id`, miscelaneos
- Sin tracking de pagos parciales
- Sin tracking de cuanto se pago vs cuanto se debe

### 3.2 Modelo Nuevo: record_allocations

```
Record (1) ----< RecordAllocation (N)
                   |-> house_id (FK houses)
                   |-> period_id (FK periods)
                   |-> concept_type (enum: maintenance|water|extraordinary_fee|penalties|other)
                   |-> concept_id (int, placeholder actualmente)
                   |-> allocated_amount (lo que se pago)
                   |-> expected_amount (lo que se esperaba)
                   |-> payment_status (complete|partial|overpaid)

House (1) ----< HouseBalance (1)
                  |-> credit_balance
                  |-> debit_balance
                  |-> accumulated_cents
```

**Caracteristicas:**
- Granularidad por casa + periodo + concepto
- Tracking de pagos parciales (PARTIAL vs COMPLETE)
- Montos esperados vs pagos reales
- Balance acumulado por casa
- Credito automatico FIFO a periodos impagos

### 3.3 Comparacion Detallada

| Aspecto | cta_* (Legacy) | record_allocations (Nuevo) |
|---------|---------------|---------------------------|
| **Granularidad** | Por periodo (excepto penalties) | Por casa + periodo + concepto |
| **Tipo de dato** | Cargo (lo que se cobra) | Pago (lo que se aplico) |
| **Pagos parciales** | No soportado | Si (COMPLETE/PARTIAL/OVERPAID) |
| **Balance por casa** | No (calculado externamente) | Si (house_balances) |
| **Quien escribe** | Historical Records UNICAMENTE | Bank Reconciliation + Payment Management |
| **Quien lee** | Record.findByHouseId() (carga cta_*) | CalculateHouseBalanceStatusUseCase, GetPaymentHistoryUseCase |
| **Estado de cuenta** | No lo usa directamente | **Fuente principal** para /houses/:houseId/status |
| **Credito automatico** | No | Si (ApplyCreditToPeriodsUseCase) |
| **Identificacion por centavos** | Historico: si (parseado del Excel) | No aplica (ya identificado en conciliacion) |

---

## 4. Gaps Identificados

### Gap 1: Record.cta_*_id siempre NULL para pagos conciliados

**Donde:** `reconciliation-persistence.service.ts` lineas 124-131

```typescript
// Se crea Record solo con vouchers_id y transaction_status_id
const newRecord = await this.recordRepository.create({
  vouchers_id: null,
  transaction_status_id: transactionStatus.id,
  // cta_maintenance_id: undefined  <- NO SE POPULA
  // cta_water_id: undefined        <- NO SE POPULA
});
```

**Impacto:** `Record.findByHouseId()` que hace JOIN con cta_* retorna relaciones vacias para pagos nuevos.

### Gap 2: concept_id hardcodeado en AllocatePaymentUseCase

**Donde:** `allocate-payment.use-case.ts` lineas 160-195

```typescript
concepts.push({
  type: AllocationConceptType.MAINTENANCE,
  conceptId: 1,  // Hardcodeado, NO es un cta_maintenance.id real
  expectedAmount: maintenanceAmount,
});
// Water: conceptId: 2, ExtraordinaryFee: conceptId: 3
```

**Impacto:** `record_allocations.concept_id` no puede usarse como FK a tablas cta_*.

### Gap 3: No se crean cta_* al crear periodos

**Donde:** `create-period.use-case.ts` linea 40, `ensure-period-exists.use-case.ts` linea 70

```typescript
// TODO: Crear registros en cta_maintenance, cta_water, etc. usando activeConfig
// TODO: Crear registros default en cta_maintenance, cta_water, etc.
```

**Impacto:** Las tablas cta_* no tienen registros para periodos creados automaticamente durante la conciliacion.

### Gap 4: cta_maintenance/water/extraordinary_fee no tienen house_id

**Donde:** Entidades `cta-maintenance.entity.ts`, `cta-water.entity.ts`, `cta-extraordinary-fee.entity.ts`

Solo `cta_penalties` tiene `house_id`. Las demas tablas cta_* son por periodo global, no por casa.

**Impacto:** Imposible rastrear cargos individuales por casa usando las tablas cta_* actuales (excepto penalties).

### Gap 5: ApplyCreditToPeriodsUseCase usa record_id=0 y concept_id=0

**Donde:** `apply-credit-to-periods.use-case.ts`

```typescript
// Inserta directamente via SQL (bypass del repository)
INSERT INTO record_allocations
  (record_id, house_id, period_id, concept_type, concept_id,
   allocated_amount, expected_amount, payment_status)
VALUES (0, houseId, periodId, 'maintenance', 0, amount, expected, status)
```

**Impacto:** `record_id=0` marca aplicaciones de credito del sistema (no hay Record real asociado). `concept_id=0` no referencia ninguna tabla cta_*.

### Gap 6: Endpoint /houses/:houseId/payments no muestra distribucion

**Donde:** `get-house-transactions.use-case.ts`

Este endpoint retorna transacciones bancarias crudas (monto, fecha, banco) pero NO incluye como se distribuyo cada pago a los conceptos. Para ver la distribucion, se debe usar `GET /houses/:houseId/status`.

---

## 5. Consumidores de Tablas cta_*

### 5.1 Escritores (CREATE/INSERT)

| Archivo | Tabla(s) | Contexto |
|---------|----------|----------|
| `historical-records/processors/cta-record-creator.service.ts` | cta_maintenance, cta_water, cta_penalties, cta_extraordinary_fee | Import de datos historicos desde Excel |
| `payment-management/application/generate-penalty.use-case.ts` | cta_penalties | Genera penalidades por morosidad |
| `vouchers/application/confirm-voucher-frontend.use-case.ts` | Record con cta_*_id = null | Inicializa FKs a null |
| `vouchers/application/confirm-voucher.use-case.ts` | Record con cta_*_id = null | Inicializa FKs a null (WhatsApp) |

### 5.2 Lectores (SELECT/JOIN)

| Archivo | Tabla(s) | Contexto |
|---------|----------|----------|
| `shared/database/repositories/record.repository.ts` → `findByHouseId()` | JOIN con todas cta_* | Obtiene records con datos de cuentas |
| Cada repositorio cta_*: `findById()`, `findByPeriodId()`, `findAll()` | Individual | CRUD basico |

### 5.3 Definiciones de Tipo/Relacion

| Archivo | Descripcion |
|---------|-------------|
| `shared/database/entities/record.entity.ts` | FK columns y ManyToOne relations a 5 cta_* |
| `shared/database/entities/period.entity.ts` | OneToMany relations a 4 cta_* |
| `shared/database/entities/cta-*.entity.ts` (5 archivos) | Entity definitions |
| `shared/database/database.module.ts` | Registro global de entidades y repositorios |

### 5.4 Migraciones

| Archivo | Cambio |
|---------|--------|
| `1706900000001-FixRecordColumnNameTypos.ts` | Fix: cta_maintence_id → cta_maintenance_id, cta_penalities_id → cta_penalties_id |
| `1769820000000-AddHouseIdToCtaPenalties.ts` | Agrega house_id a cta_penalties + unique index (house_id, period_id) |

### 5.5 Frontend

| Archivo | Uso |
|---------|-----|
| `agave-front/src/shared/types/historical-records.types.ts` | Interface HistoricalRecord con campos cta_* (solo display de datos importados) |

### 5.6 Hallazgo Clave

**Las tablas cta_* son consumidas EXCLUSIVAMENTE por:**
1. **Historical Records** (import Excel) - WRITER principal
2. **GeneratePenaltyUseCase** - WRITER de cta_penalties
3. **Record.findByHouseId()** - READER (JOIN con cta_*)
4. **Frontend** - Solo tipos para display de datos historicos

**Ningun otro feature del sistema (conciliacion, vouchers, estado de cuenta) depende de las tablas cta_* para su funcionamiento.**

---

## 6. Consumidores de record_allocations

### 6.1 Escritores

| Archivo | Metodo | Contexto |
|---------|--------|----------|
| `allocate-payment.use-case.ts` | `recordAllocationRepository.create()` | Distribucion de pagos post-conciliacion |
| `apply-credit-to-periods.use-case.ts` | INSERT directo SQL (record_id=0) | Aplicacion automatica de credito |
| `reconciliation-persistence.service.ts` | Via AllocatePaymentUseCase | Post-conciliacion bancaria |
| `unclaimed-deposits.service.ts` | Via AllocatePaymentUseCase | Asignacion manual de depositos |
| `match-suggestions.service.ts` | Via AllocatePaymentUseCase | Cross-matching aplicado |
| `payment-management.controller.ts` → confirm-distribution | Via AllocatePaymentUseCase | Confirmacion de distribucion AI |

### 6.2 Lectores

| Archivo | Metodo | Contexto |
|---------|--------|----------|
| `calculate-house-balance-status.use-case.ts` | `findByHouseAndPeriod()` | **Estado de cuenta** (morosa/al_dia/saldo_a_favor) |
| `get-payment-history.use-case.ts` | `findByHouseId()`, `findByHouseAndPeriod()` | Historial de pagos |
| `distribute-payment-with-ai.use-case.ts` | `findByHouseAndPeriod()` | Calculo de pendientes para AI |
| `allocate-payment.use-case.ts` | (indirecto via HouseBalance) | Verificacion de balance |

### 6.3 Hallazgo Clave

**`record_allocations` es la fuente de verdad para:**
- Estado de cuenta de cada casa
- Tracking de pagos parciales
- Distribucion de dinero a conceptos
- Balance acumulado (via HouseBalance)

---

## 7. Opciones de Implementacion

### Opcion A: Consolidar en record_allocations (Deprecar cta_* para nuevos pagos)

**Filosofia:** Las tablas cta_* quedan como modelo legacy para datos historicos. Todos los pagos nuevos se rastrean exclusivamente via `record_allocations` + `house_balances`.

**Cambios necesarios:**

1. **Limpiar conceptId hardcodeado** en `allocate-payment.use-case.ts`:
   - Cambiar `conceptId: 1/2/3` a `conceptId: 0` o un valor sentinel que indique "sin referencia a cta_*"
   - Documentar que `concept_id=0` significa "no vinculado a tabla cta_*"

2. **Opcional: Agregar tracking de cargos esperados** en `record_allocations`:
   - Actualmente los montos esperados se calculan al vuelo desde PeriodConfig + HousePeriodOverride
   - Podria agregarse una tabla `house_period_charges` que persista los cargos por casa+periodo+concepto al crear el periodo

3. **Enriquecer endpoint /houses/:houseId/payments:**
   - Incluir RecordAllocations asociadas a cada transaccion bancaria
   - Mostrar como se distribuyo cada pago

4. **Mantener GeneratePenaltyUseCase** escribiendo a cta_penalties (ya funciona bien con house_id)

**Pros:**
- Cambio minimo al codigo existente
- El estado de cuenta ya funciona con record_allocations
- No requiere migraciones de esquema
- Consistente con el desarrollo reciente

**Contras:**
- Dos modelos de datos coexisten (puede confundir)
- Record.findByHouseId() retorna cta_* vacios para pagos nuevos
- Datos historicos y nuevos se consultan de forma diferente

**Complejidad:** Baja
**Riesgo:** Bajo

---

### Opcion B: Sincronizar ambos modelos (cta_* + record_allocations)

**Filosofia:** Mantener ambos modelos sincronizados. Cuando se distribuye un pago, crear registros en cta_* Y en record_allocations.

**Cambios necesarios:**

1. **En AllocatePaymentUseCase**, despues de crear RecordAllocation:
   - Buscar o crear el registro cta_* correspondiente por periodo
   - Actualizar Record con los cta_*_id reales
   - Actualizar concept_id en RecordAllocation con el ID real de cta_*

2. **En EnsurePeriodExistsUseCase y CreatePeriodUseCase** (resolver TODOs):
   - Al crear un periodo, crear registros cta_maintenance, cta_water, etc. con los montos de PeriodConfig
   - Una entrada cta_* por periodo (modelo actual sin house_id)

3. **En ReconciliationPersistenceService**:
   - Pasar los cta_*_id al crear el Record

4. **Logica de busqueda/creacion de cta_*:**
   - Si ya existe cta_maintenance para el periodo → reutilizar su ID
   - Si no existe → crear con el monto de PeriodConfig

**Pros:**
- Record.findByHouseId() retorna datos completos (tanto historicos como nuevos)
- Modelo unificado para queries
- concept_id tiene sentido real

**Contras:**
- Complejidad significativa en AllocatePaymentUseCase
- Las tablas cta_* son por periodo (no por casa), generando posible desconexion conceptual
- Doble escritura en cada operacion de pago
- Riesgo de inconsistencia si una escritura falla y la otra no

**Complejidad:** Media-Alta
**Riesgo:** Medio

---

### Opcion C: Migrar cta_* a modelo por casa (Refactor completo)

**Filosofia:** Agregar `house_id` a todas las tablas cta_* (como ya se hizo con cta_penalties) y usarlas como tabla de CARGOS por casa+periodo.

**Cambios necesarios:**

1. **Migraciones:**
   - `ALTER TABLE cta_maintenance ADD COLUMN house_id INT REFERENCES houses(id)`
   - `ALTER TABLE cta_water ADD COLUMN house_id INT REFERENCES houses(id)`
   - `ALTER TABLE cta_extraordinary_fee ADD COLUMN house_id INT REFERENCES houses(id)`
   - Agregar unique index (house_id, period_id) a cada tabla

2. **Logica de creacion de cargos:**
   - Al crear periodo: crear 66 registros cta_maintenance (uno por casa)
   - Si water_active: crear 66 registros cta_water
   - Si extraordinary_fee_active: crear 66 registros cta_extraordinary_fee
   - Usar HousePeriodOverride para montos custom

3. **AllocatePaymentUseCase:**
   - Buscar cta_* por house_id + period_id
   - Vincular Record con cta_*_id reales
   - Vincular RecordAllocation.concept_id con cta_*.id real

4. **Historical Records:**
   - Adaptar CtaRecordCreatorService para incluir house_id

5. **Estado de cuenta:**
   - Podria leerse directamente de cta_* + record_allocations combinados
   - cta_* = lo que se debe, record_allocations = lo que se pago

**Pros:**
- Modelo de datos coherente y completo
- cta_* como "cargos" y record_allocations como "pagos"
- Permite reportes financieros mas robustos
- Consistente entre datos historicos y nuevos

**Contras:**
- Refactor significativo
- 66 registros x conceptos activos por periodo (volumen)
- Riesgo de romper Historical Records (que no manda house_id para todos los cta_*)
- Migraciones de esquema en produccion
- Necesita migrar datos historicos existentes

**Complejidad:** Alta
**Riesgo:** Alto

---

### Opcion D: Tabla de Cargos nueva (house_period_charges) + Deprecar cta_*

**Filosofia:** Crear una nueva tabla `house_period_charges` que reemplace conceptualmente a las cta_* para tracking de cargos por casa+periodo+concepto. Las cta_* quedan solo para datos historicos importados.

**Cambios necesarios:**

1. **Nueva tabla:**
```sql
CREATE TABLE house_period_charges (
  id SERIAL PRIMARY KEY,
  house_id INT NOT NULL REFERENCES houses(id),
  period_id INT NOT NULL REFERENCES periods(id),
  concept_type allocation_concept_type_enum NOT NULL,
  expected_amount FLOAT NOT NULL,
  source VARCHAR(50) DEFAULT 'period_config', -- 'period_config' | 'override' | 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(house_id, period_id, concept_type)
);
```

2. **Logica de creacion:**
   - Al crear periodo: crear charges para las 66 casas
   - Respetar HousePeriodOverride para montos custom
   - Concepto activo segun period.water_active / extraordinary_fee_active

3. **AllocatePaymentUseCase:**
   - Leer expected_amount de house_period_charges en vez de calcular al vuelo
   - Vincular RecordAllocation.concept_id con house_period_charges.id

4. **CalculateHouseBalanceStatusUseCase:**
   - Leer cargos de house_period_charges
   - Cruzar con record_allocations para determinar pagos

5. **Dejar cta_* intactas para Historical Records**

**Pros:**
- Diseno limpio desde cero, sin arrastrar limitaciones de cta_*
- Granularidad por casa+periodo+concepto
- No rompe Historical Records
- Separa claramente cargos (charges) de pagos (allocations)
- Reportes financieros robustos: charges - allocations = balance

**Contras:**
- Tabla nueva + migracion + logica de seed
- Mas complejidad inicial
- Tres modelos coexisten temporalmente (cta_*, record_allocations, house_period_charges)

**Complejidad:** Media
**Riesgo:** Medio-Bajo

---

### Opcion E: No hacer nada (Mantener status quo)

**Filosofia:** El sistema ya funciona. `record_allocations` + `house_balances` + calculos al vuelo desde PeriodConfig son suficientes para el estado de cuenta.

**Justificacion:**
- `GET /houses/:houseId/status` ya retorna estado completo
- Los montos esperados se calculan correctamente desde PeriodConfig + HousePeriodOverride
- No hay requerimiento de negocio bloqueado

**Pros:**
- Cero cambios
- Cero riesgo

**Contras:**
- Gap conceptual permanente entre datos historicos y nuevos
- concept_id sin sentido real en record_allocations
- Dos modelos de datos sin resolver

**Complejidad:** Ninguna
**Riesgo:** Ninguno (tecnico) / Deuda tecnica a futuro

---

## 8. Matriz de Decision

| Criterio | Opcion A | Opcion B | Opcion C | Opcion D | Opcion E |
|----------|----------|----------|----------|----------|----------|
| **Complejidad de implementacion** | Baja | Media-Alta | Alta | Media | Ninguna |
| **Riesgo de regresion** | Bajo | Medio | Alto | Medio-Bajo | Ninguno |
| **Consistencia de datos** | Media | Alta | Muy Alta | Alta | Baja |
| **Impacto en Historical Records** | Ninguno | Bajo | Alto | Ninguno | Ninguno |
| **Reportes financieros** | Limitados | Buenos | Excelentes | Excelentes | Limitados |
| **Migraciones necesarias** | No | No | Si (3 tablas) | Si (1 tabla) | No |
| **Alineacion con codigo actual** | Alta | Media | Baja | Media | Maxima |
| **Deuda tecnica resultante** | Media | Baja | Ninguna | Baja | Alta |

### Recomendacion

**Para MVP/corto plazo:** Opcion A (consolidar en record_allocations)
- Minimo esfuerzo, el sistema ya funciona con record_allocations
- Limpiar los conceptId hardcodeados es suficiente

**Para version robusta/largo plazo:** Opcion D (house_period_charges)
- Modelo limpio de cargos vs pagos
- No rompe nada existente
- Se puede implementar incrementalmente

---

## 9. Archivos Clave de Referencia

### Conciliacion Bancaria
- `src/features/bank-reconciliation/application/reconcile.use-case.ts`
- `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`

### Payment Management (Use Cases)
- `src/features/payment-management/application/allocate-payment.use-case.ts`
- `src/features/payment-management/application/apply-credit-to-periods.use-case.ts`
- `src/features/payment-management/application/calculate-house-balance-status.use-case.ts`
- `src/features/payment-management/application/get-payment-history.use-case.ts`
- `src/features/payment-management/application/distribute-payment-with-ai.use-case.ts`
- `src/features/payment-management/application/generate-penalty.use-case.ts`
- `src/features/payment-management/application/create-period.use-case.ts`
- `src/features/payment-management/application/ensure-period-exists.use-case.ts`

### Payment Management (Infrastructure)
- `src/features/payment-management/infrastructure/repositories/record-allocation.repository.ts`
- `src/features/payment-management/infrastructure/repositories/house-balance.repository.ts`
- `src/features/payment-management/infrastructure/repositories/period.repository.ts`
- `src/features/payment-management/infrastructure/repositories/period-config.repository.ts`

### Historical Records
- `src/features/historical-records/infrastructure/processors/cta-record-creator.service.ts`
- `src/features/historical-records/infrastructure/processors/historical-row-processor.service.ts`

### Entidades
- `src/shared/database/entities/record.entity.ts`
- `src/shared/database/entities/record-allocation.entity.ts`
- `src/shared/database/entities/house-balance.entity.ts`
- `src/shared/database/entities/cta-maintenance.entity.ts`
- `src/shared/database/entities/cta-water.entity.ts`
- `src/shared/database/entities/cta-penalties.entity.ts`
- `src/shared/database/entities/cta-extraordinary-fee.entity.ts`
- `src/shared/database/entities/cta-other-payments.entity.ts`

### Repositorios Compartidos
- `src/shared/database/repositories/record.repository.ts`
- `src/shared/database/repositories/cta-maintenance.repository.ts`
- `src/shared/database/repositories/cta-water.repository.ts`
- `src/shared/database/repositories/cta-penalties.repository.ts`
- `src/shared/database/repositories/cta-extraordinary-fee.repository.ts`

### Migraciones Relevantes
- `src/shared/database/migrations/1706900000001-FixRecordColumnNameTypos.ts`
- `src/shared/database/migrations/1769820000000-AddHouseIdToCtaPenalties.ts`
- `src/shared/database/migrations/1761855700765-PaymentManagementFeature.ts`

### Configuracion
- `src/features/payment-management/config/payment-management.config.ts`
- `src/features/payment-management/payment-management.module.ts`

---

## 10. Decisiones Pendientes

1. **Elegir opcion de implementacion** (A, B, C, D, o E)
2. **Definir si cta_other_payments necesita repositorio** (actualmente no tiene)
3. **Definir el rol de record_allocations.concept_id:**
   - Mantener como placeholder (0)?
   - Vincular a cta_*.id?
   - Vincular a futura tabla house_period_charges.id?
4. **Definir si endpoint /houses/:houseId/payments debe incluir distribucion** o si /houses/:houseId/status es suficiente
5. **Definir politica de periodos retroactivos:** que pasa cuando se carga un pago de un mes anterior al periodo actual
6. **Definir si ApplyCreditToPeriodsUseCase debe usar record_id=0** o crear un Record real de tipo "credito aplicado"
7. **Definir si penalties deben incluirse en AllocatePaymentUseCase** (actualmente solo distribuye a maintenance, water, extraordinary_fee)

---

## 11. Reglas de Negocio Confirmadas

> **Fecha:** 2026-02-10
> **Fuente:** Aclaracion directa del desarrollador/administrador del condominio.

### 11.1 Conceptos de Cobro

| Concepto | Siempre activo? | Default | Activacion |
|----------|----------------|---------|------------|
| **Mantenimiento** | Si, siempre | $800/mes | No requiere activacion. Se cobra a las 66 casas cada periodo. |
| **Agua** | No. OFF por default | `period.water_active = false` | Un administrador indica a partir de que periodo se cobra y hasta cuando se suspende. |
| **Cuota Extraordinaria** | No. OFF por default | `period.extraordinary_fee_active = false` | Un administrador la activa para periodo(s) especifico(s) con fecha limite. |
| **Penalizacion** | Automatica por morosidad | $100/periodo vencido | Se genera automaticamente al detectar periodo vencido sin pagar. |

### 11.2 Regla de Inmutabilidad de Montos (Solo Hacia Adelante)

**Regla critica:** Un administrador solo puede modificar montos de cuotas a partir de una **fecha futura**.

Ejemplo: Si hoy es febrero 2026:
- Puede cambiar mantenimiento a $750 a partir de **marzo 2026** en adelante
- **NO puede** cambiar el monto de enero 2026 ni febrero 2026 (ya transcurrieron o estan en curso)
- Lo mismo aplica para agua y cuota extraordinaria

**Implicacion para el modelo de datos:**
- `PeriodConfig.effective_from` debe ser >= primer dia del mes siguiente al actual
- Una vez que un periodo tiene cargos creados en `house_period_charges`, esos montos son **inmutables**
- `house_period_charges` funciona como **snapshot congelado** de lo que se cobro en ese periodo

### 11.3 Activacion/Suspension de Agua

El administrador controla el cobro de agua estableciendo `period.water_active`:
- **Activar:** Marcar `water_active = true` en los periodos a partir de los cuales se cobra
- **Suspender:** Marcar `water_active = false` en periodos futuros
- El monto de agua proviene de `PeriodConfig.default_water_amount` o de un `HousePeriodOverride`

Ejemplo de ciclo:
```
Ene-Mar 2026: water_active = false  (no se cobra agua)
Abr-Sep 2026: water_active = true   (admin activa cobro de agua a $200/mes)
Oct-Dic 2026: water_active = false   (admin suspende cobro de agua)
```

### 11.4 Cuota Extraordinaria

- Activada por administrador para periodo(s) especifico(s)
- `period.extraordinary_fee_active = true` solo en los periodos donde aplica
- Puede tener fecha limite de pago distinta (ej: 31 de julio)
- El monto proviene de `PeriodConfig.default_extraordinary_fee_amount` o un `HousePeriodOverride`

### 11.5 Resumen: Que Se Cobra por Periodo

Para un periodo dado, los cargos por casa son:

```
cargo_total = mantenimiento                           (SIEMPRE)
            + agua         SI water_active = true      (CONDICIONAL)
            + cuota_extra  SI extraordinary_fee_active  (CONDICIONAL)
            + penalizacion SI periodo vencido e impago  (AUTOMATICO)
```

Con `house_period_charges` (Opcion D), esto se materializa al crear el periodo:

```sql
-- Siempre:
INSERT INTO house_period_charges (house_id, period_id, concept_type, expected_amount, source)
  SELECT h.id, :period_id, 'maintenance', :monto_mantenimiento, 'period_config'
  FROM houses h;

-- Solo si water_active = true:
INSERT INTO house_period_charges (house_id, period_id, concept_type, expected_amount, source)
  SELECT h.id, :period_id, 'water', :monto_agua, 'period_config'
  FROM houses h;

-- Solo si extraordinary_fee_active = true:
INSERT INTO house_period_charges (house_id, period_id, concept_type, expected_amount, source)
  SELECT h.id, :period_id, 'extraordinary_fee', :monto_cuota_extra, 'period_config'
  FROM houses h;

-- Despues, aplicar HousePeriodOverride para casas con montos custom:
UPDATE house_period_charges
  SET expected_amount = :custom_amount, source = 'override'
  WHERE house_id = :house_id AND period_id = :period_id AND concept_type = :concept_type;
```

---

## 12. Analisis de Escenarios con Reglas Corregidas

> Todos los escenarios usan las reglas de negocio confirmadas en seccion 11.
> **Agua OFF por default.** Solo mantenimiento es obligatorio.

### Configuracion Base

```
PeriodConfig (vigente ene-jul 2026):
  default_maintenance_amount: 800
  default_water_amount: 200       (solo aplica si water_active = true)
  default_extraordinary_fee_amount: 1000 (solo aplica si extraordinary_fee_active = true)
  payment_due_day: 10
  late_payment_penalty_amount: 100

PeriodConfig (vigente ago-dic 2026):
  default_maintenance_amount: 750  <- cambio aplicado hacia adelante desde agosto
  default_water_amount: 200
  effective_from: 2026-08-01

Periodos 2026:
  Ene-Mar: water_active=false, extraordinary_fee_active=false
  Abr-Sep: water_active=true,  extraordinary_fee_active=false  (admin activa agua en abril)
  Jul:     water_active=true,  extraordinary_fee_active=true   (admin activa cuota extra en julio)
  Oct-Dic: water_active=false, extraordinary_fee_active=false  (admin suspende agua en octubre)
```

---

### Caso 1: Pago adelantado de un ano con cambio de tarifa (solo mantenimiento)

**Escenario:** Casa #15 paga $9,600 el 5 de enero 2026. Agua esta OFF. Solo se cobra mantenimiento.

**Calculo de lo esperado en el ano:**

| Periodo | Mantenimiento | Agua | Total |
|---------|--------------|------|-------|
| Ene-Mar | 3 x $800 = $2,400 | OFF | $2,400 |
| Abr-Jul | 4 x $800 = $3,200 | 4 x $200 = $800 | $4,000 |
| Ago-Sep | 2 x $750 = $1,500 | 2 x $200 = $400 | $1,900 |
| Oct-Dic | 3 x $750 = $2,250 | OFF | $2,250 |
| **Total ano** | **$9,350** | **$1,200** | **$10,550** |

#### Distribucion del pago de $9,600

```
AllocatePaymentUseCase({house_id:15, amount:9600, period_id: enero_2026})

1. Conceptos enero: solo MAINTENANCE (water_active=false)
   -> MAINTENANCE: expected=800
2. Distribucion:
   -> MAINTENANCE: allocated=800, COMPLETE, remaining=8800
3. credit_balance += 8800

ApplyCreditToPeriodsUseCase (CORREGIDO: aplica a TODOS los conceptos activos):
-> Feb: MAINTENANCE $800, credit=8000
-> Mar: MAINTENANCE $800, credit=7200
-> Abr: MAINTENANCE $800 + WATER $200 = $1000, credit=6200
-> May: MAINTENANCE $800 + WATER $200 = $1000, credit=5200
-> Jun: MAINTENANCE $800 + WATER $200 = $1000, credit=4200
-> Jul: MAINTENANCE $800 + WATER $200 = $1000, credit=3200
   (Jul extraordinary_fee=$1000 se agrega despues, ver nota)
-> Ago: MAINTENANCE $750 + WATER $200 = $950, credit=2250
-> Sep: MAINTENANCE $750 + WATER $200 = $950, credit=1300
-> Oct: MAINTENANCE $750, credit=550
-> Nov: MAINTENANCE $750, credit=-200... PARCIAL: allocated=550
-> credit_balance = 0
```

**Resultado:**

| Estado | Detalle |
|--------|---------|
| Ene-Oct 2026 | PAGADO completamente (mantenimiento + agua donde aplica) |
| Nov 2026 | PARCIAL: $550/$750 de mantenimiento pagado, $200 pendiente |
| Dic 2026 | SIN PAGAR: $750 mantenimiento pendiente |
| Jul extraordinary | SIN PAGAR: $1,000 (activada despues) |
| **credit_balance** | $0 |
| **Pendiente total** | $200 + $750 + $1,000 = $1,950 |

**Nota sobre cuota extraordinaria de julio:** Si el credito se aplica ANTES de que se active la cuota extraordinaria, el cargo de $1,000 queda sin cubrir. Esto es correcto: el credito se distribuyo antes de que ese cargo existiera.

#### house_period_charges (Opcion D)

```sql
-- Enero (solo mantenimiento, agua OFF):
{house_id:15, period_id:1, concept_type:'maintenance', expected_amount:800, source:'period_config'}

-- Abril (agua activada):
{house_id:15, period_id:4, concept_type:'maintenance', expected_amount:800, source:'period_config'}
{house_id:15, period_id:4, concept_type:'water',       expected_amount:200, source:'period_config'}

-- Julio (agua + cuota extra):
{house_id:15, period_id:7, concept_type:'maintenance',       expected_amount:800, source:'period_config'}
{house_id:15, period_id:7, concept_type:'water',             expected_amount:200, source:'period_config'}
{house_id:15, period_id:7, concept_type:'extraordinary_fee', expected_amount:1000, source:'period_config'}

-- Agosto (nueva tarifa):
{house_id:15, period_id:8, concept_type:'maintenance', expected_amount:750, source:'period_config'}
{house_id:15, period_id:8, concept_type:'water',       expected_amount:200, source:'period_config'}

-- Octubre (agua suspendida):
{house_id:15, period_id:10, concept_type:'maintenance', expected_amount:750, source:'period_config'}
```

#### Respuesta GET /houses/15/status consultado el 15 de diciembre 2026

```json
{
  "house_id": 15,
  "status": "morosa",
  "credit_balance": 0,
  "accumulated_cents": 0,
  "unpaid_periods": [
    {
      "display_name": "Julio 2026",
      "expected_total": 2000, "paid_total": 1000, "pending_total": 1000,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 200, "pending_amount": 0},
        {"concept_type": "extraordinary_fee", "expected_amount": 1000, "paid_amount": 0, "pending_amount": 1000}
      ]
    },
    {
      "display_name": "Noviembre 2026",
      "expected_total": 750, "paid_total": 550, "pending_total": 200,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 750, "paid_amount": 550, "pending_amount": 200}
      ]
    },
    {
      "display_name": "Diciembre 2026",
      "expected_total": 750, "paid_total": 0, "pending_total": 750,
      "penalty_amount": 0, "status": "unpaid", "is_overdue": false,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 750, "paid_amount": 0, "pending_amount": 750}
      ]
    }
  ],
  "paid_periods": [
    {"display_name": "Enero 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Febrero 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Marzo 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Abril 2026", "status": "paid", "expected_total": 1000, "paid_total": 1000},
    {"display_name": "Mayo 2026", "status": "paid", "expected_total": 1000, "paid_total": 1000},
    {"display_name": "Junio 2026", "status": "paid", "expected_total": 1000, "paid_total": 1000},
    {"display_name": "Agosto 2026", "status": "paid", "expected_total": 950, "paid_total": 950},
    {"display_name": "Septiembre 2026", "status": "paid", "expected_total": 950, "paid_total": 950},
    {"display_name": "Octubre 2026", "status": "paid", "expected_total": 750, "paid_total": 750}
  ],
  "summary": {
    "total_expected": 10550, "total_paid": 9600,
    "total_pending": 1950, "total_penalties": 200
  },
  "deadline_message": "Casa morosa con 3 periodo(s) sin pagar. Siguiente fecha limite: 2027-01-10"
}
```

---

### Caso 2: Casa morosa paga con retraso (solo mantenimiento activo)

**Escenario:** Casa #22 pago hasta diciembre 2025. No pago ene-feb-mar 2026. Agua OFF (periodos ene-mar). Deposita $2,500 el 15 de marzo.

#### Estado ANTES del pago

```
Enero:  vencido, sin pagos -> penalty $100
Febrero: vencido, sin pagos -> penalty $100
Marzo:   vencido (15 mar > 10 mar), sin pagos -> penalty $100
```

Conceptos por periodo (solo mantenimiento): $800/mes

#### Distribucion del pago de $2,500

```
AllocatePaymentUseCase({house_id:22, amount:2500, period_id: marzo_2026})
-> Conceptos marzo: solo MAINTENANCE(800) (water OFF)
-> MAINTENANCE: allocated=800, COMPLETE, remaining=1700
-> credit_balance = 1700

ApplyCreditToPeriodsUseCase (CORREGIDO):
-> Ene MAINTENANCE: min(1700, 800) = 800, credit=900
-> Feb MAINTENANCE: min(900, 800) = 800, credit=100
-> credit_balance = 100
```

**Distribucion final:**

| Destino | Concepto | Monto | Status |
|---------|----------|-------|--------|
| Marzo | Mantenimiento | $800 | COMPLETE |
| Enero (credito) | Mantenimiento | $800 | COMPLETE |
| Febrero (credito) | Mantenimiento | $800 | COMPLETE |
| credit_balance | — | $100 | Saldo a favor |
| **Total** | | **$2,500** | |

**Resultado:** Los 3 meses de mantenimiento quedan pagados. $100 de saldo a favor. Las 3 penalties ($300) quedan registradas en `cta_penalties` pero no afectan el status de pago del periodo (los conceptos principales estan cubiertos).

#### Respuesta GET /houses/22/status

```json
{
  "house_id": 22,
  "status": "saldo_a_favor",
  "credit_balance": 100,
  "unpaid_periods": [],
  "paid_periods": [
    {
      "display_name": "Enero 2026",
      "expected_total": 800, "paid_total": 800, "pending_total": 0,
      "penalty_amount": 100, "status": "paid",
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0}
      ]
    },
    {
      "display_name": "Febrero 2026",
      "expected_total": 800, "paid_total": 800, "pending_total": 0,
      "penalty_amount": 100, "status": "paid",
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0}
      ]
    },
    {
      "display_name": "Marzo 2026",
      "expected_total": 800, "paid_total": 800, "pending_total": 0,
      "penalty_amount": 100, "status": "paid",
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0}
      ]
    }
  ],
  "summary": {
    "total_expected": 2400, "total_paid": 2500,
    "total_pending": 0, "total_penalties": 300
  },
  "deadline_message": "Saldo a favor disponible. Siguiente fecha limite de pago: 2026-04-10"
}
```

**Nota sobre penalties:** Las penalties ($300) aparecen como informacion pero NO bloquean el status "saldo_a_favor". Esto es una decision de negocio: las penalties se registran para seguimiento administrativo pero los conceptos principales (mantenimiento) estan cubiertos.

**Pregunta abierta:** Deberian las penalties hacer que la casa permanezca como "morosa" aunque los conceptos principales esten pagados? Si la respuesta es si, se necesita incluir penalties en la evaluacion de status. Con Opcion D esto es natural: se agrega un `house_period_charges` con `concept_type:'penalties'`.

---

### Caso 3: Cuota extraordinaria activada en julio + pago adelantado (agua OFF al inicio)

**Escenario:** Casa #8 paga $8,000 en enero 2026. Todo hasta dic-2025 pagado. Agua OFF en ene-mar, ON en abr-sep, cuota extraordinaria ON solo en julio.

**Calculo de cargos esperados hasta septiembre (cuando se consulta status):**

| Periodo | Mantenimiento | Agua | Cuota Extra | Total |
|---------|--------------|------|-------------|-------|
| Ene | $800 | OFF | OFF | $800 |
| Feb | $800 | OFF | OFF | $800 |
| Mar | $800 | OFF | OFF | $800 |
| Abr | $800 | $200 | OFF | $1,000 |
| May | $800 | $200 | OFF | $1,000 |
| Jun | $800 | $200 | OFF | $1,000 |
| Jul | $800 | $200 | $1,000 | $2,000 |
| Ago | $750 | $200 | OFF | $950 |
| Sep | $750 | $200 | OFF | $950 |
| **Total ene-sep** | **$7,100** | **$1,200** | **$1,000** | **$9,300** |

#### Distribucion del pago de $8,000 (con logica CORREGIDA)

```
AllocatePaymentUseCase({house_id:8, amount:8000, period_id: enero_2026})
-> Conceptos enero: solo MAINTENANCE(800)
-> MAINTENANCE: 800, remaining=7200
-> credit_balance = 7200

ApplyCreditToPeriodsUseCase (CORREGIDO: todos los conceptos):
-> Feb: MAINTENANCE $800, credit=6400
-> Mar: MAINTENANCE $800, credit=5600
-> Abr: MAINTENANCE $800 + WATER $200 = $1000, credit=4600
-> May: MAINTENANCE $800 + WATER $200 = $1000, credit=3600
-> Jun: MAINTENANCE $800 + WATER $200 = $1000, credit=2600
-> Jul: MAINTENANCE $800 + WATER $200 + EXTRAORDINARY $1000 = $2000, credit=600
-> Ago: MAINTENANCE $750, credit=-150... PARCIAL: allocated=600, pendiente=$150
-> credit_balance = 0
```

**Resultado con logica corregida:**

| Periodo | Status | Detalle |
|---------|--------|---------|
| Ene-Jul | PAID | Todos los conceptos cubiertos incluyendo agua y cuota extra |
| Ago | PARTIAL | $600/$950 pagado, $350 pendiente ($150 maint + $200 water) |
| Sep | UNPAID | $950 pendiente |
| **credit_balance** | **$0** | |
| **Pendiente total** | **$1,300** | |

#### Respuesta GET /houses/8/status consultado el 15 de septiembre 2026

```json
{
  "house_id": 8,
  "status": "morosa",
  "credit_balance": 0,
  "unpaid_periods": [
    {
      "display_name": "Agosto 2026",
      "expected_total": 950, "paid_total": 600, "pending_total": 350,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 750, "paid_amount": 600, "pending_amount": 150},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 0, "pending_amount": 200}
      ]
    },
    {
      "display_name": "Septiembre 2026",
      "expected_total": 950, "paid_total": 0, "pending_total": 950,
      "penalty_amount": 0, "status": "unpaid", "is_overdue": false,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 750, "paid_amount": 0, "pending_amount": 750},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 0, "pending_amount": 200}
      ]
    }
  ],
  "paid_periods": [
    {"display_name": "Enero 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Febrero 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Marzo 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Abril 2026", "status": "paid", "expected_total": 1000, "paid_total": 1000},
    {"display_name": "Mayo 2026", "status": "paid", "expected_total": 1000, "paid_total": 1000},
    {"display_name": "Junio 2026", "status": "paid", "expected_total": 1000, "paid_total": 1000},
    {"display_name": "Julio 2026", "status": "paid", "expected_total": 2000, "paid_total": 2000}
  ],
  "summary": {
    "total_expected": 9300, "total_paid": 8000,
    "total_pending": 1300, "total_penalties": 100
  }
}
```

**Diferencia clave con analisis anterior:** Con agua OFF en ene-mar, el pago rinde mas porque esos meses solo cuestan $800, no $1,000. La cuota extraordinaria de julio queda cubierta por el credito.

---

### Caso 4: Ciclo completo de agua: activacion, cobro y suspension

**Escenario:** Casa #40 paga $800/mes puntualmente de enero a marzo (solo mantenimiento). En abril se activa agua a $200/mes. La casa sigue pagando $800/mes. En octubre se suspende agua.

#### Resumen por periodo

| Periodo | Cobro total | Pago | Resultado |
|---------|-------------|------|-----------|
| Ene | $800 | $800 | PAID |
| Feb | $800 | $800 | PAID |
| Mar | $800 | $800 | PAID |
| Abr | $1,000 (maint+agua) | $800 | PARTIAL: maint $800 PAID, agua $0 UNPAID ($200 pend) |
| May | $1,000 | $800 | PARTIAL: maint $800 PAID, agua $0 UNPAID ($200 pend) |
| Jun | $1,000 | $800 | PARTIAL: maint $800 PAID, agua $0 UNPAID ($200 pend) |
| Jul | $1,000 | $800 | PARTIAL: maint $800 PAID, agua $0 UNPAID ($200 pend) |
| Ago | $950 (750+200) | $800 | PARTIAL: maint $750 PAID, agua $50/$200 ($150 pend) |
| Sep | $950 | $800 | PARTIAL: maint $750 PAID, agua $50/$200 ($150 pend) |
| Oct | $750 (agua OFF) | $800 | PAID + $50 credit |
| Nov | $750 | $800 | PAID + $50 credit |
| Dic | $750 | $800 | PAID + $50 credit |

**Nota sobre distribucion FIFO:** Cuando la casa paga $800 en abril y el cargo es $1,000 (maint $800 + agua $200), el FIFO distribuye primero a mantenimiento ($800) y queda $0 para agua.

Cuando paga $800 en agosto y el cargo es $950 (maint $750 + agua $200), el FIFO distribuye: mantenimiento $750 COMPLETE, agua $50 PARTIAL ($150 pendiente).

#### house_period_charges para casa #40

```sql
-- Ene-Mar (solo mantenimiento):
{house_id:40, period_id:1, concept_type:'maintenance', expected_amount:800}
{house_id:40, period_id:2, concept_type:'maintenance', expected_amount:800}
{house_id:40, period_id:3, concept_type:'maintenance', expected_amount:800}

-- Abr-Jul (mantenimiento + agua):
{house_id:40, period_id:4, concept_type:'maintenance', expected_amount:800}
{house_id:40, period_id:4, concept_type:'water',       expected_amount:200}

-- Ago-Sep (nueva tarifa + agua):
{house_id:40, period_id:8, concept_type:'maintenance', expected_amount:750}
{house_id:40, period_id:8, concept_type:'water',       expected_amount:200}

-- Oct-Dic (agua suspendida, solo mantenimiento):
{house_id:40, period_id:10, concept_type:'maintenance', expected_amount:750}
```

#### Respuesta GET /houses/40/status consultado el 31 de diciembre 2026

```json
{
  "house_id": 40,
  "status": "morosa",
  "credit_balance": 150,
  "unpaid_periods": [
    {
      "display_name": "Abril 2026",
      "expected_total": 1000, "paid_total": 800, "pending_total": 200,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 0, "pending_amount": 200}
      ]
    },
    {
      "display_name": "Mayo 2026",
      "expected_total": 1000, "paid_total": 800, "pending_total": 200,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 0, "pending_amount": 200}
      ]
    },
    {
      "display_name": "Junio 2026",
      "expected_total": 1000, "paid_total": 800, "pending_total": 200,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 0, "pending_amount": 200}
      ]
    },
    {
      "display_name": "Julio 2026",
      "expected_total": 1000, "paid_total": 800, "pending_total": 200,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 800, "paid_amount": 800, "pending_amount": 0},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 0, "pending_amount": 200}
      ]
    },
    {
      "display_name": "Agosto 2026",
      "expected_total": 950, "paid_total": 800, "pending_total": 150,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 750, "paid_amount": 750, "pending_amount": 0},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 50, "pending_amount": 150}
      ]
    },
    {
      "display_name": "Septiembre 2026",
      "expected_total": 950, "paid_total": 800, "pending_total": 150,
      "penalty_amount": 100, "status": "partial", "is_overdue": true,
      "concepts": [
        {"concept_type": "maintenance", "expected_amount": 750, "paid_amount": 750, "pending_amount": 0},
        {"concept_type": "water", "expected_amount": 200, "paid_amount": 50, "pending_amount": 150}
      ]
    }
  ],
  "paid_periods": [
    {"display_name": "Enero 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Febrero 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Marzo 2026", "status": "paid", "expected_total": 800, "paid_total": 800},
    {"display_name": "Octubre 2026", "status": "paid", "expected_total": 750, "paid_total": 750},
    {"display_name": "Noviembre 2026", "status": "paid", "expected_total": 750, "paid_total": 750},
    {"display_name": "Diciembre 2026", "status": "paid", "expected_total": 750, "paid_total": 750}
  ],
  "summary": {
    "total_expected": 10550, "total_paid": 9600,
    "total_pending": 1100, "total_penalties": 600
  }
}
```

**Insight clave:** La casa pago $9,600 en total ($800x12), que cubre todo el mantenimiento del ano. Pero queda morosa por $1,100 de agua no pagada (abr-sep). El credito de $150 (acumulado de oct-dic) no se aplica automaticamente a los periodos con agua pendiente.

**Con logica CORREGIDA (credito se reaplica al consultar status):** El credito de $150 se aplicaria a la deuda de agua mas antigua (abril: $200 pendiente), dejando $50 pendiente en abril. Pendiente total bajaria a $950.

---

### Caso 5: Override de mantenimiento + pago exacto

**Escenario:** Casa #50 tiene convenio: paga $500/mes de mantenimiento en vez de $800. Agua OFF. Paga $500 en enero.

```sql
-- HousePeriodOverride:
{house_id:50, period_id:1, concept_type:'maintenance', custom_amount:500, reason:'Convenio admin'}

-- house_period_charges resultante:
{house_id:50, period_id:1, concept_type:'maintenance', expected_amount:500, source:'override'}
```

#### Distribucion

```
AllocatePaymentUseCase({house_id:50, amount:500})
-> Conceptos: solo MAINTENANCE (agua OFF)
-> getApplicableAmount(50, 1, MAINTENANCE, 800) -> retorna 500 (override)
-> MAINTENANCE: allocated=500, COMPLETE
-> credit_balance = 0
```

#### Respuesta GET /houses/50/status

```json
{
  "status": "al_dia",
  "current_period": {
    "display_name": "Enero 2026",
    "expected_total": 500, "paid_total": 500, "pending_total": 0,
    "status": "paid",
    "concepts": [
      {"concept_type": "maintenance", "expected_amount": 500, "paid_amount": 500, "pending_amount": 0}
    ]
  }
}
```

---

### Caso 6: Doble pago accidental (con logica CORREGIDA)

**Escenario:** Casa #5 deposita $800 el 3 de enero (conciliado). Por error, deposita otros $800 el 7 de enero. Solo mantenimiento activo.

#### Con AllocatePaymentUseCase CORREGIDO (valida pagos previos)

```
Primer pago:
-> MAINTENANCE: allocated=800, COMPLETE
-> credit_balance = 0

Segundo pago:
-> Verifica: SUM(allocations para enero, maintenance) = 800 >= expected(800)
-> Periodo ya pagado completamente
-> $800 enteros -> credit_balance = 800
-> ApplyCreditToPeriodsUseCase: Feb MAINTENANCE $800 -> credit=0
```

**Resultado:** Enero PAID, Febrero PAID (via credito), credit_balance = $0. Sin duplicados.

---

### Caso 7: Penalties y su efecto en el status

**Escenario:** Casa #12 no pago enero ni febrero. Solo mantenimiento ($800). Consulta status el 15 de marzo. Luego paga $1,700.

**Penalties generadas:** $100 x 3 = $300 (ene, feb, mar)

```
AllocatePaymentUseCase({house_id:12, amount:1700, period_id: marzo_2026})
-> Conceptos marzo: MAINTENANCE(800)
-> MAINTENANCE: 800, remaining=900
-> credit_balance = 900

ApplyCreditToPeriodsUseCase:
-> Ene MAINTENANCE: 800, credit=100
-> Feb MAINTENANCE: min(100, 800) = 100, PARTIAL, credit=0
```

**Resultado:**
- Enero: PAID ($800 mantenimiento via credito)
- Febrero: PARTIAL ($100/$800 mantenimiento)
- Marzo: PAID ($800 mantenimiento)
- Penalties: $300 en cta_penalties (no cubiertas)

**Pregunta de negocio pendiente:** Si penalties se incluyen en Opcion D como `house_period_charges`:

```sql
-- Penalties como charges:
{house_id:12, period_id:1, concept_type:'penalties', expected_amount:100, source:'auto_penalty'}
```

Entonces el FIFO distribuiria:
```
Conceptos marzo: MAINTENANCE(800) + PENALTY(100) = 900
-> MAINTENANCE: 800, remaining=900
-> PENALTY: 100, remaining=800
-> credit_balance = 800
-> Ene: MAINTENANCE $800, credit=0
-> Feb: sin cubrir
```

**Diferencia:** Con penalties en distribucion, la casa cubre las penalties del periodo actual pero le alcanza menos para periodos atrasados. Es una decision de politica: las penalties se priorizan (dentro del periodo) o se dejan para despues?

---

## 13. Mejoras de Logica de Negocio Requeridas

> Correcciones necesarias independientemente de la opcion de modelo de datos elegida.

### Mejora 1: ApplyCreditToPeriodsUseCase — Aplicar a TODOS los conceptos activos

**Archivo:** `apply-credit-to-periods.use-case.ts` (linea 97)

**Estado actual:** Solo aplica credito a MAINTENANCE.

**Correccion:** Para cada periodo sin pagar (ASC cronologico), iterar TODOS los conceptos activos del periodo (leerlos de `house_period_charges` en Opcion D) y distribuir credito FIFO a cada concepto en orden: MAINTENANCE -> WATER -> EXTRAORDINARY_FEE.

**Prioridad:** Alta — sin esto, pagos adelantados no cubren agua ni cuota extraordinaria.

### Mejora 2: Credito debe reaplicarse al crear periodos nuevos

**Estado actual:** `ApplyCreditToPeriodsUseCase` solo se ejecuta en el momento del pago.

**Correccion:** Trigger adicional en:
1. **`EnsurePeriodExistsUseCase`**: Cuando se crea un periodo nuevo, verificar si hay casas con credit_balance > 0 y aplicar credito
2. **`CalculateHouseBalanceStatusUseCase`**: Al consultar status, si `credit_balance > 0` y hay periodos sin pagar, aplicar credito ANTES de calcular status (trigger lazy)

**Prioridad:** Alta — sin esto, casas con credito aparecen como morosas.

### Mejora 3: AllocatePaymentUseCase — Validar pagos previos del periodo

**Archivo:** `allocate-payment.use-case.ts`

**Estado actual:** No verifica si ya existen allocations completas.

**Correccion:** Antes de crear allocations para un concepto:
1. Consultar `SUM(allocated_amount)` de allocations existentes para ese house+period+concept
2. Si `SUM >= expected`, saltar concepto y enviar monto a credit_balance
3. Si `SUM < expected`, solo alocar la diferencia `expected - SUM`

**Prioridad:** Media — previene datos inconsistentes por pagos dobles.

### Mejora 4: Validacion de inmutabilidad — Solo cambios hacia adelante

**Nuevo:** Al crear/modificar PeriodConfig:
- `effective_from` debe ser >= primer dia del mes SIGUIENTE al mes actual
- Rechazar con 400 si se intenta modificar un periodo pasado o en curso

**Nuevo:** Al crear/modificar HousePeriodOverride:
- Solo permitir para periodos futuros (period.start_date > hoy)
- Si el periodo ya tiene `house_period_charges` creados, actualizar el charge correspondiente

**Prioridad:** Media — protege integridad de datos historicos.

### Mejora 5: Definir politica de penalties en distribucion

**Decision pendiente:** Las penalties se incluyen en la distribucion FIFO?

**Opcion A (Recomendada):** Penalties como debit_balance
- Al generar penalty, sumar al `house_balances.debit_balance`
- Al procesar un pago, `AllocatePaymentUseCase` ya reduce debit_balance ANTES de distribuir
- El dinero de penalty se descuenta primero, el resto va a conceptos del periodo

**Opcion B:** Penalties en distribucion FIFO
- Agregar penalties como concepto al final del FIFO (despues de extraordinary_fee)
- Requiere `house_period_charges` con concept_type='penalties'

**Opcion C:** Penalties solo informativas
- Se registran para seguimiento pero no se cobran automaticamente
- El administrador las cobra manualmente

---

## 14. Nuevo Endpoint: Pagos Esperados por Ano

### Requerimiento

Endpoint que permita visualizar el total de pagos esperados por ano para todo el condominio.

### Especificacion

#### `GET /payment-management/expected-payments-summary`

**Query params:**
- `year` (opcional): Filtrar por ano especifico. Si no se envia, retorna todos los anos.
- `house_id` (opcional): Filtrar por casa especifica. Si no se envia, retorna totales globales.

**Guards:** AuthGuard, RoleGuard (ADMIN)

#### Respuesta (global, multiples anos)

```json
{
  "years": [
    {
      "year": 2025,
      "total_expected": 633600,
      "total_paid": 620000,
      "total_pending": 13600,
      "total_penalties": 2500,
      "houses_count": 66,
      "breakdown_by_concept": {
        "maintenance": 633600,
        "water": 0,
        "extraordinary_fee": 0
      }
    },
    {
      "year": 2026,
      "total_expected": 696300,
      "total_paid": 350000,
      "total_pending": 346300,
      "total_penalties": 5000,
      "houses_count": 66,
      "breakdown_by_concept": {
        "maintenance": 612150,
        "water": 79200,
        "extraordinary_fee": 66000
      }
    }
  ]
}
```

#### Respuesta (filtrado por casa y ano)

`GET /payment-management/expected-payments-summary?year=2026&house_id=15`

```json
{
  "house_id": 15,
  "house_number": 15,
  "year": 2026,
  "total_expected": 10550,
  "total_paid": 9600,
  "total_pending": 950,
  "total_penalties": 200,
  "periods": [
    {
      "month": 1, "display_name": "Enero",
      "expected": 800, "paid": 800,
      "concepts": [{"type": "maintenance", "amount": 800}]
    },
    {
      "month": 4, "display_name": "Abril",
      "expected": 1000, "paid": 1000,
      "concepts": [
        {"type": "maintenance", "amount": 800},
        {"type": "water", "amount": 200}
      ]
    },
    {
      "month": 7, "display_name": "Julio",
      "expected": 2000, "paid": 2000,
      "concepts": [
        {"type": "maintenance", "amount": 800},
        {"type": "water", "amount": 200},
        {"type": "extraordinary_fee", "amount": 1000}
      ]
    },
    {
      "month": 8, "display_name": "Agosto",
      "expected": 950, "paid": 600,
      "concepts": [
        {"type": "maintenance", "amount": 750},
        {"type": "water", "amount": 200}
      ]
    }
  ]
}
```

### Implementacion con Opcion D (house_period_charges)

```sql
-- Global por ano:
SELECT
  p.year,
  SUM(hpc.expected_amount) AS total_expected,
  COALESCE(SUM(ra.total_paid), 0) AS total_paid,
  hpc.concept_type
FROM house_period_charges hpc
JOIN periods p ON p.id = hpc.period_id
LEFT JOIN (
  SELECT house_id, period_id, concept_type, SUM(allocated_amount) AS total_paid
  FROM record_allocations
  GROUP BY house_id, period_id, concept_type
) ra ON ra.house_id = hpc.house_id
  AND ra.period_id = hpc.period_id
  AND ra.concept_type = hpc.concept_type
WHERE p.year = :year
GROUP BY p.year, hpc.concept_type;
```

**Ventaja critica de Opcion D:** Este endpoint es una query directa a `house_period_charges`. Sin esta tabla, el calculo requiere iterar 66 casas x 12 periodos x N conceptos y resolver PeriodConfig + HousePeriodOverride al vuelo para cada combinacion.

### Implementacion SIN Opcion D (status quo)

```typescript
// Pseudocodigo — complejidad alta
for (const period of allPeriods) {
  const config = await periodConfigRepo.findActiveForDate(period.start_date);
  for (const house of allHouses) {  // 66 iteraciones
    let expected = 0;
    const maintAmount = await overrideRepo.getApplicableAmount(
      house.id, period.id, 'maintenance', config.default_maintenance_amount
    );
    expected += maintAmount;
    if (period.water_active) {
      const waterAmount = await overrideRepo.getApplicableAmount(
        house.id, period.id, 'water', config.default_water_amount
      );
      expected += waterAmount;
    }
    // ... extraordinary_fee ...
    totalExpected += expected;
  }
}
// 66 casas x 12 periodos x 2-3 queries por concepto = ~2,376 queries
```

Esta diferencia hace que el endpoint sea **practicamente inviable** sin `house_period_charges`.

---

## 15. Tabla Comparativa Final por Escenario

| Caso | Sistema Actual | Opcion D (corregido) | Notas |
|------|---------------|---------------------|-------|
| **1. Pago adelantado + cambio tarifa** | Credito solo a maintenance, no reaplica | Credito a todos los conceptos, reaplica al crear periodo | Resuelto con mejoras 1+2 |
| **2. Casa morosa paga 3 meses (agua OFF)** | Funciona parcialmente | Funciona completamente, $100 credito restante | Agua OFF simplifica el caso |
| **3. Cuota extra + agua ON mid-year** | Credito no cubre agua ni extraordinary | Credito cubre todos los conceptos activos del periodo | Resuelto con mejora 1 |
| **4. Ciclo agua ON/OFF** | Agua siempre activa (incorrecto) | Respeta water_active por periodo | Corregido con reglas de negocio |
| **5. Override por casa** | Funciona via HousePeriodOverride | Idem + campo source documenta origen | Mejora de auditoria |
| **6. Doble pago** | Allocations duplicadas | Valida pagos previos, excedente a credito | Resuelto con mejora 3 |
| **7. Penalties** | No cubiertas por distribucion | Politica definida (debit_balance recomendado) | Requiere decision de negocio |
| **8. Pagos esperados por ano** | Inviable (N^2 queries) | Query directa a house_period_charges | **Ventaja critica de Opcion D** |

---

## 16. Veredicto y Plan de Implementacion Final

### Opcion D confirmada como la implementacion correcta

**Razones reforzadas con reglas de negocio corregidas:**

1. **`house_period_charges` es el snapshot inmutable** de lo que se cobra por periodo — alineado con la regla "solo cambios hacia adelante"
2. **Conceptos condicionales** (agua ON/OFF, cuota extra por periodo) se modelan naturalmente: si el concepto esta activo, existe el charge; si no, no existe
3. **Endpoint de pagos esperados** es trivial con esta tabla (query directa) e inviable sin ella
4. **Penalties integrables** como charge adicional si la politica lo requiere
5. **Campo `source`** documenta el origen (period_config, override, auto_penalty, manual)

### Plan de Implementacion

#### Fase 1: Modelo de Datos (house_period_charges)

**Archivos nuevos:**
- `src/shared/database/migrations/XXXXXXXXX-CreateHousePeriodCharges.ts`
- `src/shared/database/entities/house-period-charge.entity.ts`
- `src/features/payment-management/infrastructure/repositories/house-period-charge.repository.ts`
- `src/features/payment-management/interfaces/house-period-charge.repository.interface.ts`

**Tabla:**
```sql
CREATE TABLE house_period_charges (
  id SERIAL PRIMARY KEY,
  house_id INT NOT NULL REFERENCES houses(id),
  period_id INT NOT NULL REFERENCES periods(id),
  concept_type allocation_concept_type_enum NOT NULL,
  expected_amount FLOAT NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'period_config',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(house_id, period_id, concept_type)
);

CREATE INDEX idx_hpc_house_period ON house_period_charges(house_id, period_id);
CREATE INDEX idx_hpc_period ON house_period_charges(period_id);
```

**Valores de `source`:** `'period_config'` | `'override'` | `'auto_penalty'` | `'manual'`

#### Fase 2: Seed de Charges al Crear Periodo

**Archivos modificados:**
- `src/features/payment-management/application/create-period.use-case.ts`
- `src/features/payment-management/application/ensure-period-exists.use-case.ts`

**Logica:**
1. Al crear periodo, obtener PeriodConfig activo
2. Para cada una de las 66 casas:
   a. Crear charge de MAINTENANCE (siempre)
   b. Crear charge de WATER solo si `period.water_active = true`
   c. Crear charge de EXTRAORDINARY_FEE solo si `period.extraordinary_fee_active = true`
3. Para cada charge, resolver monto: `HousePeriodOverride.custom_amount ?? PeriodConfig.default_*_amount`
4. Usar `source = 'override'` si viene de override, `'period_config'` si viene del default

**Optimizacion:** Usar INSERT batch (un solo INSERT con 66-198 rows) en vez de 66 INSERTs individuales.

#### Fase 3: Vincular con AllocatePaymentUseCase

**Archivos modificados:**
- `src/features/payment-management/application/allocate-payment.use-case.ts`

**Cambios:**
1. `preparePaymentConcepts()`: Leer de `house_period_charges` en vez de calcular al vuelo
2. Asignar `concept_id = house_period_charges.id` en cada RecordAllocation
3. Antes de crear allocation, verificar si ya existe pago completo (`SUM(allocated) >= expected`)
4. Excedente va a credit_balance

#### Fase 4: Corregir ApplyCreditToPeriodsUseCase

**Archivos modificados:**
- `src/features/payment-management/application/apply-credit-to-periods.use-case.ts`

**Cambios:**
1. Para cada periodo sin pagar, leer TODOS los charges de `house_period_charges`
2. Distribuir credito FIFO: MAINTENANCE -> WATER -> EXTRAORDINARY_FEE
3. Respetar pagos previos: solo alocar `expected - ya_pagado`

**Trigger adicional:**
- En `CalculateHouseBalanceStatusUseCase`: si `credit_balance > 0` y hay periodos con pending > 0, ejecutar `ApplyCreditToPeriodsUseCase` antes de calcular status

#### Fase 5: Validacion de Inmutabilidad

**Archivos modificados:**
- Controller/service de PeriodConfig (creacion/edicion)
- Controller/service de HousePeriodOverride (creacion/edicion)

**Validaciones:**
- `PeriodConfig.effective_from` >= primer dia del mes siguiente
- `HousePeriodOverride`: solo para periodos futuros (`period.start_date > hoy`)
- Al modificar override de periodo futuro: actualizar `house_period_charges` correspondiente

#### Fase 6: Endpoint de Pagos Esperados por Ano

**Archivos nuevos:**
- Metodo en `payment-management.controller.ts`
- Use case: `get-expected-payments-summary.use-case.ts`
- DTO: `expected-payments-summary.dto.ts`

**Endpoint:** `GET /payment-management/expected-payments-summary?year=2026&house_id=15`

**Query core:**
```sql
SELECT p.year, p.month, hpc.house_id, hpc.concept_type,
       hpc.expected_amount,
       COALESCE(SUM(ra.allocated_amount), 0) AS paid_amount
FROM house_period_charges hpc
JOIN periods p ON p.id = hpc.period_id
LEFT JOIN record_allocations ra
  ON ra.house_id = hpc.house_id
  AND ra.period_id = hpc.period_id
  AND ra.concept_type = hpc.concept_type
WHERE (:year IS NULL OR p.year = :year)
  AND (:house_id IS NULL OR hpc.house_id = :house_id)
GROUP BY p.year, p.month, hpc.house_id, hpc.concept_type, hpc.expected_amount
ORDER BY p.year, p.month, hpc.house_id;
```

#### Fase 7 (Opcional): Penalties como Charges

**Decision pendiente.** Si se decide incluir penalties en distribucion:
- `GeneratePenaltyUseCase`: ademas de crear en `cta_penalties`, crear en `house_period_charges` con `source='auto_penalty'`
- Agregar PENALTIES al final del FIFO en `AllocatePaymentUseCase`

**Alternativa recomendada:** Penalties como `debit_balance` (se descuentan antes de distribuir).
