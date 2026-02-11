# Fase 5: Reportes de Pagos Esperados

## Resumen

La Fase 5 agrega capacidad de reportes analíticos basados en `house_period_charges`. Proporciona:
- Reportes agregados de períodos
- Historial de pagos por casa
- Clasificación de casas según comportamiento de pago
- Análisis de tendencias de deuda

**Nota:** Esta fase NO incluye exportación a CSV/Excel. Solo proporciona datos en JSON para APIs.

## Archivos Creados

### 1. PaymentReportAnalyzerService

**Archivo:** `src/features/payment-management/infrastructure/services/payment-report-analyzer.service.ts`

Servicio centralizado para análisis y reportes:

```typescript
// Obtener reporte agregado de un período
getPeriodReport(periodId): Promise<{
  periodId,
  periodYear,
  periodMonth,
  totalExpected,
  totalPaid,
  totalDebt,
  collectionPercentage,
  conceptBreakdown: [{ concept, expected, paid, debt, percentage }],
  housesWithDebt,
  housesFullyPaid,
  housesPartiallyPaid
}>

// Historial de pagos de una casa (multi-período)
getHousePaymentHistory(houseId, limitMonths=12): Promise<{
  houseId,
  houseNumber,
  periods: [{ periodId, year, month, expected, paid, debt, isPaid, paymentPercentage }],
  totalExpectedAllTime,
  totalPaidAllTime,
  totalDebtAllTime,
  averagePaymentPercentage,
  debtTrend: 'improving' | 'stable' | 'worsening'
}>

// Clasificar casas por comportamiento
classifyHousesByPaymentBehavior(periodId): Promise<{
  goodPayers: [{ houseId, houseNumber, lastPeriods, fullyPaidPercentage }],
  atRisk: [{ houseId, houseNumber, debt, monthsBehind, lastPaymentDate }],
  delinquent: [{ houseId, houseNumber, totalDebt, monthsDelinquent }]
}>
```

**Características:**
- ✅ Agrega datos de `house_period_charges` y `record_allocations`
- ✅ Calcula distribución por concepto (M/W/F/P)
- ✅ Análisis multi-período (tendencias)
- ✅ Clasificación automática de casas
- ✅ Porcentajes de cobranza

### 2. GetPeriodReportUseCase

**Archivo:** `src/features/payment-management/application/get-period-report.use-case.ts`

Use case para obtener reporte de un período:

```typescript
// Reporte de período específico
execute(periodId: number)

// Reporte del período actual (mes/año actual)
executeForCurrentPeriod()
```

**Retorna:**
```typescript
{
  periodId: 1,
  periodYear: 2024,
  periodMonth: 2,
  totalExpected: 132000,      // 66 casas × 2000 por defecto
  totalPaid: 98500,           // Pagos recibidos
  totalDebt: 33500,           // Deuda pendiente
  collectionPercentage: 74.62, // % de cobranza
  conceptBreakdown: [
    {
      concept: 'maintenance',
      expected: 52800,
      paid: 45600,
      debt: 7200,
      percentage: 86.36
    },
    // ... más conceptos
  ],
  housesWithDebt: 32,         // Casas con deuda
  housesFullyPaid: 34,        // Casas sin deuda
  housesPartiallyPaid: 15     // Pagaron algo pero falta más
}
```

### 3. GetHousePaymentHistoryUseCase

**Archivo:** `src/features/payment-management/application/get-house-payment-history.use-case.ts`

Use case para obtener historial de una casa:

```typescript
// Historial con límite de meses personalizado
execute(houseId: number, limitMonths: number = 12)

// Historial de últimos 12 meses
executeLastYear(houseId: number)

// Historial de últimos 6 meses
executeLastSixMonths(houseId: number)
```

**Retorna:**
```typescript
{
  houseId: 1,
  houseNumber: 15,
  periods: [
    {
      periodId: 1,
      year: 2024,
      month: 1,
      expected: 2000,
      paid: 2000,
      debt: 0,
      isPaid: true,
      paymentPercentage: 100
    },
    {
      periodId: 2,
      year: 2024,
      month: 2,
      expected: 2100,
      paid: 1500,
      debt: 600,
      isPaid: false,
      paymentPercentage: 71.43
    },
    // ... más períodos
  ],
  totalExpectedAllTime: 12600,
  totalPaidAllTime: 10500,
  totalDebtAllTime: 2100,
  averagePaymentPercentage: 83.33,
  debtTrend: 'worsening' // Se empeora con el tiempo
}
```

### 4. ClassifyHousesByPaymentUseCase

**Archivo:** `src/features/payment-management/application/classify-houses-by-payment.use-case.ts`

Use case para clasificar casas por comportamiento:

```typescript
// Clasificación completa
execute(periodId: number)

// Clasificación del período actual
executeForCurrentPeriod()

// Solo casas en riesgo (acción inmediata)
executeGetAtRiskOnly(periodId: number)

// Solo casas morosas (escalación)
executeGetDelinquentOnly(periodId: number)
```

**Retorna:**
```typescript
{
  goodPayers: [
    {
      houseId: 15,
      houseNumber: 15,
      lastPeriods: 6,
      fullyPaidPercentage: 100  // Pagó todo en últimos 6 meses
    },
    // ... más casas confiables
  ],

  atRisk: [
    {
      houseId: 28,
      houseNumber: 28,
      debt: 1500,
      monthsBehind: 2,
      lastPaymentDate: 2024-01-15
    },
    // ... casas con alerta
  ],

  delinquent: [
    {
      houseId: 42,
      houseNumber: 42,
      totalDebt: 8500,
      monthsDelinquent: 4  // 4 meses sin pagar
    },
    // ... casas críticas
  ]
}
```

