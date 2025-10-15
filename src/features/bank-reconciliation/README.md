# Bank Reconciliation Module

Módulo de conciliación bancaria que permite comparar automáticamente vouchers de usuario contra movimientos bancarios reales.

> 📖 **Documentación completa**: [docs/features/bank-reconciliation/README.md](../../../docs/features/bank-reconciliation/README.md)

## Quick Reference

### Architecture - Clean Architecture

```
src/features/bank-reconciliation/
├── application/                          # Application Layer
│   ├── reconcile.use-case.ts            # Use Case: Orchestrate reconciliation
│   └── reconcile.use-case.spec.ts       # Unit tests
├── domain/                               # Domain Layer
│   ├── reconciliation.entity.ts         # Domain entities and value objects
│   ├── reconciliation.entity.spec.ts    # Unit tests
│   └── index.ts
├── infrastructure/                       # Infrastructure Layer
│   ├── matching/
│   │   ├── matching.service.ts          # Matching algorithm
│   │   └── matching.service.spec.ts     # Unit tests
│   └── persistence/
│       ├── reconciliation-data.service.ts          # Data retrieval
│       ├── reconciliation-data.service.spec.ts     # Unit tests
│       └── reconciliation-persistence.service.ts   # Database operations
├── controllers/                          # Presentation Layer
│   └── bank-reconciliation.controller.ts
├── dto/                                  # Data Transfer Objects
│   ├── reconcile-request.dto.ts
│   ├── reconciliation-response.dto.ts
│   └── index.ts
├── interfaces/                           # Type definitions (re-exports from domain)
│   └── reconciliation.interface.ts
├── config/                               # Feature configuration
│   └── reconciliation.config.ts
├── bank-reconciliation.module.ts        # NestJS Module
└── README.md
```

### Clean Architecture Layers

#### 1. Domain Layer (`domain/`)
Entidades de negocio puras, sin dependencias externas:
- `ReconciliationMatch`: Resultado de conciliación exitosa
- `PendingVoucher`: Voucher sin conciliar
- `SurplusTransaction`: Transacción sin voucher
- `ManualValidationCase`: Caso requiere revisión manual
- `ReconciliationSummary`: Resumen de resultados

#### 2. Application Layer (`application/`)
Casos de uso que orquestan la lógica de negocio:
- `ReconcileUseCase`: Ejecuta proceso completo de conciliación

#### 3. Infrastructure Layer (`infrastructure/`)
Implementaciones concretas de servicios:
- **Matching**: `MatchingService` - Algoritmo de coincidencias
- **Persistence**:
  - `ReconciliationDataService` - Obtención de datos
  - `ReconciliationPersistenceService` - Operaciones de BD

#### 4. Presentation Layer (`controllers/`)
Exposición de funcionalidad vía REST API:
- `BankReconciliationController` - Endpoints HTTP

### Dependencies Flow

```
Controllers → Use Cases → Domain ← Infrastructure
                ↓
          Shared Utils
```

**Reglas**:
- Domain NO depende de nada
- Application depende de Domain
- Infrastructure depende de Domain
- Controllers dependen de Application

## Core Features

### 1. Conciliación Automática

**Criterios de matching** (en orden):
1. **Monto exacto** (tolerancia < $0.01)
2. **Fecha/hora** (±36 horas)
3. **Concepto** (TODO - IA)

### 2. Identificación de Casa

Por centavos del monto:
- `$500.15` → Casa #15
- Rango válido: 1-66
- Sin centavos → voucher obligatorio

### 3. Tres Grupos de Resultados

#### ✅ Conciliados
Vouchers que coinciden con movimientos bancarios.

#### ⏳ Pendientes
Vouchers sin coincidencia.

#### 📊 Sobrantes
Movimientos bancarios sin voucher.

### 4. Niveles de Confianza

```typescript
enum ConfidenceLevel {
  HIGH = 'high',       // Monto + fecha + voucher único
  MEDIUM = 'medium',   // Monto exacto, múltiples candidatos
  LOW = 'low',         // Solo por centavos
  MANUAL = 'manual'    // Requiere revisión
}
```

