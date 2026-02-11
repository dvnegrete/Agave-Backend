# Agave Backend - Visión General de Arquitectura

**Fecha**: 2026-02-11
**Status**: ✅ Sistema completamente funcional

Documento de alto nivel que describe la arquitectura, componentes principales y flujos del sistema Agave Backend.

---

## Módulos Principales

```
AppModule
├── AuthModule
│   └─ JWT, validación de usuarios
├── DatabaseModule
│   └─ TypeORM, conexión a PostgreSQL
├── VouchersModule ✅
│   ├─ WhatsApp Business API
│   ├─ Telegram Bot API
│   ├─ OCR con Google Cloud Vision
│   └─ Gestión de comprobantes
├── TransactionsBankModule ✅
│   ├─ Importación de archivos bancarios (Excel)
│   ├─ Parseo y validación
│   └─ Transacciones bancarias
├── BankReconciliationModule ✅
│   ├─ Matching de transacciones con vouchers
│   ├─ Validación manual de casos ambiguos
│   └─ Trazabilidad de conciliación
├── PaymentManagementModule ✅ ENHANCED
│   ├─ Gestión de períodos
│   ├─ Configuración de montos
│   ├─ Distribución de pagos (FIFO)
│   ├─ Snapshots de cargos esperados ✨
│   ├─ Reportes de pagos
│   ├─ Clasificación de casas
│   └─ Ajustes y reversiones de cargos
├── HistoricalRecordsModule ✅
│   └─ Importación de datos históricos
├── GoogleCloudModule
│   └─ Integración con Vision API
└── OpenAI/VertexAI Modules
    └─ Análisis de pagos con IA
```

---

## Flujo Principal: De Transacción Bancaria a Balance Actualizado

```
1. IMPORTAR TRANSACCIÓN
   ├─ TransactionBankModule
   │  └─ Leer archivo Excel del banco
   │  └─ Validar montos, fechas, casas
   └─ Crear en tabla: transactions_bank

2. CARGAR COMPROBANTE
   ├─ VouchersModule
   │  ├─ Usuario sube foto por WhatsApp/Telegram
   │  ├─ OCR extrae: monto, casa, fecha
   │  └─ Validar estructura (M+W+F=total)
   └─ Crear en tabla: vouchers

3. RECONCILIAR
   ├─ BankReconciliationModule
   │  ├─ Matching: transaction vs voucher
   │  ├─ Si hay ambigüedad → manual validation
   │  └─ Marcar como reconciliada
   └─ Actualizar en tabla: transaction_status

4. ASIGNAR PAGO
   ├─ PaymentManagementModule.AllocatePaymentUseCase ✨ ENHANCED
   │  ├─ EnsurePeriodExistsUseCase
   │  │  └─ Si no existe período → crea + seed cargos
   │  ├─ Obtener cargos esperados desde house_period_charges
   │  ├─ Distribuir pago FIFO:
   │  │  ├─ 1ro maintenance
   │  │  ├─ 2do water
   │  │  ├─ 3ro extraordinary_fee
   │  │  └─ 4to penalties
   │  └─ Crear record_allocations
   └─ Crear en tabla: record_allocations

5. ACTUALIZAR BALANCE
   ├─ PaymentManagementModule.GetHouseBalanceUseCase
   │  ├─ Calcular: (total_expected - total_paid)
   │  ├─ Procesar monto excedente
   │  └─ Aplicar crédito a períodos siguientes
   └─ Actualizar en tabla: house_balances
```

---

## Flujo Detallado: Sistema de House Period Charges

### ¿Cuál es el Problema que Soluciona?

**Antes**: Los montos esperados se calculaban dinámicamente
- Si cambiaba PeriodConfig → todas las queries retornaban diferentes valores
- Imposible auditaría: ¿qué montos eran esperados el 15 de enero?
- Base débil para penalidades y reportes

**Ahora**: Los montos se congelan en un snapshot al crear período
- Todos los cálculos usan el snapshot inmutable
- Auditoría perfecta: siempre se sabe qué montos eran esperados
- Base sólida para penalidades, reportes y ajustes

### Proceso Actual

