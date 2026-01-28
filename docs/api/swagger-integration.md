# 📘 Swagger/OpenAPI Integration

## 📋 Overview

Este documento detalla la integración de Swagger/OpenAPI en el proyecto Agave Backend para la documentación automática de la API REST.

**Estado**: ✅ Implementado - Arquitectura híbrida con decoradores personalizados
**Versión de Swagger**: OpenAPI 3.0
**Framework**: @nestjs/swagger

---

## 🎯 Objetivos

1. **Documentación Automática**: Generar documentación de API interactiva y actualizada
2. **Generación de Cliente TypeScript**: Facilitar integración con frontends React/Angular/Vue
3. **Código Limpio**: Usar arquitectura híbrida para mantener controllers legibles
4. **Type Safety**: Aprovechar TypeScript para validación de contratos de API

---

## 🏗️ Arquitectura

### Patrón Híbrido Implementado

Combinamos tres estrategias para organizar la documentación Swagger:

1. **Custom Decorators** (`applyDecorators()` pattern)
   - Encapsulan toda la documentación de un endpoint
   - Ubicación: `src/features/[feature]/decorators/swagger.decorators.ts`
   - Mantienen controllers limpios y legibles

2. **Response DTOs** con documentación embebida
   - DTOs con decoradores `@ApiProperty` y `@ApiPropertyOptional`
   - Type-safety completo
   - Auto-completado en IDEs

3. **Request DTOs** documentados
   - Validación con `class-validator`
   - Documentación con `@nestjs/swagger`
   - Ejemplos y descripciones claras

### Beneficios de la Arquitectura

- ✅ **Controllers limpios**: De 150+ líneas a ~50 líneas
- ✅ **Reusabilidad**: Decoradores compartibles entre controladores
- ✅ **Mantenibilidad**: Cambios centralizados en decorators
- ✅ **Separación de responsabilidades**: Lógica de negocio separada de documentación

---

## 📁 Estructura de Archivos

```
src/
├── main.ts                                    # Configuración de Swagger
├── features/
│   ├── bank-reconciliation/
│   │   ├── controllers/
│   │   │   └── bank-reconciliation.controller.ts
│   │   ├── decorators/
│   │   │   └── swagger.decorators.ts          # ← Decoradores custom
│   │   └── dto/
│   │       ├── reconcile-request.dto.ts       # Request DTO documentado
│   │       └── reconciliation-response.dto.ts # Response DTO documentado
│   │
│   ├── transactions-bank/
│   │   ├── controllers/
│   │   │   └── transactions-bank.controller.ts
│   │   ├── decorators/
│   │   │   └── swagger.decorators.ts          # ← 8 decoradores custom
│   │   └── dto/
│   │       ├── transaction-bank.dto.ts
│   │       └── upload-file.dto.ts
│   │
│   ├── vouchers/
│   │   ├── controllers/
│   │   │   └── vouchers.controller.ts
│   │   ├── decorators/
│   │   │   └── swagger.decorators.ts          # ← 2 decoradores custom
│   │   └── dto/
│   │       ├── ocr-service.dto.ts
│   │       └── transaction.dto.ts
│   │
│   └── payment-management/
│       ├── controllers/
│       │   └── payment-management.controller.ts
│       ├── decorators/
│       │   └── swagger.decorators.ts          # ← 7 decoradores integrados en controller
│       └── dto/
│           ├── create-period.dto.ts
│           ├── period-response.dto.ts
│           ├── create-period-config.dto.ts
│           └── house-balance.dto.ts
```

---

## 🚀 Configuración

### 1. Instalación

```bash
npm install --save @nestjs/swagger swagger-ui-express
```

### 2. Configuración en main.ts

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// Configuración de Swagger
const config = new DocumentBuilder()
  .setTitle('Agave Backend API')
  .setDescription('API para gestión de transacciones bancarias, vouchers, reconciliación y validación manual')
  .setVersion('1.2')
  .addTag('vouchers', 'Procesamiento de comprobantes de pago con OCR')
  .addTag('transactions-bank', 'Gestión de transacciones bancarias')
  .addTag('bank-reconciliation', 'Reconciliación de transacciones')
  .addTag('payment-management', 'Gestión de pagos y cuotas')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### 3. URLs de Acceso

- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/docs-json

---

## 📝 Cómo Documentar un Endpoint

### Paso 1: Crear Custom Decorator

**Archivo**: `src/features/[feature]/decorators/swagger.decorators.ts`

```typescript
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';

/**
 * Decorador de Swagger para el endpoint de ejemplo
 */
export function ApiGetExample() {
  return applyDecorators(
    ApiOperation({
      summary: 'Título corto del endpoint',
      description: `Descripción detallada del endpoint.