## Shared Utilities

Este módulo utiliza utilities compartidas en `@/shared/common/utils`:

### Date Calculator Utils
```typescript
import {
  getDateDifferenceInHours,
  extractHouseNumberFromCents
} from '@/shared/common/utils';

// Calcular diferencia en horas
const diffHours = getDateDifferenceInHours(
  transaction.date,
  transaction.time,
  voucher.date
);

// Extraer número de casa de centavos
const houseNumber = extractHouseNumberFromCents(500.15); // 15
```

Ubicación: `src/shared/common/utils/date/date-calculator.util.ts`

## API Usage

### Endpoint

```http
POST /bank-reconciliation/reconcile
Content-Type: application/json

{
  "startDate": "2025-01-01",  // Optional
  "endDate": "2025-01-31"     // Optional
}
```

### Response

```typescript
{
  summary: ReconciliationSummary;
  conciliados: ReconciliationMatch[];
  pendientes: PendingVoucher[];
  sobrantes: SurplusTransaction[];
  manualValidationRequired: ManualValidationCase[];
}
```

## Configuration

Ubicación: `config/reconciliation.config.ts`

```typescript
ReconciliationConfig = {
  DATE_TOLERANCE_HOURS: 36,
  TIME_TOLERANCE_MINUTES: 30,
  REQUIRE_VOUCHER_FOR_NO_CENTS: true,
  MAX_HOUSE_NUMBER: 66,
  AUTO_MATCH_SIMILARITY_THRESHOLD: 0.95,
  ENABLE_CONCEPT_MATCHING: false,  // TODO
}
```

## Business Rules

1. **Solo depósitos pendientes**: `confirmation_status = FALSE && is_deposit = TRUE`
2. **Vouchers no conciliados**: `confirmation_status = FALSE`
3. **Identificación obligatoria**: Sin centavos → voucher requerido
4. **Reutilización de records**: Si voucher tiene record, usarlo
5. **Ignorar conciliados**: `confirmation_status = TRUE` no se procesan

## Testing

```bash
# Unit tests
npm run test -- bank-reconciliation

# Specific test suites
npm test -- reconciliation.entity.spec.ts        # Domain entities (15 tests)
npm test -- matching.service.spec.ts             # Matching algorithm (15 tests)
npm test -- reconcile.use-case.spec.ts           # Use case (9 tests)
npm test -- reconciliation-data.service.spec.ts  # Data service (12 tests)
npm test -- date-calculator.util.spec.ts         # Shared utils (34 tests)

# E2E tests (TODO)
npm run test:e2e -- bank-reconciliation
```

**Test Coverage**: 85+ tests across 5 test files
- ✅ Domain entities
- ✅ Infrastructure services
- ✅ Use case orchestration
- ✅ Shared utilities
- ⏳ E2E tests (pendiente)

## TODOs - Future Enhancements

### 1. Validación por Concepto con IA
**Archivo**: `infrastructure/matching/matching.service.ts`

Usar servicios de IA para analizar concepto de transacción.

### 2. Eliminación de Archivos del Bucket
**Archivo**: `infrastructure/persistence/reconciliation-persistence.service.ts:82`

Cuando se concilia, eliminar archivo de Cloud Storage.

### 3. Endpoints de Validación Manual
Crear endpoints para:
- Ver casos pendientes de validación
- Aprobar/rechazar conciliaciones
- Asociar manualmente

### 4. Tabla de Auditoría
Crear `BankReconciliationLog` para histórico.

## Related Documentation

- **[📚 Documentación Completa](../../../docs/features/bank-reconciliation/README.md)** - Documentación detallada con diagramas, ejemplos y troubleshooting
- [Feature Documentation Index](../../../docs/features/)
- [Database Schema](../../../docs/database/schema.md)
- [Shared Utils](../../shared/common/utils/README.md)

---

**Version**: 1.0.0
**Architecture**: Clean Architecture
**Last Updated**: Octubre 2025
