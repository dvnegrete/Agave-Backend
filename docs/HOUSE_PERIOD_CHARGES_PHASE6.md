# Fase 6: Ajustes y Reversiones de Cargos

## Resumen

La Fase 6 agrega capacidad para ajustar (modificar) y reversionar (eliminar) cargos de casas-períodos. Permite:
- Aumentar o disminuir un cargo individual
- Eliminar un cargo si fue creado erróneamente
- Condonar penalidades (decisión gerencial)

**Nota:** Esta fase NO incluye tabla de auditoría ni exportación de datos. Solo proporciona operaciones de ajuste.

## Archivos Creados

### 1. ChargeAdjustmentValidatorService

**Archivo:** `src/features/payment-management/infrastructure/services/charge-adjustment-validator.service.ts`

Servicio de validación para operaciones de ajuste:

```typescript
// Valida si es permitido ajustar un cargo
validateAdjustment(currentAmount, newAmount, periodMonth, periodYear)
  // Valida:
  // - Monto no negativo
  // - Monto diferente al actual
  // - No es período más de 3 meses atrás

// Valida si es permitido reversionar un cargo
validateReversal(chargeAmount, paidAmount, periodMonth, periodYear)
  // Valida:
  // - Período no muy antiguo (< 3 meses)
  // - Sin pagos asignados

// Valida si es permitido condonar penalidad
validatePenaltyCondonation(conceptType, paidAmount)
  // Valida:
  // - Solo penalidades
  // - Sin pagos asignados

// Calcula la diferencia entre montos
calculateAdjustmentDifference(currentAmount, newAmount)
```

**Características:**
- ✅ Reglas de negocio estrictas
- ✅ Validaciones por tipo de operación
- ✅ Límite de 3 meses para editar histórico
- ✅ Prevención de ediciones de datos pagados

### 2. AdjustHousePeriodChargeUseCase

**Archivo:** `src/features/payment-management/application/adjust-house-period-charge.use-case.ts`

Use case para ajustar el monto de un cargo:

```typescript
// Ajustar monto de un cargo
execute(chargeId, newAmount)
  // Retorna: chargeId, diferencia, isPaid, etc.
```

**Validaciones:**
- ✅ Cargo existe
- ✅ Período no muy antiguo
- ✅ Nuevo monto diferente al actual
- ✅ No reduce por debajo de lo pagado

**Retorna:**
```typescript
{
  chargeId: 1,
  houseId: 15,
  periodId: 1,
  conceptType: 'maintenance',
  previousAmount: 800,
  newAmount: 900,
  difference: 100,      // Aumento
  isPaid: false
}
```

### 3. ReverseHousePeriodChargeUseCase

**Archivo:** `src/features/payment-management/application/reverse-house-period-charge.use-case.ts`

Use case para reversionar (eliminar) un cargo:

```typescript
// Reversionar un cargo
execute(chargeId)
  // Retorna: chargeId, removedAmount, mensaje
```

**Validaciones:**
- ✅ Cargo existe
- ✅ Período no muy antiguo
- ✅ Sin pagos asignados (else error)

**Retorna:**
```typescript
{
  chargeId: 1,
  houseId: 15,
  periodId: 1,
  conceptType: 'penalties',
  removedAmount: 100,
  message: "Cargo de $100 (penalties) ha sido reversado exitosamente..."
}
```

**Casos de uso:**
- Se creó un cargo erróneamente
- Se duplicó un cargo en el seed
- Se aplicó un concepto que no debería estar

### 4. CondonePenaltyUseCase

**Archivo:** `src/features/payment-management/application/condone-penalty.use-case.ts`

Use case para condonar penalidades:

```typescript
// Condonar penalidad de una casa en un período
execute(houseId, periodId)
  // Retorna: houseId, periodId, condonedAmount

// Condonar penalidades masivas (opcional)
executeMultiple(periodId, houseIds?)
  // Retorna: detalles de cada condonación
```