## Flujos de Datos

### Reporte de Período

```
GetPeriodReportUseCase.execute(periodId)
  ↓
IPeriodRepository.findById(periodId)
  ↓
PaymentReportAnalyzerService.getPeriodReport()
  ├─ IHousePeriodChargeRepository.findByPeriod()
  │  └─ SUM(expected_amount) por concepto
  ├─ IRecordAllocationRepository.findByPeriodId()
  │  └─ SUM(allocated_amount) por concepto
  └─ HouseRepository.findAll() para contar casas
```

### Historial de Casa

```
GetHousePaymentHistoryUseCase.execute(houseId, limitMonths)
  ↓
HouseRepository.findById(houseId)
  ↓
IPeriodRepository.findAll()
  ├─ Filtrar últimos X períodos
  └─ Para cada período:
     ├─ IHousePeriodChargeRepository.findByHouseAndPeriod()
     └─ IRecordAllocationRepository.findByHouseAndPeriod()
```

### Clasificación de Casas

```
ClassifyHousesByPaymentUseCase.execute(periodId)
  ↓
PaymentReportAnalyzerService.classifyHousesByPaymentBehavior()
  ├─ HouseRepository.findAll()
  └─ Para cada casa, últimos 6 períodos:
     ├─ Contar pagos completos
     ├─ Contar deuda acumulada
     └─ Clasificar: good / at-risk / delinquent
```

## Casos de Uso

### 1. Dashboard de Periodo

```typescript
// Obtener estado de cobro del mes actual
const report = await getPeriodReportUseCase.executeForCurrentPeriod();

// Mostrar:
// - Total esperado vs pagado (progreso bar)
// - % de cobranza (74.62%)
// - Desglose por concepto (M/W/F)
// - Casas con deuda: 32
```

### 2. Seguimiento Individual de Casa

```typescript
// Historial de pagos de casa #15
const history = await getHousePaymentHistoryUseCase.executeLastYear(15);

// Mostrar:
// - Gráfico de línea: deuda por mes
// - Tabla: esperado vs pagado
// - Tendencia: mejorando / estable / empeorando
```

### 3. Gestión de Cobranza

```typescript
// Identificar casas problemáticas
const classification = await classifyHousesByPaymentUseCase.executeForCurrentPeriod();

// Acciones:
// - At Risk (15): Enviar recordatorio
// - Delinquent (8): Escalar a cobranza
// - Good Payers (43): Registrar en sistema de confianza
```

### 4. Análisis por Concepto

```typescript
const report = await getPeriodReportUseCase.execute(periodId);

// Analizar:
// - Maintenance: 86.36% cobrado (muy bien)
// - Water: 45% cobrado (crítico)
// - Extraordinary Fee: 60% cobrado (alerta)
// - Penalties: 20% cobrado (muy mal)

// Decisión: Priorizar cobro de agua y penalidades
```

## Ejemplos de API

### Reporte de Período

```bash
GET /api/payment-management/reports/periods/1

Response 200:
{
  "periodId": 1,
  "periodYear": 2024,
  "periodMonth": 2,
  "totalExpected": 132000,
  "totalPaid": 98500,
  "totalDebt": 33500,
  "collectionPercentage": 74.62,
  "conceptBreakdown": [...],
  "housesWithDebt": 32,
  "housesFullyPaid": 34,
  "housesPartiallyPaid": 15
}
```

### Reporte Período Actual

```bash
GET /api/payment-management/reports/periods/current

Response 200: (datos del período actual)
```

### Historial de Casa

```bash
GET /api/payment-management/reports/houses/15/history?months=12

Response 200:
{
  "houseId": 15,
  "houseNumber": 15,
  "periods": [...],
  "totalExpectedAllTime": 12600,
  "totalPaidAllTime": 10500,
  "totalDebtAllTime": 2100,
  "averagePaymentPercentage": 83.33,
  "debtTrend": "worsening"
}
```

### Clasificación de Casas

```bash
GET /api/payment-management/reports/periods/1/classification

Response 200:
{
  "goodPayers": [...],
  "atRisk": [...],
  "delinquent": [...]
}
```

### Casas en Riesgo Only

```bash
GET /api/payment-management/reports/periods/1/at-risk

Response 200: [ casas en riesgo ]
```

### Casas Morosas Only

```bash
GET /api/payment-management/reports/periods/1/delinquent

Response 200: [ casas morosas ]
```

## Definiciones

### Deuda Trend

- **Improving:** Deuda en mes actual < 90% de deuda inicial
- **Stable:** Deuda varía entre -10% y +10%
- **Worsening:** Deuda en mes actual > 110% de deuda inicial

### Clasificación

- **Good Payers:** ≥80% de períodos pagados completos en últimos 6 meses
- **At Risk:** 1-2 períodos con deuda, pero con pagos recientes
- **Delinquent:** ≥3 períodos consecutivos sin pagar

## Validaciones

### Compilación

```bash
cd /home/dvnegrete/projects/agave/agave-backend
npm run build
# ✅ Debe compilar sin errores
```

### Integridad de Datos

- ✅ Usa datos inmutables de `house_period_charges` (no recalcula)
- ✅ Integra con `record_allocations` para pagos
- ✅ Soporta múltiples períodos
- ✅ Maneja casas sin datos (retorna 0)

## Próximas Fases

**Fase 6:** Ajustes y Reversiones
- Permitir modificar cargos individuales
- Condonar penalidades
- Auditoría de cambios

---

**Status:** ✅ Compilación exitosa, listo para testing
**Fecha:** 2026-02-11
