# Payment Management Feature

Sistema de gestión de períodos de facturación, configuración de pagos y distribución de montos con soporte para pagos personalizados y acumulación de centavos.

## Overview

Este módulo gestiona todo el ciclo de vida de los períodos de facturación, incluyendo:
- Creación automática de períodos durante conciliación bancaria
- Configuración versionada de montos default y reglas de pago
- Montos personalizados por casa (convenios de pago)
- Distribución detallada de pagos entre conceptos
- Balance financiero y acumulación de centavos

**Ubicación en código**: `src/features/payment-management/`

## Architecture

Este feature implementa **Clean Architecture** con separación clara de capas:

```
payment-management/
├── domain/                      # Entidades de dominio y Value Objects
│   ├── period.entity.ts         # Entidad de período
│   ├── period-config.entity.ts  # Configuración de período
│   ├── house-balance.value-object.ts     # Balance financiero
│   └── payment-allocation.value-object.ts # Distribución de pagos
│
├── application/                 # Casos de uso (lógica de aplicación)
│   ├── create-period.use-case.ts
│   ├── ensure-period-exists.use-case.ts  # Creación automática
│   ├── get-periods.use-case.ts
│   └── create-period-config.use-case.ts
│
├── infrastructure/              # Repositorios e implementación
│   └── repositories/
│       ├── period.repository.ts
│       └── period-config.repository.ts
│
├── interfaces/                  # Contratos de repositorios
│   ├── period.repository.interface.ts
│   └── period-config.repository.interface.ts
│
├── dto/                         # Data Transfer Objects
│   ├── create-period.dto.ts
│   ├── create-period-config.dto.ts
│   ├── period-response.dto.ts
│   └── update-period-amounts.dto.ts
│
├── controllers/                 # Controladores HTTP
│   └── payment-management.controller.ts
│
└── payment-management.module.ts
```

### Principios de Clean Architecture

1. **Independencia de frameworks**: La lógica de negocio no depende de NestJS
2. **Testeable**: Los casos de uso pueden probarse sin infraestructura
3. **Independencia de la UI**: Los controllers solo transforman DTOs
4. **Independencia de base de datos**: Los repositorios implementan interfaces

## Database Entities

### Entidades en `src/shared/database/entities`

#### 1. PeriodConfig
Configuración versionada de períodos con vigencia por fechas.

**Ubicación**: `src/shared/database/entities/period-config.entity.ts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | Primary key |
| `default_maintenance_amount` | float | Monto default de mantenimiento (default: 800) |
| `default_water_amount` | float | Monto default de agua (default: 200) |
| `default_extraordinary_fee_amount` | float | Monto default de cuota extraordinaria (default: 1000) |
| `payment_due_day` | int | Día límite de pago del mes (default: 10) |
| `late_payment_penalty_amount` | float | Monto de multa por pago tardío (default: 100) |
| `effective_from` | date | Fecha desde la cual esta configuración es válida |
| `effective_until` | date | Fecha hasta la cual es válida (null = indefinido) |
| `is_active` | boolean | Indica si la configuración está activa |

**Propósito**: Permite cambiar precios y reglas a lo largo del tiempo sin afectar períodos anteriores.

#### 2. HouseBalance
Balance financiero acumulado por casa.

**Ubicación**: `src/shared/database/entities/house-balance.entity.ts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | Primary key |
| `house_id` | int | FK a houses (unique) |
| `accumulated_cents` | float | Centavos acumulados (0.00 - 0.99) |
| `credit_balance` | float | Saldo a favor |
| `debit_balance` | float | Deuda acumulada |

**Propósito**: Gestiona el sistema de centavos acumulados y saldos a favor/deudas.

**TODO**: Definir política de aplicación de centavos acumulados (¿automático?, ¿fin de año?, ¿manual?).

#### 3. HousePeriodOverride
Montos personalizados por casa/período.

**Ubicación**: `src/shared/database/entities/house-period-override.entity.ts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | Primary key |
| `house_id` | int | FK a houses |
| `period_id` | int | FK a periods |
| `concept_type` | string | Tipo de concepto (maintenance, water, etc.) |
| `custom_amount` | float | Monto personalizado |
| `reason` | text | Razón del ajuste (convenio, descuento, etc.) |

**Constraint único**: `(house_id, period_id, concept_type)`

**Propósito**: Permite convenios de pago o montos especiales para casas específicas.

#### 4. RecordAllocation
Distribución detallada de pagos entre conceptos.

**Ubicación**: `src/shared/database/entities/record-allocation.entity.ts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | int | Primary key |
| `record_id` | int | FK a records |
| `house_id` | int | FK a houses |
| `period_id` | int | FK a periods |
| `concept_type` | string | Tipo de concepto |
| `concept_id` | int | ID del concepto (cta_maintenance_id, cta_water_id, etc.) |
| `allocated_amount` | float | Monto aplicado |
| `expected_amount` | float | Monto esperado |
| `payment_status` | string | Estado: complete, partial, overpaid |

