# Agave Backend - Guía Rápida para Desarrolladores

**Última actualización**: 2026-02-11

Referencia rápida para entender y trabajar con el codebase actual.

---

## En 5 Minutos

### El Sistema hace esto:

1. **Importa transacciones bancarias** (archivos Excel)
2. **Carga comprobantes** de pagos (WhatsApp, Telegram, HTTP)
3. **Reconcilia** transacciones con comprobantes (matching automático)
4. **Distribuye pagos** entre conceptos (FIFO) **← Usa House Period Charges**
5. **Genera reportes** de cobranza y balance

### House Period Charges (Lo Nuevo)

Tabla que congela los montos esperados al crear cada período:

```
CREATE PERIOD (período 1)
  ↓
SEED CHARGES (268 registros)
  ├─ Casa 1: maintenance=$800, water=$200, fee=$1000, penalties=$100
  ├─ Casa 2: maintenance=$800, water=$200, fee=$1000, penalties=$0
  └─ Casa 3-66: ...

DISTRIBUTE PAYMENT (casa 15, $1500)
  ├─ SELECT montos desde house_period_charges (IMMUTABLE)
  ├─ FIFO: $800→maintenance, $200→water, $500→fee
  └─ CREATE record_allocations

GET BALANCE (casa 15)
  ├─ SELECT SUM(expected_amount) from house_period_charges
  ├─ SELECT SUM(allocated_amount) from record_allocations
  └─ RETURN: { expected: 2100, paid: 1500, balance: 600 }
```

---

## Archivos Importantes

### Core Payment Management

| Archivo | Propósito |
|---------|-----------|
| `house-period-charge.entity.ts` | Modelo de datos (Entity) |
| `house-period-charge.repository.ts` | CRUD + queries |
| `seed-house-period-charges.service.ts` | Crear cargos inmutables |
| `house-period-charge-calculator.service.ts` | Cálculos basados en cargos |
| `payment-report-analyzer.service.ts` | Reportes y análisis |
| `allocate-payment.use-case.ts` | Distribuir pagos (MODIFICADO) |
| `get-house-period-balance.use-case.ts` | Consultar balance |

### Configuración

| Archivo | Contenido |
|---------|-----------|
| `payment-management.module.ts` | Registro de repositorios, servicios, use cases |
| `database.module.ts` | Entidades TypeORM |

---

## Consultas SQL Rápidas

### Ver cargos de una casa
```sql
SELECT * FROM house_period_charges
WHERE house_id = 15 AND period_id = 1;
```

### Ver balance de una casa
```sql
SELECT
  SUM(hpc.expected_amount) as expected,
  COALESCE(SUM(ra.allocated_amount), 0) as paid,
  SUM(hpc.expected_amount) - COALESCE(SUM(ra.allocated_amount), 0) as balance
FROM house_period_charges hpc
LEFT JOIN record_allocations ra
  ON hpc.house_id = ra.house_id AND hpc.period_id = ra.period_id AND hpc.concept_type = ra.concept_type
WHERE hpc.house_id = 15 AND hpc.period_id = 1;
```

### Contar cargos por período
```sql
SELECT period_id, COUNT(*) FROM house_period_charges GROUP BY period_id;
```

### Encontrar cargos duplicados (no debería haber)
```sql
SELECT house_id, period_id, concept_type, COUNT(*)
FROM house_period_charges
GROUP BY house_id, period_id, concept_type
HAVING COUNT(*) > 1;
```

---

## Use Cases - Cuándo Usar Cada Uno

| Use Case | Llamar desde | Resultado |
|----------|--------------|-----------|
| `CreatePeriodUseCase` | UI/API | Crea período + seed charges automático |
| `AllocatePaymentUseCase` | BankReconciliationModule | Distribuye pago FIFO usando HPC |
| `GetHousePeriodBalanceUseCase` | UI/API/Reports | Balance de casa en período |
| `GetPeriodReportUseCase` | UI/API | Reporte agregado del período |
| `GetHousePaymentHistoryUseCase` | UI/API | Historial multi-período |
| `ClassifyHousesByPaymentUseCase` | UI/API | Clasificación: buenos pagadores, en riesgo, morosos |
| `AdjustHousePeriodChargeUseCase` | UI/API | Ajustar monto de cargo |
| `ReverseHousePeriodChargeUseCase` | UI/API | Eliminar cargo |
| `CondonePenaltyUseCase` | UI/API | Perdonar penalidad |

---

## Inyectar en Constructor

```typescript
// En un use case nuevo
constructor(
  @Inject('IHousePeriodChargeRepository')
  private readonly chargeRepo: IHousePeriodChargeRepository,

  private readonly chargeCalculator: HousePeriodChargeCalculatorService,

  @Inject('IPeriodRepository')
  private readonly periodRepo: IPeriodRepository,
) {}

// Usar
const charges = await this.chargeRepo.findByHouseAndPeriod(15, 1);
const balance = await this.chargeCalculator.calculateBalance(15, 1);
const period = await this.periodRepo.findById(1);
```

---

## Flujos Comunes

### Crear Período (Automático)
```typescript
await createPeriodUseCase.execute({
  year: 2024,
  month: 2
});
// Resultado: Period creado + house_period_charges seeded (~264 registros)
```

### Distribuir Pago
```typescript
const result = await allocatePaymentUseCase.execute({
  record_id: 123,
  house_id: 15,
  period_id: 1,
  amount_to_distribute: 1500
});
// Resultado: RecordAllocations creados, balance actualizado
```

