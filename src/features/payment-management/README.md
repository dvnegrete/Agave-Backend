# Payment Management Feature

Sistema de gestión de períodos de facturación, configuración de pagos y distribución de montos.

## Arquitectura

Este feature sigue **Clean Architecture** con las siguientes capas:

```
payment-management/
├── domain/              # Entidades de dominio y Value Objects
├── application/         # Casos de uso (lógica de aplicación)
├── infrastructure/      # Repositorios e implementación de persistencia
├── interfaces/          # Contratos de repositorios
├── dto/                 # Data Transfer Objects
├── controllers/         # Controladores HTTP
└── payment-management.module.ts
```

## Entidades de Base de Datos

### Nuevas Entidades (en `src/shared/database/entities`)

1. **PeriodConfig**: Configuración versionada de períodos
   - Montos default para mantenimiento, agua, cuotas extraordinarias
   - Día límite de pago y monto de penalidad
   - Vigencia con `effective_from` y `effective_until`

2. **HouseBalance**: Balance financiero por casa
   - `accumulated_cents`: Centavos acumulados de pagos
   - `credit_balance`: Saldo a favor
   - `debit_balance`: Deuda acumulada

3. **HousePeriodOverride**: Montos personalizados por casa/período
   - Permite convenios de pago o montos especiales
   - Unique constraint: `(house_id, period_id, concept_type)`

4. **RecordAllocation**: Distribución detallada de pagos
   - Conecta `Record` con períodos y conceptos
   - Rastrea `allocated_amount` vs `expected_amount`
   - Status: complete, partial, overpaid

### Modificaciones a Entidades Existentes

1. **Period**:
   - ✅ Añadido: `period_config_id` (FK a PeriodConfig)
   - ✅ Cambiado: Constraint único compuesto en `(year, month)`

2. **Record**:
   - ✅ Añadido: Relación `OneToMany` con `RecordAllocation`
   - ⚠️ **NOTA**: Los campos `cta_*_id` se mantienen para compatibilidad

## Endpoints

### Períodos

```
GET    /payment-management/periods
POST   /payment-management/periods
POST   /payment-management/periods/ensure
```

### Configuración

```
POST   /payment-management/config
```

### TODOs Pendientes

```
PATCH  /payment-management/periods/:id/amounts
GET    /payment-management/config/active?date=YYYY-MM-DD
PATCH  /payment-management/config/:id
```

## Casos de Uso

### 1. EnsurePeriodExistsUseCase
Crea períodos automáticamente durante conciliación bancaria.

**Flujo**:
1. Verifica si existe el período (year, month)
2. Si existe, lo retorna
3. Si no existe:
   - Busca configuración activa para esa fecha
   - Crea el período con la configuración
   - TODO: Crear registros en `cta_maintenance`, `cta_water`, etc.

### 2. CreatePeriodUseCase
Crea períodos manualmente con validaciones.

### 3. CreatePeriodConfigUseCase
Crea nueva configuración de montos y reglas.

## Flujo de Integración con Conciliación Bancaria

```typescript
// En el servicio de conciliación
const paymentDate = new Date(transactionBank.date);
const year = paymentDate.getFullYear();
const month = paymentDate.getMonth() + 1;

// Asegurar que existe el período
const period = await ensurePeriodExistsUseCase.execute(year, month);

// Obtener configuración
const config = await periodConfigRepository.findActiveForDate(paymentDate);

// Aplicar pago
await recordsService.allocatePayment({
  transactionBankId,
  houseId,
  periodId: period.id,
  concepts: [...]
});
```

## TODOs Importantes

### Alta Prioridad

1. **Aplicación de centavos acumulados**
   - Ubicación: `HouseBalance.accumulated_cents`
   - Pendiente: Definir cuándo y cómo aplicar (¿fin de año? ¿automático? ¿manual?)

2. **Creación automática de registros `cta_*`**
   - Ubicación: `EnsurePeriodExistsUseCase`
   - Al crear período, crear registros en `cta_maintenance`, `cta_water`, etc.

3. **Endpoint para modificar montos de período**
   - Permitir ajustar `cta_maintenance.amount`, `cta_water.amount`
   - Útil cuando cambian precios

4. **Cálculo automático de penalidades por pago tardío**
   - Usar `PeriodConfig.payment_due_day`
   - Crear registro en `cta_penalties` si pago > due_day

### Media Prioridad

5. **Validación de pagos completos/incompletos**
   - Comparar `RecordAllocation.allocated_amount` vs `expected_amount`
   - Generar reportes de casas con pagos parciales

6. **Sistema de convenios de pago**
   - CRUD completo para `HousePeriodOverride`
   - Endpoints para gestionar montos personalizados

7. **Migración de datos existentes**
   - Si ya hay períodos en BD, migrar a nueva estructura
   - Asignar `period_config_id` a períodos existentes

## Migraciones Pendientes

Se requieren migraciones TypeORM para:

1. Crear tabla `period_config`
2. Crear tabla `house_balances`
3. Crear tabla `house_period_overrides`
4. Crear tabla `record_allocations`
5. Alterar tabla `periods`:
   - Remover unique de `year` y `month` individuales
   - Añadir constraint único compuesto en `(year, month)`
   - Añadir columna `period_config_id`
6. Alterar tabla `records`:
   - Añadir relación con `record_allocations`

**Comando**: `npm run db:generate` para generar migraciones automáticas

## Normalización

La arquitectura cumple con **3FN (Tercera Forma Normal)**:
- ✅ Todos los atributos son atómicos (1FN)
- ✅ No hay dependencias parciales (2FN)
- ✅ No hay dependencias transitivas (3FN)

## Testing

TODO: Crear unit tests para:
- Use cases
- Domain entities
- Value Objects
- Repositories

## Notas de Desarrollo

- Las entidades de dominio (`domain/`) no deben tener dependencias de infraestructura
- Los repositorios implementan interfaces definidas en `interfaces/`
- Los use cases orquestan la lógica de negocio sin conocer detalles de persistencia
- Los controllers solo transforman DTOs y delegan a use cases