**Propósito**: Rastrea con precisión cómo se distribuyó cada pago entre los conceptos.

### Modificaciones a Entidades Existentes

#### Period
**Ubicación**: `src/shared/database/entities/period.entity.ts`

**Cambios**:
- ✅ Añadido: `period_config_id` (FK a PeriodConfig)
- ✅ Cambiado: Constraint único compuesto en `(year, month)` en lugar de únicos individuales

#### Record
**Ubicación**: `src/shared/database/entities/record.entity.ts`

**Cambios**:
- ✅ Añadido: Relación `OneToMany` con `RecordAllocation`
- ⚠️ **NOTA**: Los campos `cta_*_id` se mantienen para compatibilidad con código existente

## API Endpoints

### Períodos

#### GET `/payment-management/periods`
Obtiene todos los períodos registrados.

**Response**:
```json
[
  {
    "id": 1,
    "year": 2025,
    "month": 10,
    "start_date": "2025-10-01",
    "end_date": "2025-10-31",
    "period_config_id": 1,
    "display_name": "Octubre 2025",
    "created_at": "2025-10-28T00:00:00Z",
    "updated_at": "2025-10-28T00:00:00Z"
  }
]
```

#### POST `/payment-management/periods`
Crea un nuevo período manualmente.

**Request Body**:
```json
{
  "year": 2025,
  "month": 11,
  "period_config_id": 1
}
```

**Response**: Objeto PeriodResponseDto

#### POST `/payment-management/periods/ensure`
Asegura que existe un período (crea si no existe). **Usado internamente por conciliación bancaria**.

**Request Body**:
```json
{
  "year": 2025,
  "month": 10
}
```

**Response**: Objeto PeriodResponseDto

**Comportamiento**:
1. Si el período existe, lo retorna
2. Si no existe:
   - Busca configuración activa para esa fecha
   - Crea el período automáticamente
   - Retorna el período creado

### Configuración

#### POST `/payment-management/config`
Crea una nueva configuración de período.

**Request Body**:
```json
{
  "default_maintenance_amount": 800,
  "default_water_amount": 200,
  "default_extraordinary_fee_amount": 1000,
  "payment_due_day": 10,
  "late_payment_penalty_amount": 100,
  "effective_from": "2025-01-01",
  "effective_until": null,
  "is_active": true
}
```

**Response**:
```json
{
  "id": 1,
  "default_maintenance_amount": 800,
  "default_water_amount": 200,
  "default_extraordinary_fee_amount": 1000,
  "payment_due_day": 10,
  "late_payment_penalty_amount": 100,
  "effective_from": "2025-01-01",
  "effective_until": null,
  "is_active": true,
  "created_at": "2025-10-28T00:00:00Z",
  "updated_at": "2025-10-28T00:00:00Z"
}
```

### Endpoints Pendientes

Los siguientes endpoints están definidos en el código pero **NO implementados aún**:

#### PATCH `/payment-management/periods/:id/amounts`
Actualiza montos de un período específico.

#### GET `/payment-management/config/active?date=YYYY-MM-DD`
Obtiene la configuración activa para una fecha específica.

#### PATCH `/payment-management/config/:id`
Actualiza una configuración existente.

## Use Cases

### 1. EnsurePeriodExistsUseCase

**Ubicación**: `src/features/payment-management/application/ensure-period-exists.use-case.ts`

Crea períodos automáticamente durante el flujo de conciliación bancaria.

**Flujo**:
1. Verifica si existe el período para `(year, month)`
2. Si existe, lo retorna
3. Si no existe:
   - Busca configuración activa para esa fecha
   - Crea el período con la configuración encontrada
   - Retorna el período creado

**TODO**: Crear automáticamente registros en `cta_maintenance`, `cta_water`, etc. al crear el período.

**Ejemplo de uso**:
```typescript
const period = await ensurePeriodExistsUseCase.execute(2025, 10);
```

### 2. CreatePeriodUseCase

**Ubicación**: `src/features/payment-management/application/create-period.use-case.ts`

Crea períodos manualmente con validaciones completas.

**Validaciones**:
- El período no debe existir previamente
- La configuración especificada debe existir
- Year y month deben ser válidos

**Ejemplo de uso**:
```typescript
const period = await createPeriodUseCase.execute({
  year: 2025,
  month: 11,
  period_config_id: 1
});
```

### 3. CreatePeriodConfigUseCase

**Ubicación**: `src/features/payment-management/application/create-period-config.use-case.ts`

Crea nueva configuración de montos y reglas de pago.

**Validaciones**:
- Montos deben ser positivos
- `payment_due_day` debe estar entre 1-31
- `effective_from` debe ser una fecha válida