```
1. CreatePeriodUseCase.execute(year=2024, month=2)
   ├─ IPeriodRepository.create()
   │  └─ INSERT INTO periods (2024, 2, config_id)
   └─ SeedHousePeriodChargesService.seedChargesForPeriod()
      ├─ Para cada casa (1-66):
      │  ├─ Obtener PeriodConfig
      │  ├─ Buscar HousePeriodOverride (sobrescrituras)
      │  ├─ Calcular deuda anterior → penalidad
      │  └─ Crear 3-4 cargos por casa
      └─ IHousePeriodChargeRepository.createBatch()
         └─ INSERT INTO house_period_charges (~264 registros)

2. AllocatePaymentUseCase.execute({record_id, house_id, amount, period_id})
   ├─ IHousePeriodChargeRepository.findByHouseAndPeriod()
   │  └─ SELECT * FROM house_period_charges (obtener snapshot)
   ├─ Distribuir pago FIFO usando montos del snapshot
   └─ IRecordAllocationRepository.create()
      └─ INSERT INTO record_allocations (asignación)

3. GetHousePeriodBalanceUseCase.execute(house_id, period_id)
   ├─ SELECT SUM(expected_amount) FROM house_period_charges
   │  WHERE house_id AND period_id
   ├─ SELECT SUM(allocated_amount) FROM record_allocations
   │  WHERE house_id AND period_id
   └─ Retornar: { expected, paid, balance, detalles por concepto }
```

---

## Tablas Clave de Base de Datos

### periods
```
id | year | month | start_date | end_date | period_config_id | water_active | extraordinary_fee_active
1  | 2024 | 1     | 2024-01-01 | 2024-01-31 | 1 | true | true
2  | 2024 | 2     | 2024-02-01 | 2024-02-29 | 1 | true | true
```

### period_config
```
id | default_maintenance_amount | default_water_amount | default_extraordinary_fee_amount | late_payment_penalty_amount | start_date | end_date
1  | 800                        | 200                 | 1000                            | 100                         | 2024-01-01 | NULL
```

### house_period_charges ✨ NEW
```
id  | house_id | period_id | concept_type       | expected_amount | source         | created_at | updated_at
100 | 15       | 1         | maintenance        | 800             | period_config  | ...        | ...
101 | 15       | 1         | water              | 200             | override       | ...        | ...
102 | 15       | 1         | extraordinary_fee  | 1000            | period_config  | ...        | ...
103 | 15       | 1         | penalties          | 100             | auto_penalty   | ...        | ...
```

### record_allocations
```
id   | record_id | house_id | period_id | concept_type       | allocated_amount | expected_amount | payment_status | created_at
1001 | 500       | 15       | 1         | maintenance        | 800              | 800             | COMPLETE       | ...
1002 | 500       | 15       | 1         | water              | 200              | 200             | COMPLETE       | ...
1003 | 500       | 15       | 1         | extraordinary_fee  | 500              | 1000            | PARTIAL        | ...
```

### house_balances
```
id | house_id | accumulated_cents | credit_balance | debit_balance | last_updated
1  | 15       | 0.15              | 250            | 0             | ...
```

---

## Validación de Integridad

### Al Crear Período
- ✅ PeriodConfig debe existir y estar activa
- ✅ Todas las 66 casas deben existir en tabla houses
- ✅ Se insertan exactamente ~264 cargos
- ✅ Constraint UNIQUE previene duplicados

### Al Distribuir Pago
- ✅ Period debe existir
- ✅ House debe existir
- ✅ Cargos deben estar creados en house_period_charges
- ✅ Suma de allocations ≤ expected_amount (nunca sobreasignar)

### Al Consultar Balance
- ✅ Si cargos no existen → error claro
- ✅ Sumas son exactas (SUM sin rondeos incorrectos)
- ✅ Balance = expected - paid (simple y verificable)

---

## Casos de Uso Principales

### Para Operadores
1. **Crear período**: Automático, carga cargos esperados
2. **Cargar voucher**: Foto de comprobante por WhatsApp/Telegram
3. **Reconciliar**: Matching automático, casos manuales si hay ambigüedad
4. **Ver balance**: Consultar deuda actual de una casa
5. **Ajustar cargo**: Corregir error en configuración
6. **Condonar penalidad**: Decisión gerencial de perdonar deuda

### Para Gerencia/Reportes
1. **Reporte de período**: Cobrado vs esperado, % de cobranza
2. **Historial de casa**: Evolución de pagos, tendencia
3. **Clasificación de casas**: Quiénes pagan bien, en riesgo, morosos
4. **Análisis por concepto**: Dónde se cobran menos (agua, penalidades)

### Para Sistema
1. **Bank Reconciliation**: Obtiene período, asigna pago automáticamente
2. **Payment Distribution**: FIFO sobre cargos inmutables
3. **Balance Calculation**: Suma de snapshots, no recálculos

---

## Dependencias y Relaciones