**Validaciones:**
- ✅ Cargo de penalidad existe
- ✅ Solo permite condonar penalidades
- ✅ Sin pagos asignados

**Retorna:**
```typescript
// Individual
{
  houseId: 15,
  periodId: 1,
  condonedAmount: 100,
  message: "Penalidad de $100 ha sido condonada para casa 15..."
}

// Múltiple
{
  periodId: 1,
  totalCondonedAmount: 2500,
  condoneCount: 25,
  failureCount: 1,
  details: [
    { houseId: 15, condonedAmount: 100, status: 'success' },
    { houseId: 28, condonedAmount: 0, status: 'failed', reason: '...' }
  ]
}
```

## Flujos de Datos

### Ajustar Cargo

```
AdjustHousePeriodChargeUseCase.execute(chargeId, newAmount)
  ↓
1. IHousePeriodChargeRepository.findById(chargeId)
2. IPeriodRepository.findById(period_id)
3. IRecordAllocationRepository.findByHouseAndPeriod()
   └─ Calcular pagos en este cargo
4. ChargeAdjustmentValidatorService.validateAdjustment()
5. IHousePeriodChargeRepository.update(chargeId, { expected_amount: newAmount })
```

### Reversionar Cargo

```
ReverseHousePeriodChargeUseCase.execute(chargeId)
  ↓
1. IHousePeriodChargeRepository.findById(chargeId)
2. IPeriodRepository.findById(period_id)
3. IRecordAllocationRepository.findByHouseAndPeriod()
   └─ Verificar sin pagos
4. ChargeAdjustmentValidatorService.validateReversal()
5. IHousePeriodChargeRepository.delete(chargeId)
```

### Condonar Penalidad

```
CondonePenaltyUseCase.execute(houseId, periodId)
  ↓
1. IPeriodRepository.findById(periodId)
2. IHousePeriodChargeRepository.findByHouseAndPeriod()
   └─ Buscar cargo tipo PENALTIES
3. IRecordAllocationRepository.findByHouseAndPeriod()
   └─ Verificar sin pagos
4. ChargeAdjustmentValidatorService.validatePenaltyCondonation()
5. IHousePeriodChargeRepository.delete(penaltyCharge.id)
```

## Casos de Uso

### 1. Corregir Error en Config

**Escenario:**
- Se creó período con maintenance = $800
- Pero debería ser $750

**Acción:**
```typescript
const result = await adjustHousePeriodChargeUseCase.execute(chargeId, 750);
// previousAmount: 800
// newAmount: 750
// difference: -50 (disminución)
```

### 2. Eliminar Cargo Duplicado

**Escenario:**
- Se ejecutó seed dos veces
- Hay dos cargos de water para la misma casa

**Acción:**
```typescript
const result = await reverseHousePeriodChargeUseCase.execute(chargeId);
// removed: $200 (second water charge)
```

### 3. Condonar Penalidad a Una Casa

**Escenario:**
- Casa tiene penalidad de $100 por deuda anterior
- Gerencia decide perdonarla por razones sociales

**Acción:**
```typescript
const result = await condonePenaltyUseCase.execute(houseId, periodId);
// condonedAmount: 100
// message: "Penalidad condonada..."
```

### 4. Condonar Penalidades Masivas

**Escenario:**
- Período con 66 casas tiene penalidades
- Gerencia decide condonarlas a todas

**Acción:**
```typescript
const result = await condonePenaltyUseCase.executeMultiple(periodId);
// totalCondonedAmount: 6600
// condoneCount: 66
// failureCount: 0
```

## Límites de Tiempo

**Restricción:** No permite ajustes a períodos más de 3 meses atrás

**Razón:** Evitar cambios a datos históricos que afecten reportes/auditoría

**Ejemplo:**
```
Hoy: 2024-02-15
Límite: 2023-11-15 (3 meses atrás)

✅ Puede ajustar: 2024-02-14, 2024-01-14, 2023-12-14
❌ No puede ajustar: 2023-11-13 (más viejo que 3 meses)
```

## Ejemplos de API

### Ajustar Cargo