**Ejemplo de uso**:
```typescript
const config = await createPeriodConfigUseCase.execute({
  default_maintenance_amount: 800,
  default_water_amount: 200,
  payment_due_day: 10,
  late_payment_penalty_amount: 100,
  effective_from: new Date('2025-01-01'),
  is_active: true
});
```

### 4. GetPeriodsUseCase

**Ubicación**: `src/features/payment-management/application/get-periods.use-case.ts`

Obtiene todos los períodos registrados con sus configuraciones.

**Ejemplo de uso**:
```typescript
const periods = await getPeriodsUseCase.execute();
```

## Integration with Bank Reconciliation

Este módulo está diseñado para integrarse con el feature de conciliación bancaria.

### Flujo de Integración

```typescript
// En el servicio de conciliación bancaria
import { EnsurePeriodExistsUseCase } from '@/features/payment-management/application';

async reconcilePayment(transactionBank: TransactionBank, voucher: Voucher) {
  const paymentDate = new Date(transactionBank.date);
  const year = paymentDate.getFullYear();
  const month = paymentDate.getMonth() + 1;

  // 1. Asegurar que existe el período
  const period = await this.ensurePeriodExistsUseCase.execute(year, month);

  // 2. Obtener configuración del período
  const config = await this.periodConfigRepository.findById(period.periodConfigId);

  // 3. Aplicar pago (usar RecordAllocation para distribución detallada)
  await this.recordsService.allocatePayment({
    transactionBankId: transactionBank.id,
    houseId: voucher.houseId,
    periodId: period.id,
    concepts: [
      { type: 'maintenance', amount: config.defaultMaintenanceAmount },
      { type: 'water', amount: config.defaultWaterAmount }
    ]
  });
}
```

### Puntos de Integración

1. **Creación automática de períodos**: El endpoint `POST /periods/ensure` debe llamarse desde el flujo de conciliación
2. **Distribución de pagos**: Los pagos deben registrarse en `RecordAllocation` para trazabilidad
3. **Centavos acumulados**: Los centavos deben acumularse en `HouseBalance`

## Business Logic

### Sistema de Centavos Acumulados

**Concepto**: Los centavos de cada pago se acumulan por casa para aplicarlos en el futuro.

**Ejemplo**:
- Casa paga $800.25 → $800 se aplica al período, $0.25 se acumula
- Casa paga $800.50 → $800 se aplica al período, $0.50 se acumula
- Total acumulado: $0.75

**TODO**: Definir política de aplicación:
- ¿Automático al final del año?
- ¿Manual por administrador?
- ¿Se aplica a mantenimiento o a todos los conceptos?

### Montos Personalizados (Convenios)

Permite establecer montos especiales para casas específicas usando `HousePeriodOverride`.

**Casos de uso**:
- Descuentos temporales
- Convenios de pago
- Ajustes por incidencias

**Ejemplo**:
```typescript
// Casa #5 paga solo $500 de mantenimiento en octubre por convenio
{
  house_id: 5,
  period_id: 10, // Octubre 2025
  concept_type: 'maintenance',
  custom_amount: 500,
  reason: 'Convenio de pago por falta de agua'
}
```

### Distribución de Pagos

Cada pago se distribuye entre conceptos y se registra en `RecordAllocation`.

**Estados de pago**:
- `complete`: Monto pagado = Monto esperado
- `partial`: Monto pagado < Monto esperado (pago incompleto)
- `overpaid`: Monto pagado > Monto esperado (excedente va a saldo a favor)

**Ejemplo**:
```typescript
// Casa paga $1000 cuando debía $800 mantenimiento + $200 agua
// RecordAllocation 1:
{
  concept_type: 'maintenance',
  allocated_amount: 800,
  expected_amount: 800,
  payment_status: 'complete'
}

// RecordAllocation 2:
{
  concept_type: 'water',
  allocated_amount: 200,
  expected_amount: 200,
  payment_status: 'complete'
}
```

## Database Migrations

**IMPORTANTE**: Este feature requiere ejecutar migraciones de base de datos.

Ver [MIGRATIONS.md](MIGRATIONS.md) para detalles completos.

### Quick Start

```bash
# 1. Generar migraciones automáticamente
npm run db:generate

# 2. Aplicar migraciones
npm run db:deploy

# 3. Verificar que todo se aplicó correctamente
npm run db:check-schema
```

### Tablas a Crear

1. `period_config` - Configuración de períodos
2. `house_balances` - Balances por casa
3. `house_period_overrides` - Montos personalizados
4. `record_allocations` - Distribución de pagos

### Modificaciones a Tablas Existentes

1. **periods**: Añadir `period_config_id`, cambiar unique constraints
2. **records**: Añadir relación con `record_allocations`

## TODOs & Next Steps

