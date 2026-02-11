# Fase 4: Penalidades en Distribución FIFO

## Resumen

La Fase 4 integra penalidades automáticas en el modelo de cargos inmutables (`house_period_charges`). Las penalidades se calculan al crear un período basadas en deuda anterior, y se incluyen automáticamente en la distribución FIFO de pagos.

## Cambios Principales

### 1. CalculatePeriodPenaltiesService (NUEVO)

**Archivo:** `src/features/payment-management/infrastructure/services/calculate-period-penalties.service.ts`

Servicio que calcula automáticamente si una casa tiene penalidades para un nuevo período:

```typescript
calculatePenaltyForHouse(houseId, newPeriodId): Promise<number>
  // Retorna monto de penalidad (0 si no hay deuda)
  // Lógica:
  // 1. Obtener período nuevo
  // 2. Buscar todos los períodos anteriores
  // 3. Para cada período anterior:
  //    - Si expected > paid → hay deuda
  // 4. Si hay deuda en algún período anterior → retornar penalidad
```

**Criterio de deuda:** expected_amount > total_paid en un período

**Características:**
- ✅ Busca en TODOS los períodos anteriores (no solo el inmediato anterior)
- ✅ Retorna 0 si no hay deuda (sin penalidad)
- ✅ Usa config activa para obtener monto de penalidad
- ✅ Idempotente (puede ejecutarse múltiples veces sin duplicar)

### 2. SeedHousePeriodChargesService - Actualización

**Archivo:** `src/features/payment-management/infrastructure/services/seed-house-period-charges.service.ts`

Se integró el cálculo de penalidades en el seed:

```typescript
seedChargesForPeriod(periodId) {
  // 1. Para cada casa:
  //    ├─ Crear cargos de MAINTENANCE/WATER/EXTRAORDINARY_FEE
  //    └─ Calcular y crear cargo de PENALTIES si hay deuda (NUEVO - FASE 4)
  // 2. Batch insert todos los cargos
}
```

**Flujo para cada casa:**
```
├─ MAINTENANCE → siempre
├─ WATER → si water_active=true
├─ EXTRAORDINARY_FEE → si extraordinary_fee_active=true
└─ PENALTIES → si hay deuda en períodos anteriores (NEW)
```

**Fuentes de charges:**
- `'period_config'` - Viene del config default
- `'override'` - Sobrescrito en HousePeriodOverride
- `'auto_penalty'` - Penalidad calculada automáticamente (NEW)

### 3. AllocatePaymentUseCase - Cambio Automático

**No requiere cambios explícitos** porque:

```typescript
preparePaymentConcepts() {
  // Obtiene TODOS los cargos de house_period_charges
  // Si hay penalidades → se incluyen automáticamente
  charges = await chargeRepository.findByHouseAndPeriod(houseId, periodId)
  // charges ahora puede incluir penalidades
  return charges.map(c => ({ type: c.concept_type, expected: c.expected_amount }))
}
```

Las penalidades se distribuyen como un concepto más en el FIFO.

## Flujo de Ejecución

### Crear Período (con Penalidades - Fase 4)

```
CreatePeriodUseCase.execute()
  ↓
1. Crear período
2. Llamar seedChargesService.seedChargesForPeriod()
   ├─ Para cada casa (1-66):
   │  ├─ Crear cargo MAINTENANCE (siempre)
   │  ├─ Crear cargo WATER (si activo)
   │  ├─ Crear cargo EXTRAORDINARY_FEE (si activo)
   │  └─ NUEVO: Calcular penalidad para período anterior
   │     └─ Si hay deuda → crear cargo PENALTIES
   └─ Batch insert todos los cargos
3. Retornar período
```

### Distribuir Pago con Penalidades (Automático)

```
AllocatePaymentUseCase.execute()
  ↓
1. Obtener período
2. Llamar preparePaymentConcepts()
   └─ SELECT FROM house_period_charges (incluye penalidades)
3. Distribuir pago entre conceptos
   ├─ MAINTENANCE: $X
   ├─ WATER: $Y
   ├─ EXTRAORDINARY_FEE: $Z
   └─ PENALTIES: $P (si existe)
4. Crear RecordAllocations
5. Retornar resultado
```

## Lógica de Deuda

Una casa tiene **deuda** en un período si:
```
expected_amount - total_paid > 0
```

Donde:
- `expected_amount` = Sum de expected en record_allocations
- `total_paid` = Sum de allocated_amount en record_allocations

**Búsqueda:** Se revisan TODOS los períodos anteriores (no solo el inmediato anterior)

## Ejemplos

### Ejemplo 1: Casa sin deuda

**Período 1 (2024-01):**
- expected: 2000 (maintenance 800 + water 200 + fee 1000)
- paid: 2000
- deuda: 0