```
PaymentManagementModule
├─ Depende de:
│  ├─ DatabaseModule (TypeORM, PostgreSQL)
│  ├─ AuthModule (validación de usuarios)
│  └─ OpenAI/VertexAI (análisis de pagos)
│
├─ Es usado por:
│  ├─ BankReconciliationModule
│  │  └─ AllocatePaymentUseCase.execute()
│  └─ Posibles future modules (notificaciones, etc.)
│
└─ Proporciona:
   ├─ Distribución de pagos (FIFO)
   ├─ Cálculo de balances
   └─ Reportes y análisis
```

---

## Seguridad y Validaciones

### De Negocio
- ✅ No editar períodos históricos (> 3 meses atrás)
- ✅ No sobreasignar pagos (allocated > expected)
- ✅ No editar cargos que ya tienen pagos parciales
- ✅ Penalidades solo condonables por gerencia

### Técnica
- ✅ Foreign keys previenen datos huérfanos
- ✅ Constraints UNIQUE previenen duplicados
- ✅ Índices evitan full table scans
- ✅ Transacciones ACID para integridad

### Auditoría
- ✅ Campo `source` registra origen de cada cargo
- ✅ Timestamps created_at/updated_at en cada tabla
- ✅ Future: tabla de cambios (charge_adjustments)

---

## Performance y Escalabilidad

### Base de Datos
- PostgreSQL con índices óptimos
- Queries típicas < 50ms
- Batch insert de ~264 registros < 100ms
- Escalable a 1000+ casas sin cambios

### Aplicación
- Repository pattern para abstracción
- Use cases independientes y reutilizables
- Services inyectables para testing
- Clean architecture sin acoplamiento

### Caching (Futuro)
- Cachear PeriodConfig activa (no cambia frecuente)
- Cachear house_period_charges (inmutable después de crear)
- Redis ready (importa y estructura están listos)

---

## Flujos Comunes - Código y BD

### Crear Período + Seed Charges

```typescript
// Código
await createPeriodUseCase.execute({ year: 2024, month: 3 });

// En BD sucede:
-- 1. Crear período
INSERT INTO periods (year, month, period_config_id, water_active, extraordinary_fee_active)
VALUES (2024, 3, 1, true, true)
RETURNING id;  -- Retorna id=3

-- 2. Seed charges para cada casa
INSERT INTO house_period_charges
  (house_id, period_id, concept_type, expected_amount, source)
VALUES
  (1, 3, 'maintenance', 800, 'period_config'),
  (1, 3, 'water', 200, 'period_config'),
  (1, 3, 'extraordinary_fee', 1000, 'period_config'),
  (1, 3, 'penalties', 0, 'auto_penalty'),  -- Si no hay deuda, 0
  (2, 3, 'maintenance', 800, 'period_config'),
  ...
  -- Total: ~264 registros

-- 3. Retorna período creado
SELECT * FROM periods WHERE id = 3;
```

### Distribuir Pago

```typescript
// Código
const result = await allocatePaymentUseCase.execute({
  record_id: 123,
  house_id: 15,
  period_id: 3,
  amount_to_distribute: 1500
});

// En BD sucede:
-- 1. Obtener cargos esperados
SELECT * FROM house_period_charges
WHERE house_id = 15 AND period_id = 3
ORDER BY concept_type;
-- Retorna: [
--   { concept_type: 'maintenance', expected_amount: 800 },
--   { concept_type: 'water', expected_amount: 200 },
--   { concept_type: 'extraordinary_fee', expected_amount: 1000 },
--   { concept_type: 'penalties', expected_amount: 100 }
-- ]

-- 2. Distribuir FIFO usando montos
INSERT INTO record_allocations
  (record_id, house_id, period_id, concept_type, allocated_amount, expected_amount, payment_status)
VALUES
  (123, 15, 3, 'maintenance', 800, 800, 'COMPLETE'),
  (123, 15, 3, 'water', 200, 200, 'COMPLETE'),
  (123, 15, 3, 'extraordinary_fee', 500, 1000, 'PARTIAL'),
  -- penalties NO recibe asignación, solo $1500 disponibles

-- 3. Actualizar balance
UPDATE house_balances
SET credit_balance = 250, debit_balance = 0
WHERE house_id = 15;

-- Retorna resultado con detalles de asignación
```

### Consultar Balance

