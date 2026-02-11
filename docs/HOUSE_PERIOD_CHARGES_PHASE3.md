# Fase 3: Integración con AllocatePaymentUseCase

## Resumen

La Fase 3 integra la tabla `house_period_charges` (inmutable) en el flujo de distribución de pagos. Reemplaza los cálculos dinámicos de montos esperados por lookups contra el snapshot creado al iniciar el período.

## Cambios Principales

### 1. AllocatePaymentUseCase - Integración Automática

**Archivo:** `src/features/payment-management/application/allocate-payment.use-case.ts`

#### Cambio de lógica:

**ANTES (Cálculo dinámico):**
```typescript
preparePaymentConcepts() {
  // Para cada concepto:
  // 1. Buscar override en HousePeriodOverride
  // 2. Si existe, usar custom_amount
  // 3. Si no, usar default del config
  // Esto es dinámico y puede cambiar
}
```

**AHORA (Lookup inmutable):**
```typescript
preparePaymentConcepts() {
  // 1. Obtener cargos desde house_period_charges (creados al iniciar período)
  // 2. Si no hay cargos (retrocompatibilidad), usar método legacy
  // 3. Retornar montos inmutables
}
```

#### Características:

- ✅ **Lookup en tabla inmutable**: Los montos vienen de `house_period_charges`
- ✅ **Retrocompatibilidad**: Si no hay cargos, cae a método legacy
- ✅ **Sin cambios en API**: El use case mantiene la misma interfaz
- ✅ **Mejor consistencia**: Pagos se comparan contra snapshot del período

### 2. HousePeriodChargeCalculatorService

**Archivo:** `src/features/payment-management/infrastructure/services/house-period-charge-calculator.service.ts`

Servicio centralizado para cálculos relacionados con cargos:

```typescript
// Obtener total esperado (desde house_period_charges)
getTotalExpectedByHousePeriod(houseId, periodId)

// Obtener total pagado (desde record_allocations)
getTotalPaidByHousePeriod(houseId, periodId)

// Calcular balance (esperado - pagado)
calculateBalance(houseId, periodId)

// Obtener detalles por concepto
getPaymentDetails(houseId, periodId)
  // Retorna: [{ conceptType, expected, paid, balance, isPaid }]

// Validar que período tiene cargos
isPeriodFullyCharged(periodId)
```

### 3. GetHousePeriodBalanceUseCase (NUEVO)

**Archivo:** `src/features/payment-management/application/get-house-period-balance.use-case.ts`

Nuevo use case para obtener el estado de pagos de una casa en un período:

```typescript
execute(houseId, periodId) -> {
  houseId,
  periodId,
  totalExpected,        // Desde house_period_charges
  totalPaid,            // Desde record_allocations
  balance,              // expected - paid
  isPaid,               // balance <= 0
  details: [            // Por cada concepto
    {
      conceptType,
      expectedAmount,
      paidAmount,
      balance,
      isPaid
    }
  ]
}
```

## Flujo de Ejecución

### Distribución de Pagos (AllocatePaymentUseCase)

```
AllocatePaymentUseCase.execute(recordId, houseId, periodId, amount)
  ↓
1. Obtener período
2. Obtener balance actual
3. Obtener config
4. Llamar preparePaymentConcepts()
   ├─ Buscar cargos en house_period_charges (NEW)
   ├─ Si existen: extraer montos inmutables ✓
   └─ Si no existen: fallback a método legacy
5. Distribuir pago usando montos obtenidos
6. Crear RecordAllocations
7. Actualizar balance
8. Retornar resultado
```

### Obtener Balance (GetHousePeriodBalanceUseCase)

```
GetHousePeriodBalanceUseCase.execute(houseId, periodId)
  ↓
1. Validar período existe
2. Validar período tiene cargos (house_period_charges)
3. Obtener total esperado desde calculator
4. Obtener total pagado desde calculator
5. Calcular diferencia
6. Obtener detalles por concepto
7. Retornar resultado
```

## Flujo de Datos