**Período 2 (2024-02) - New:**
- Charges creados:
  - maintenance: 800 (source: period_config)
  - water: 200 (source: period_config)
  - extraordinary_fee: 1000 (source: period_config)
  - **penalties: 0** (sin deuda anterior)

### Ejemplo 2: Casa con deuda anterior

**Período 1 (2024-01):**
- expected: 2000
- paid: 1000
- deuda: 1000 ← Deuda detectada

**Período 2 (2024-02) - New:**
- Charges creados:
  - maintenance: 800 (source: period_config)
  - water: 200 (source: period_config)
  - extraordinary_fee: 1000 (source: period_config)
  - **penalties: 100** (source: auto_penalty) ← Penalidad agregada

**Total esperado en Período 2: 2100** (2000 + 100 de penalidad)

### Ejemplo 3: Distribución FIFO con penalidades

**Casa con penalidad recibe pago de $1500:**

```
Conceptos en order (FIFO):
1. MAINTENANCE: 800
2. WATER: 200
3. EXTRAORDINARY_FEE: 1000
4. PENALTIES: 100

Distribución de $1500:
├─ $800 → MAINTENANCE (completo)
├─ $200 → WATER (completo)
├─ $500 → EXTRAORDINARY_FEE (parcial, le falta 500)
└─ $0 → PENALTIES (no alcanza)

Resultado:
- MAINTENANCE: completo
- WATER: completo
- EXTRAORDINARY_FEE: parcial (500/1000)
- PENALTIES: no pagado
- Remaining: $0
```

## Validaciones

### Compilación

```bash
npm run build
# Debe compilar sin errores
```

### Verificación de Lógica

**Deuda en período anterior detectada:**
```bash
# Verificar que período anterior tiene deuda
SELECT
  h.id, h.number_house,
  SUM(hpc.expected_amount) as total_expected,
  COALESCE(SUM(ra.allocated_amount), 0) as total_paid
FROM houses h
LEFT JOIN house_period_charges hpc ON h.id = hpc.house_id AND hpc.period_id = ?
LEFT JOIN record_allocations ra ON h.id = ra.house_id AND ra.period_id = ?
GROUP BY h.id, h.number_house
HAVING SUM(hpc.expected_amount) > COALESCE(SUM(ra.allocated_amount), 0);
```

**Penalidades creadas automáticamente:**
```bash
# Verificar que se crearon penalidades en nuevo período
SELECT
  concept_type,
  COUNT(*) as count,
  SUM(expected_amount) as total
FROM house_period_charges
WHERE period_id = ? AND concept_type = 'penalties'
GROUP BY concept_type;
```

## Beneficios de Fase 4

| Aspecto | Antes | Después |
|---------|-------|---------|
| Penalidades | Manual (GeneratePenaltyUseCase) | Automáticas en seed |
| Ubicación | cta_penalties (tabla separada) | house_period_charges (integrado) |
| Distribución | No se incluyen en FIFO | Incluidas automáticamente |
| Trazabilidad | Débil (creación tardía) | Fuerte (snapshot al crear período) |
| Garantía | Sin garantía de pago | Inmutable en charges |

## Flujo Completo (Fases 1-4)

```
Crear Período
  ↓
├─ FASE 1: Crear tabla house_period_charges ✓
├─ FASE 2: Seed de charges (M + W + F) ✓
│  └─ Para 66 casas × 3 conceptos = 198 rows
├─ FASE 3: Usar charges en AllocatePaymentUseCase ✓
│  └─ Lookup inmutable de montos esperados
└─ FASE 4: Agregar penalidades en seed (NEW) ✓
   └─ Para cada casa: calcular penalidad si hay deuda
      └─ Total: hasta 66 cargos de penalidad adicionales

Resultado final en house_period_charges:
├─ 198 cargos normales (M + W + F)
└─ ~66 cargos de penalidad (si hay deuda)
   = ~264 cargos totales por período
```

## Próximos Pasos

**Opciones de continuación:**

1. **Fase 5 - Reportes:** Crear reportes detallados de pagos por período
   - Estado de pagos por casa
   - Análisis de deudas y penalidades
   - Historial de cobranza

2. **Fase 5 - Refinamientos:** Mejorar aspectos específicos
   - Penalidades progresivas (aumentan si siguen impagadas)
   - Condonación de penalidades
   - Reversión de cargos

3. **Fase 5 - Integración:** Integrar con otros sistemas
   - Notificaciones de deuda
   - Avisos de vencimiento
   - Reporte a sistemas de cobranza

---

**Status:** ✅ Compilación exitosa, listo para testing
**Fecha:** 2026-02-10