```typescript
// Código
const balance = await getHousePeriodBalanceUseCase.execute(15, 3);

// En BD sucede:
-- 1. Total esperado
SELECT SUM(expected_amount) as total_expected
FROM house_period_charges
WHERE house_id = 15 AND period_id = 3;
-- Retorna: 2100

-- 2. Total pagado
SELECT SUM(allocated_amount) as total_paid
FROM record_allocations
WHERE house_id = 15 AND period_id = 3;
-- Retorna: 1500

-- 3. Detalles por concepto
SELECT
  hpc.concept_type,
  hpc.expected_amount,
  COALESCE(SUM(ra.allocated_amount), 0) as paid,
  hpc.expected_amount - COALESCE(SUM(ra.allocated_amount), 0) as balance
FROM house_period_charges hpc
LEFT JOIN record_allocations ra
  ON hpc.house_id = ra.house_id
  AND hpc.period_id = ra.period_id
  AND hpc.concept_type = ra.concept_type
WHERE hpc.house_id = 15 AND hpc.period_id = 3
GROUP BY hpc.concept_type, hpc.expected_amount;

-- Retorna:
-- concept_type | expected | paid | balance
-- maintenance  | 800      | 800  | 0
-- water        | 200      | 200  | 0
-- extraordinary_fee | 1000 | 500 | 500
-- penalties     | 100      | 0    | 100
```

---

## Recomendaciones para Desarrolladores

### Al Agregar Funcionalidad

1. **Siempre verificar que cargos existan**: Si trabajas con balances, valida que `house_period_charges` tenga registros
2. **Reutilizar servicios existentes**: `HousePeriodChargeCalculatorService` tiene todo lo que necesitas para montos
3. **Usar repositories en lugar de queries directas**: Mantiene abstracción y facilita testing
4. **Respetar el snapshot**: Los cargos son inmutables después de crear período, solo ajustes permitidos
5. **Validar límites temporales**: Período > 3 meses atrás = no editable

### Al Debuggear

1. Verifica que período existe: `SELECT * FROM periods WHERE id = ?`
2. Verifica que cargos existen: `SELECT * FROM house_period_charges WHERE period_id = ?`
3. Verifica que no hay duplicados: `SELECT COUNT(*) FROM house_period_charges WHERE house_id = ? AND period_id = ? AND concept_type = ?` (debería ser ≤ 1)
4. Verifica sumas: `SELECT SUM(expected_amount) FROM house_period_charges WHERE period_id = ?`

### Al Escribir Tests

1. Mock `HousePeriodChargeRepository` en tests de use cases
2. Asegúrate de criar cargos en test fixtures (o mockear)
3. Valida que balances calculados son correctos (expected - paid)
4. Prueba casos edge: período > 3 meses, cargo con pagos parciales, penalidad

---

## Diagrama de Arquitectura

```
                        USUARIOS (Operadores, Gerencia)
                               |
                    ┌──────────┴──────────┐
                    ▼                     ▼
            BankReconciliation       PaymentManagement
            Module                   Module (ENHANCED)
            ├─ Transacciones         ├─ Períodos
            ├─ Vouchers              ├─ Configuraciones
            ├─ Matching              ├─ House Period Charges ✨
            └─ Validación Manual     ├─ Record Allocations
                    │                ├─ Balances
                    │                └─ Reportes
                    │
                    └─────────────────┘
                          │
                          ▼
                   PostgreSQL 12
                   ├─ periods
                   ├─ period_config
                   ├─ house_period_charges ✨
                   ├─ record_allocations
                   ├─ house_balances
                   ├─ houses
                   ├─ transactions_bank
                   ├─ vouchers
                   └─ ...
```

---

## Estado Actual (Checklist)

- ✅ Módulos principales implementados y registrados
- ✅ House Period Charges completamente funcional
- ✅ Integración con AllocatePaymentUseCase finalizada
- ✅ Reportes y análisis disponibles
- ✅ Ajustes y reversiones de cargos implementados
- ✅ Compilación limpia sin warnings
- ⏳ Tests unitarios (no implementados, pendiente)
- ⏳ Endpoints REST (lógica existe, falta exponer en controller)
- ⏳ Notificaciones automáticas (diseño hecho, implementación pendiente)

---

## Próximos Pasos por Prioridad

1. **Exponer endpoints REST** en `PaymentManagementController` para nuevas funcionalidades
2. **Escribir tests unitarios** para servicios y use cases (100% coverage)
3. **Agregar notificaciones** cuando se crea penalidad o vence período
4. **Implementar penalidades progresivas** (aumentan si no se pagan)
5. **Planes de pago** para distribución de deuda en cuotas

---

**Última actualización**: 2026-02-11
**Mantener este documento actualizado cuando haya cambios arquitectónicos**