**Características:**
- Feature 1
- Feature 2

**Nota importante**: Información adicional.`,
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: ['active', 'inactive'],
      description: 'Filtrar por estado',
    }),
    ApiResponse({
      status: 200,
      description: 'Operación exitosa',
      schema: {
        example: {
          id: 1,
          name: 'Ejemplo',
          status: 'active',
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Recurso no encontrado',
    }),
  );
}
```

### Paso 2: Usar en Controller

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiGetExample } from '../decorators/swagger.decorators';

@ApiTags('examples')
@Controller('examples')
export class ExamplesController {
  @Get()
  @ApiGetExample()  // ← Un solo decorador limpio
  async getExample(@Query('status') status?: string) {
    // Lógica de negocio aquí
  }
}
```

### Paso 3: Documentar DTOs

**Request DTO**:
```typescript
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExampleDto {
  @ApiProperty({
    description: 'Nombre del ejemplo',
    example: 'Mi Ejemplo',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Estado opcional',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
```

**Response DTO**:
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class ExampleResponseDto {
  @ApiProperty({
    description: 'ID único del ejemplo',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Nombre del ejemplo',
    example: 'Mi Ejemplo',
  })
  name: string;

  @ApiProperty({
    description: 'Estado del ejemplo',
    enum: ['active', 'inactive'],
    example: 'active',
  })
  status: string;
}
```

---

## 📊 Endpoints Documentados

### Resumen por Feature

| Feature | Endpoints Documentados | Archivo de Decorators |
|---------|------------------------|----------------------|
| **bank-reconciliation** | 5 | Integrados en `bank-reconciliation.controller.ts` |
| **transactions-bank** | 8 | `decorators/swagger.decorators.ts` |
| **vouchers** | 2 | `decorators/swagger.decorators.ts` |
| **payment-management** | 7 | Integrados en `payment-management.controller.ts` |
| **Total** | **22 endpoints** | - |

### Detalle de Endpoints Documentados

#### 🔄 Bank Reconciliation (5 endpoints)

**Conciliación Automática:**

1. **POST /bank-reconciliation/reconcile** - `@ApiReconcileTransactions()`
   - Ejecutar conciliación bancaria automática
   - Request: `ReconcileRequestDto` (startDate, endDate opcionales)
   - Response: `ReconciliationResponseDto` (summary, conciliados, pendientes, sobrantes, manualValidation)

**Validación Manual de Casos Ambiguos:**

2. **GET /bank-reconciliation/manual-validation/pending**
   - Listar casos pendientes de validación manual
   - Query Params: startDate, endDate, houseNumber, page (default 1), limit (default 20), sortBy (date|similarity|candidates)
   - Response: `ManualValidationCasesPageDto` (paginación, lista de casos con posibles matches)
   - Features: Filtrado por fecha y casa, sorting flexible, paginación configurable

3. **POST /bank-reconciliation/manual-validation/:transactionId/approve**
   - Aprobar un caso de validación manual eligiendo un voucher candidato
   - Path Param: transactionId
   - Request: `ApproveManualCaseDto` (voucherId, approverNotes opcionales)
   - Response: `ApproveManualCaseResponseDto` (resultado de conciliación con timestamp)
   - Features: Validación de voucher, auditoría de aprobación, transacción ACID

4. **POST /bank-reconciliation/manual-validation/:transactionId/reject**
   - Rechazar todos los vouchers candidatos de un caso
   - Path Param: transactionId
   - Request: `RejectManualCaseDto` (rejectionReason, notes opcionales)
   - Response: `RejectManualCaseResponseDto` (confirmación de rechazo)
   - Features: Auditoría de rechazo, marcar transacción como not-found, logging detallado

5. **GET /bank-reconciliation/manual-validation/stats**
   - Obtener estadísticas de validación manual
   - Response: `ManualValidationStatsDto` (total pendientes, aprobados, rechazados, tasa de aprobación, distribución por casa)
   - Metrics: Casos en últimas 24h, tiempo promedio de resolución, distribución por rango de casas (1-10, 11-20, 21-30, 31-40, 41-66)

#### 🏦 Transactions Bank (8 endpoints)

1. **POST /transactions-bank/upload** - `@ApiUploadBankFile()`
   - Subir archivo de estado de cuenta
   - Formatos: XLSX, CSV, JSON, TXT
   - Request: `multipart/form-data` + `UploadFileDto`

2. **GET /transactions-bank** - `@ApiGetAllTransactions()`
   - Listar transacciones con filtros
   - Queries: status, startDate, endDate

3. **GET /transactions-bank/summary** - `@ApiGetTransactionSummary()`
   - Resumen estadístico de transacciones

4. **GET /transactions-bank/:id** - `@ApiGetTransactionById()`
   - Obtener transacción específica

5. **POST /transactions-bank** - `@ApiCreateTransaction()`
   - Crear transacción manualmente
   - Request: `CreateTransactionBankDto`

6. **PUT /transactions-bank/:id** - `@ApiUpdateTransaction()`
   - Actualizar transacción existente
   - Request: `UpdateTransactionBankDto`

7. **DELETE /transactions-bank/:id** - `@ApiDeleteTransaction()`
   - Eliminar transacción del sistema

8. **POST /transactions-bank/reconcile** - `@ApiReconcileTransactionsLegacy()`
   - Conciliación legacy (deprecado, usar `/bank-reconciliation/reconcile`)

#### 💰 Vouchers (2 endpoints)

1. **GET /vouchers** - `@ApiGetAllVouchers()`
   - Listar todos los vouchers/comprobantes
   - Queries: confirmation_status, startDate, endDate

2. **GET /vouchers/:id** - `@ApiGetVoucherById()`
   - Obtener voucher específico con URL firmada temporal (60 min)

#### 💳 Payment Management (7 endpoints)

1. **GET /payment-management/periods** - `@ApiOperation`
   - Obtener todos los períodos de facturación registrados
   - Response: Lista de `PeriodResponseDto` con año, mes, fechas y nombre de período

2. **POST /payment-management/periods** - `@ApiOperation`
   - Crear nuevo período de facturación manualmente
   - Request: `CreatePeriodDto` (year, month, period_config_id)
   - Response: `PeriodResponseDto`
   - Error: 400 (período duplicado), 404 (configuración no encontrada)

3. **POST /payment-management/periods/ensure** - `@ApiOperation`
   - Asegurar existencia de período (crea si no existe)
   - Endpoint especial para el sistema de conciliación bancaria
   - Request: `CreatePeriodDto` (year, month)
   - Response: `PeriodResponseDto` (existente o creado)

4. **POST /payment-management/config** - `@ApiOperation`
   - Crear nueva configuración de período con montos y reglas de pago
   - Request: `CreatePeriodConfigDto` (montos de mantenimiento, agua, cuota extraordinaria, día de vencimiento, etc.)
   - Response: `PeriodConfigResponseDto`
   - Error: 400 (montos negativos o parámetros inválidos)

5. **GET /payment-management/houses/:houseId/payments** - `@ApiOperation`
   - Obtener historial completo de pagos de una casa
   - Path Param: houseId (número de la casa)
   - Response: `PaymentHistoryResponseDTO` con lista de asignaciones por período y concepto
   - Error: 404 (casa no encontrada)

6. **GET /payment-management/houses/:houseId/payments/:periodId** - `@ApiOperation`
   - Obtener pagos de una casa en período específico
   - Path Params: houseId, periodId
   - Response: `PaymentHistoryResponseDTO` con pagos filtrados por período
   - Error: 404 (casa no encontrada)

7. **GET /payment-management/houses/:houseId/balance** - `@ApiOperation`
   - Obtener saldo actual de una casa (deuda, crédito, centavos acumulados)
   - Path Param: houseId
   - Response: `HouseBalanceDTO` con estado financiero (balanced, credited, in-debt)
   - Error: 404 (casa no encontrada)

**Características Principales**:
- ✅ Distribución automática de pagos entre conceptos (mantenimiento, agua, cuota extraordinaria)
- ✅ Gestión de saldos (deuda, crédito, centavos acumulados)
- ✅ Validación de montos y períodos
- ✅ Soporte para overrides de montos por casa/período
- ✅ Historial completo de pagos con auditoría

---

## 🔧 Generación de Cliente TypeScript

### Para Frontends React/Angular/Vue

```bash
# 1. Instalar generador
npm install --save-dev openapi-typescript-codegen

# 2. Generar cliente TypeScript
npx openapi-typescript-codegen \
  --input http://localhost:3000/api/docs-json \
  --output ./src/api \
  --client axios

# 3. Usar en código
import { VouchersService } from './api/services/VouchersService';

const vouchers = await VouchersService.getAllVouchers({
  confirmationStatus: 'true',
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});
```

### Integración con React Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { VouchersService } from './api';

function useVouchers(filters: { status?: string }) {
  return useQuery({
    queryKey: ['vouchers', filters],
    queryFn: () => VouchersService.getAllVouchers(filters),
  });
}
```

---

## 🎨 Mejores Prácticas

### 1. Organización de Decoradores

✅ **DO**: Un archivo de decorators por feature
```typescript
// src/features/vouchers/decorators/swagger.decorators.ts
export function ApiGetAllVouchers() { ... }
export function ApiGetVoucherById() { ... }
```

❌ **DON'T**: Mezclar decoradores de múltiples features
```typescript
// ❌ src/shared/decorators/all-swagger.decorators.ts
export function ApiGetVouchers() { ... }
export function ApiGetTransactions() { ... }  // Diferentes features
```

### 2. Nombres de Decoradores

✅ **DO**: Nombres descriptivos que reflejen la acción
```typescript
export function ApiUploadBankFile() { ... }
export function ApiReconcileTransactions() { ... }
```

❌ **DON'T**: Nombres genéricos o ambiguos
```typescript
export function ApiEndpoint1() { ... }
export function ApiPost() { ... }
```

### 3. Documentación Completa

✅ **DO**: Incluir ejemplos y descripciones detalladas
```typescript
ApiResponse({
  status: 200,
  description: 'Voucher encontrado',
  schema: {
    example: {
      confirmation_status: true,
      url: 'vouchers/voucher_123.jpg',
      viewUrl: 'https://storage.googleapis.com/...'
    }
  }
})
```

❌ **DON'T**: Respuestas sin ejemplos
```typescript
ApiResponse({
  status: 200,
  description: 'OK'
})
```

### 4. Manejo de Errores

✅ **DO**: Documentar todos los códigos de estado posibles
```typescript
ApiResponse({ status: 200, description: 'Operación exitosa' }),
ApiResponse({ status: 400, description: 'Parámetros inválidos' }),
ApiResponse({ status: 404, description: 'Recurso no encontrado' }),
ApiResponse({ status: 500, description: 'Error interno del servidor' }),
```

### 5. Queries y Parámetros

✅ **DO**: Especificar tipos, enums y ejemplos
```typescript
ApiQuery({
  name: 'status',
  required: false,
  enum: ['pending', 'processed', 'failed', 'reconciled'],
  description: 'Filtrar por estado',
  example: 'processed'
})
```

---

## 🐛 Troubleshooting

### Problema: Swagger UI no muestra los endpoints

**Causa**: Controller no tiene `@ApiTags()`

**Solución**:
```typescript
@ApiTags('vouchers')  // ← Agregar esta línea
@Controller('vouchers')
export class VouchersController { }
```

### Problema: DTOs no aparecen en Swagger

**Causa**: Falta decorador `@ApiProperty`

**Solución**:
```typescript
export class CreateDto {
  @ApiProperty()  // ← Agregar decoradores
  name: string;
}
```

### Problema: Ejemplos no se muestran

**Causa**: Falta propiedad `example` o `schema.example`

**Solución**:
```typescript
ApiResponse({
  status: 200,
  schema: {
    example: { /* objeto de ejemplo */ }
  }
})
```

### Problema: Build falla después de agregar decoradores

**Causa**: Import circular o tipo incorrecto

**Solución**:
```typescript
// Verificar imports
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

// Verificar que todos los DTOs estén exportados correctamente
```

---

## 📚 Referencias

### Documentación Oficial
- [NestJS Swagger/OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI Specification 3.0](https://swagger.io/specification/)
- [openapi-typescript-codegen](https://github.com/ferdikoomen/openapi-typescript-codegen)

### Documentación Interna
- [API Documentation](./README.md)
- [Features - Bank Reconciliation](../features/bank-reconciliation/README.md)
- [Features - Transactions Bank](../features/transactions-bank/README.md)
- [Features - Vouchers](../features/vouchers/README.md)

---

## 🔄 Changelog

### v1.1.0 - Noviembre 2025 (Payment Management Sprint)
- ✅ Documentación de 7 nuevos endpoints de Payment Management
- ✅ Integración de decoradores Swagger en payment-management.controller.ts
- ✅ Documentación de DTOs de Payment Management (PeriodResponseDto, HouseBalanceDTO, etc.)
- ✅ Actualización de resumen de endpoints: 11 → 18
- ✅ Soporte para distribución de pagos, gestión de períodos y saldos de casas

### v1.0.0 - Noviembre 2025
- ✅ Implementación inicial de Swagger/OpenAPI
- ✅ Arquitectura híbrida con custom decorators
- ✅ Documentación de 11 endpoints (bank-reconciliation: 1, transactions-bank: 8, vouchers: 2)
- ✅ Configuración de generación de cliente TypeScript
- ✅ Swagger UI disponible en `/api/docs`

---

**Versión**: 1.1.0
**Última actualización**: Noviembre 2025
**Mantenido por**: Equipo de Desarrollo Agave