```
Crear Período (Fase 2)
  ↓
SeedHousePeriodChargesService.seedChargesForPeriod()
  → INSERT INTO house_period_charges (66 casas × 3 conceptos = 198 filas)
  → Snapshot inmutable del período creado

Distribuir Pagos (Fase 3)
  ↓
AllocatePaymentUseCase
  → SELECT FROM house_period_charges (lookup montos esperados)
  → Usar montos inmutables para distribuir pago
  → INSERT INTO record_allocations (crear asignación)

Consultar Balance (NUEVO)
  ↓
GetHousePeriodBalanceUseCase
  → SELECT SUM FROM house_period_charges (total esperado)
  → SELECT SUM FROM record_allocations (total pagado)
  → Calcular diferencia
```

## Validación y Testing

### Verificación de Compilación

```bash
npm run build
# Debe compilar sin errores
```

### Test Manual - Flujo Completo

1. **Crear período (Fase 1-2):**
```bash
POST /api/payment-management/periods
{
  "year": 2024,
  "month": 2
}
# Response: { id: 1, ... }
# Side effect: 198 registros creados en house_period_charges
```

2. **Verificar cargos creados:**
```bash
psql -d agave_db -c "SELECT COUNT(*) FROM house_period_charges WHERE period_id = 1"
# Debe retornar: 198 (66 casas × 3 conceptos)
```

3. **Distribuir pago (Fase 3):**
```bash
POST /api/payment-management/allocate
{
  "record_id": 123,
  "house_id": 1,
  "amount_to_distribute": 1000,
  "period_id": 1
}
# Response: { allocations, remaining_amount, ... }
# Los montos esperados vienen de house_period_charges (inmutables)
```

4. **Verificar distribución:**
```bash
psql -d agave_db -c "
  SELECT
    concept_type,
    SUM(allocated_amount) as paid,
    MAX(expected_amount) as expected
  FROM record_allocations
  WHERE house_id = 1 AND period_id = 1
  GROUP BY concept_type
"
```

5. **Obtener balance (NUEVO - Fase 3):**
```bash
GET /api/payment-management/houses/1/periods/1/balance

# Response:
{
  "houseId": 1,
  "periodId": 1,
  "totalExpected": 2800,      # 800 + 200 + 1000
  "totalPaid": 1000,
  "balance": 1800,            # 2800 - 1000
  "isPaid": false,
  "details": [
    {
      "conceptType": "maintenance",
      "expectedAmount": 800,
      "paidAmount": 800,
      "balance": 0,
      "isPaid": true
    },
    {
      "conceptType": "water",
      "expectedAmount": 200,
      "paidAmount": 200,
      "balance": 0,
      "isPaid": true
    },
    {
      "conceptType": "extraordinary_fee",
      "expectedAmount": 1000,
      "paidAmount": 0,
      "balance": 1000,
      "isPaid": false
    }
  ]
}
```

## Casos de Uso Soportados

### ✅ Período nuevo (con cargos Fase 2)
```
Período → house_period_charges (198 filas)
Pago → AllocatePaymentUseCase → lookup house_period_charges
       → Montos garantizados inmutables ✓
```

### ✅ Retrocompatibilidad (período antiguo sin cargos)
```
Período antiguo → NO tiene house_period_charges
Pago → AllocatePaymentUseCase → fallback método legacy
       → Busca HousePeriodOverride + config
       → Sistema sigue funcionando
```

### ✅ Reportes y análisis
```
GetHousePeriodBalanceUseCase → detalles por concepto
HousePeriodChargeCalculatorService → datos para reportes
```

## Beneficios de Fase 3

1. **Inmutabilidad garantizada**: Pagos se comparan contra snapshot del período
2. **Mejor auditabilidad**: Queda registro de qué montos eran esperados en qué momento
3. **Distribución consistente**: FIFO sabe exactamente cuánto paga cada concepto
4. **Base para penalidades**: Las penalidades (Fase 4) pueden usar estos montos como base
5. **Reporting preciso**: Balance period-by-period es exacto y trazable

## Próximos Pasos (Fase 4)

**Integración de penalidades en distribución FIFO**
- Usar `house_period_charges` como base para calcular penalidades
- Agregar penalidades como tipo de concepto
- Ajustar FIFO para incluir penalidades en distribución

---

**Status:** ✅ Compilación exitosa, listo para testing
**Fecha:** 2026-02-10