```bash
PATCH /api/payment-management/charges/1/adjust
{
  "newAmount": 750
}

Response 200:
{
  "chargeId": 1,
  "houseId": 15,
  "periodId": 1,
  "conceptType": "maintenance",
  "previousAmount": 800,
  "newAmount": 750,
  "difference": -50,
  "isPaid": false
}

Response 400:
{
  "message": "El nuevo monto es igual al actual. No se requiere ajuste"
}

Response 400:
{
  "message": "No se pueden ajustar cargos de períodos anteriores a más de 3 meses atrás."
}
```

### Reversionar Cargo

```bash
DELETE /api/payment-management/charges/2/reverse

Response 200:
{
  "chargeId": 2,
  "houseId": 15,
  "periodId": 1,
  "conceptType": "water",
  "removedAmount": 200,
  "message": "Cargo de $200 (water) ha sido reversado exitosamente..."
}

Response 400:
{
  "message": "No se puede reversionar un cargo que ya tiene pagos asignados..."
}
```

### Condonar Penalidad

```bash
POST /api/payment-management/houses/15/periods/1/condone-penalty

Response 200:
{
  "houseId": 15,
  "periodId": 1,
  "condonedAmount": 100,
  "message": "Penalidad de $100 ha sido condonada..."
}

Response 404:
{
  "message": "No penalty charge found for house 15 in period 1"
}
```

### Condonar Penalidades Masivas

```bash
POST /api/payment-management/periods/1/condone-penalties
{
  "houseIds": [15, 28, 42]  // Opcional, si vacío aplica a todas
}

Response 200:
{
  "periodId": 1,
  "totalCondonedAmount": 250,
  "condoneCount": 3,
  "failureCount": 0,
  "details": [
    {
      "houseId": 15,
      "condonedAmount": 100,
      "status": "success"
    },
    {
      "houseId": 28,
      "condonedAmount": 100,
      "status": "success"
    },
    {
      "houseId": 42,
      "condonedAmount": 50,
      "status": "success"
    }
  ]
}
```

## Validaciones

### Compilación

```bash
npm run build
# ✅ Debe compilar sin errores
```

### Integridad de Datos

- ✅ No modifica período histórico (límite 3 meses)
- ✅ Previene ediciones de datos pagados
- ✅ Validación de tipos (solo penalties para condonación)
- ✅ Manejo de errores completo

## Comparativa: Ajustar vs Reversionar vs Condonar

| Operación | Qué hace | Validaciones | Ejemplo |
|-----------|----------|--------------|---------|
| **Adjust** | Cambia expected_amount | Sin pagos parciales | $800 → $750 |
| **Reverse** | Elimina cargo completamente | Sin pagos en absoluto | Borra cargo water |
| **Condone** | Elimina penalidad | Solo penalties, sin pago | Borra penalidad $100 |

## Diferencias con Fase 4 (Penalidades)

| Aspecto | Fase 4 | Fase 6 |
|---------|--------|--------|
| **Penalidades** | Se crean automáticamente | Se pueden condonar |
| **Cargos** | Se crean al seed | Se pueden ajustar/reversionar |
| **Edición** | NO | SÍ |
| **Auditoría** | Tabla charge_adjustments | NO (sin auditoría) |

## Seguridad

**Restricciones implementadas:**
- ✅ No edita períodos muy antiguos (> 3 meses)
- ✅ No edita cargos ya pagados
- ✅ Solo permite condonar penalidades
- ✅ Validación de montos no negativos

**Lo que NO hace (sin auditoría):**
- ❌ No registra quién hizo el cambio
- ❌ No registra cuándo se hizo
- ❌ No registra por qué se hizo
- ❌ No permite rollback a versión anterior

## Próximas Fases

**Fase 7:** Notificaciones de Deuda
- Alertas cuando se crea penalidad
- Recordatorios de vencimiento
- Avisos de cambios de cargos

---

**Status:** ✅ Compilación exitosa, listo para testing
**Fecha:** 2026-02-11