### Alta Prioridad

#### 1. Aplicación de Centavos Acumulados
**Ubicación**: `HouseBalance.accumulated_cents`

**Pendiente definir**:
- ¿Cuándo aplicar? (fin de año, automático, manual)
- ¿A qué conceptos? (solo mantenimiento, todos)
- ¿Requiere aprobación?

**Archivo**: `src/shared/database/entities/house-balance.entity.ts:23-34`

#### 2. Creación Automática de Registros `cta_*`
**Ubicación**: `EnsurePeriodExistsUseCase`

Al crear un período, debe crear automáticamente:
- `cta_maintenance` con monto default
- `cta_water` con monto default
- `cta_extraordinary_fees` si aplica

**Archivo**: `src/features/payment-management/application/ensure-period-exists.use-case.ts`

#### 3. Endpoint para Modificar Montos de Período
**Endpoint**: `PATCH /payment-management/periods/:id/amounts`

Permitir ajustar montos de `cta_maintenance`, `cta_water`, etc. cuando cambien precios.

**Archivo**: `src/features/payment-management/controllers/payment-management.controller.ts:127-129`

#### 4. Cálculo Automático de Penalidades
Usar `PeriodConfig.payment_due_day` para detectar pagos tardíos.

**Lógica**:
- Si pago llega después del día límite → crear registro en `cta_penalties`
- Usar `late_payment_penalty_amount` de la configuración

### Media Prioridad

#### 5. Validación de Pagos Completos/Incompletos
Comparar `RecordAllocation.allocated_amount` vs `expected_amount` para generar reportes.

#### 6. Sistema de Convenios de Pago (CRUD)
CRUD completo para `HousePeriodOverride`:
- Crear convenio
- Listar convenios por casa/período
- Actualizar/eliminar convenio

#### 7. Migración de Datos Existentes
Si ya hay períodos en BD, migrarlos a la nueva estructura:
- Asignar `period_config_id` a períodos existentes
- Crear registros en `record_allocations` para pagos históricos

#### 8. Sistema de Reportes
- Casas con pagos parciales
- Deudas acumuladas
- Proyección de ingresos
- Centavos acumulados por casa

### Baja Prioridad

#### 9. Optimización de Performance
- Índices para consultas frecuentes
- Cache de configuraciones activas
- Paginación en listados

#### 10. Auditoría y Logs
- Registrar cambios en configuraciones
- Logs de aplicación de centavos
- Historial de convenios

## Testing

### Unit Tests Pendientes

Crear tests para:
- [ ] Use cases
- [ ] Domain entities
- [ ] Value Objects
- [ ] Repositories

### Test Coverage Objetivo

- Use cases: 100%
- Domain logic: 100%
- Repositories: 80%
- Controllers: 80%

**Comando**: `npm run test:cov`

## Performance Considerations

### Índices Recomendados

Ya incluidos en las migraciones:
```sql
-- record_allocations
CREATE INDEX idx_record_allocations_record ON record_allocations(record_id);
CREATE INDEX idx_record_allocations_house ON record_allocations(house_id);
CREATE INDEX idx_record_allocations_period ON record_allocations(period_id);
CREATE INDEX idx_record_allocations_status ON record_allocations(payment_status);

-- house_period_overrides
CREATE INDEX idx_house_period_overrides_house ON house_period_overrides(house_id);
CREATE INDEX idx_house_period_overrides_period ON house_period_overrides(period_id);

-- periods
CREATE INDEX idx_periods_year_month ON periods(year, month);
```

### Optimizaciones Futuras

1. **Cache de configuraciones**: Las configuraciones activas rara vez cambian
2. **Paginación**: Para listados de períodos con muchos registros
3. **Batch processing**: Para aplicar centavos acumulados en lote

## Related Documentation

- [Database Schema](../../database/schema.md) - Esquema completo de tablas
- [Bank Reconciliation](../bank-reconciliation/README.md) - Feature de conciliación
- [Vouchers](../vouchers/README.md) - Feature de comprobantes
- [Migrations Guide](MIGRATIONS.md) - Guía detallada de migraciones

## Support

### Common Issues

**Error: "Period already exists"**
- Solución: Usar `POST /periods/ensure` en lugar de `POST /periods`

**Error: "No active configuration found"**
- Solución: Crear configuración con `POST /config`

**Error: "Foreign key constraint violation"**
- Solución: Verificar que las migraciones se aplicaron correctamente

### Documentation

- Ver [MIGRATIONS.md](MIGRATIONS.md) para configuración de base de datos
- Consultar comentarios en el código para lógica específica
- Revisar DTOs para estructura de requests/responses

---

**Mantenido por**: Equipo de Desarrollo Agave
**Última actualización**: Octubre 2025
**Feature implementado en**: Commit `bfd033c` (28 Oct 2025)