### Obtener Balance
```typescript
const balance = await getHousePeriodBalanceUseCase.execute(15, 1);
// Result: { totalExpected, totalPaid, balance, details }
```

### Ajustar Cargo
```typescript
const result = await adjustUseCase.execute(chargeId, 900);
// Validaciones: período < 3 meses, monto diferente, sin pagos parciales
```

### Condonar Penalidad
```typescript
const result = await condonePenaltyUseCase.execute(15, 1);
// Elimina penalidad si existe y no está pagada
```

---

## Validaciones Clave

### Período Reciente
```typescript
// No permite editar si período > 3 meses atrás
// Protege datos históricos
```

### Sin Pagos Parciales
```typescript
// No permite reducir cargo por debajo de lo pagado
// Previene inconsistencias
```

### Solo Penalidades Condonables
```typescript
// CondonePenaltyUseCase solo funciona con concept_type='penalties'
// Error si intentas condonar otros conceptos
```

---

## Testing - Mocks Necesarios

```typescript
// Mock del repositorio
const mockChargeRepository = {
  findByHouseAndPeriod: jest.fn().mockResolvedValue([
    { concept_type: 'maintenance', expected_amount: 800 },
    { concept_type: 'water', expected_amount: 200 }
  ]),
  getTotalExpectedByHousePeriod: jest.fn().mockResolvedValue(1000)
};

// Mock del servicio
const mockCalculator = {
  calculateBalance: jest.fn().mockResolvedValue(600),
  getTotalExpectedByHousePeriod: jest.fn().mockResolvedValue(2100)
};

// Inyectar en test
const useCase = new GetHousePeriodBalanceUseCase(
  mockCalculator,
  mockPeriodRepository
);
```

---

## Debugging Rápido

### "El balance es incorrecto"
1. Verifica: `SELECT SUM(expected_amount) FROM house_period_charges WHERE house_id=15 AND period_id=1`
2. Verifica: `SELECT SUM(allocated_amount) FROM record_allocations WHERE house_id=15 AND period_id=1`
3. Balance debe ser exactamente: expected - paid

### "No se puede asignar pago"
1. Verifica período existe: `SELECT * FROM periods WHERE id=1`
2. Verifica cargos existen: `SELECT COUNT(*) FROM house_period_charges WHERE period_id=1` (debe ser ~264)
3. Verifica sin duplicados: `SELECT COUNT(DISTINCT (house_id, period_id, concept_type)) FROM house_period_charges WHERE period_id=1` (debe ser 264)

### "Ajuste no funciona"
1. Verifica período reciente: `SELECT (NOW() - created_at) FROM periods WHERE id=1` (debe ser < 3 meses)
2. Verifica sin pagos: `SELECT * FROM record_allocations WHERE house_id=X AND period_id=Y AND concept_type=Z` (debe ser vacío o parcial)
3. Verifica monto diferente: `SELECT expected_amount FROM house_period_charges WHERE id=CHARGE_ID` (debe ser diferente al nuevo)

---

## Endpoints (TODO - No están expuestos aún)

Estos use cases existen pero falta exponerlos en `PaymentManagementController`:

```
TODO: Implementar estos endpoints

GET  /api/payment-management/periods/:periodId/report
     → GetPeriodReportUseCase.execute(periodId)

GET  /api/payment-management/houses/:houseId/periods/:periodId/balance
     → GetHousePeriodBalanceUseCase.execute(houseId, periodId)

GET  /api/payment-management/houses/:houseId/history?months=12
     → GetHousePaymentHistoryUseCase.execute(houseId, 12)

GET  /api/payment-management/periods/:periodId/classification
     → ClassifyHousesByPaymentUseCase.execute(periodId)

PATCH /api/payment-management/charges/:chargeId
      { newAmount: 900 }
      → AdjustHousePeriodChargeUseCase.execute(chargeId, 900)

DELETE /api/payment-management/charges/:chargeId
       → ReverseHousePeriodChargeUseCase.execute(chargeId)

POST /api/payment-management/houses/:houseId/periods/:periodId/condone-penalty
     → CondonePenaltyUseCase.execute(houseId, periodId)
```

---

## Documentación Completa

| Documento | Propósito |
|-----------|-----------|
| `ARCHITECTURE_OVERVIEW.md` | Visión general del sistema |
| `CURRENT_STATE.md` | Estado actual del Payment Management |
| `HOUSE_PERIOD_CHARGES.md` | Detalles técnicos de HPC |
| `PENDING_FEATURES.md` | Features completados y pendientes |
| `QUICK_REFERENCE.md` | Este archivo |

---

## Checklist para PR

- [ ] Compilación limpia (`npm run build`)
- [ ] Validaciones de negocio respetadas
- [ ] No hay queries directas (usar repositories)
- [ ] Tests unitarios incluidos
- [ ] Documentación actualizada
- [ ] Importaciones correctas (usar paths aliases)

---

## Accesos Rápidos

**Módulo principal**:
```
src/features/payment-management/
├── payment-management.module.ts
├── application/          (use cases)
├── infrastructure/       (servicios, repos)
├── interfaces/          (contracts)
└── dto/                 (datos)
```

**Entity y BD**:
```
src/shared/database/
├── entities/house-period-charge.entity.ts
└── migrations/1770000000000-CreateHousePeriodCharges.ts
```

**Tablas**:
```
house_period_charges    (snapshot inmutable)
record_allocations      (asignaciones de pagos)
house_balances          (saldo actual)
periods                 (períodos)
period_config           (configuración de montos)
houses                  (casas)
```

---

**Última actualización**: 2026-02-11
**Mantener fresco mientras se hacen cambios**
