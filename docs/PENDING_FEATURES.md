# Funcionalidades Pendientes

Este archivo registra features y funcionalidades planificadas pero no implementadas aún.

**Última actualización**: 2026-01-11

---

## Payment Management - Automatic Payment Allocation

**Prioridad**: Alta ✅ **COMPLETADO**
**Fecha registro**: 2025-11-17
**Fecha completado**: 2025-11-17
**Estado**: ✅ IMPLEMENTADO

**Contexto**: Integración de AllocatePaymentUseCase en el flujo de conciliación bancaria para crear automáticamente `record_allocations` cuando se concilian transacciones.

### Problema Resuelto
Antes de esta implementación:
- ❌ GET /payment-management/houses/:houseId/payments retornaba lista vacía
- ❌ `record_allocations` nunca se creaban durante conciliación
- ❌ Flujo incompleto: solo creaba records, no la distribución de pagos por conceptos

### Implementación Completada

**Archivos Modificados:**
1. `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`
   - Inyectadas 4 nuevas dependencias: AllocatePaymentUseCase, PeriodRepository, EnsurePeriodExistsUseCase, TransactionBankRepository
   - Modificado método `persistReconciliation()` para ejecutar asignación automática (paso 6)
   - Modificado `createHouseRecordAssociation()` para retornar la house (necesario para allocations)
   - Agregado método `getOrCreateCurrentPeriod()` para obtener/crear período automáticamente
   - Total: ~90 líneas de código agregadas

2. `src/features/bank-reconciliation/bank-reconciliation.module.ts`
   - Importado PaymentManagementModule para acceso a dependencias
   - Agregado al array de imports

**Funcionalidad Implementada:**
- ✅ Asignación automática de pagos después de cada conciliación exitosa
- ✅ Creación automática de `record_allocations` (distribución por concepto)
- ✅ Obtención/creación automática del período actual
- ✅ Actualización automática de `house_balance`
- ✅ Manejo robusto de errores (no cancela conciliación si allocations falla)
- ✅ Logging detallado del proceso

**Resultado:**
- ✅ GET /payment-management/houses/:houseId/payments ahora retorna todos los pagos
- ✅ Flujo completo de conciliación a asignación automatizado
- ✅ Aplicación compilada y ejecutándose correctamente

---

## Houses Management Feature

**Prioridad**: Media
**Fecha registro**: 2025-10-30
**Estado**: ⚠️ PENDIENTE DE IMPLEMENTACIÓN - Infraestructura parcial existe
**Contexto**: Actualmente el sistema de conciliación bancaria crea casas automáticamente asignadas al usuario sistema (`00000000-0000-0000-0000-000000000000`). Se necesita funcionalidad para reasignar estas casas a sus propietarios reales.

### Estado Actual (Detallado)

**Infraestructura Existente:**
- ✅ `HouseRepository` con métodos `updateOwner()` y `update()` implementados
- ✅ `House` entity completamente mapeada con todas las propiedades
- ✅ Tabla `houses` en base de datos con campos: id, user_id, number_house, description, status, created_at, updated_at
- ✅ Entidad `User` con role field (para validar que nuevo propietario es 'tenant')
- ✅ Integración entre `BankReconciliationModule` y `PaymentManagementModule` que crea casas automáticamente

**Faltante (Capa de Aplicación/Interfaces):**
- ❌ No existe módulo dedicado `HousesModule`
- ❌ No hay `HousesController` con endpoints
- ❌ No hay casos de uso: UpdateHouseOwnerUseCase, GetHousesBySystemUserUseCase, etc.
- ❌ No hay DTOs específicas para operaciones de casas
- ❌ No hay endpoints REST para gestión de casas
- ❌ No hay tests unitarios ni E2E para estas operaciones

### Tareas Pendientes

#### 1. Crear módulo Houses Management
- [ ] `src/features/houses/houses.module.ts`
- [ ] Seguir arquitectura clean (domain, application, infrastructure, interfaces)
- [ ] Registrar en `app.module.ts`

#### 2. Casos de Uso (Application Layer)
- [ ] `UpdateHouseOwnerUseCase` - Reasignar casa a propietario real
  - Validar que la casa existe
  - Validar que el nuevo propietario existe y tiene role 'tenant'
  - Actualizar owner usando `HouseRepository.updateOwner()`
  - Retornar casa actualizada
- [ ] `GetHousesBySystemUserUseCase` - Listar casas pendientes de asignación
  - Filtrar casas donde `user_id = '00000000-0000-0000-0000-000000000000'`
  - Retornar lista con información de número de casa y fechas
- [ ] `GetHousesUseCase` - Obtener casas con filtros
- [ ] `GetHouseDetailsUseCase` - Obtener detalles de una casa específica

#### 3. DTOs (Interfaces Layer)
- [ ] `UpdateHouseOwnerDto`
  ```typescript
  {
    newOwnerId: string;  // UUID del nuevo propietario
  }
  ```
- [ ] `GetHousesFiltersDto`
  ```typescript
  {
    userId?: string;     // Filtrar por propietario
    status?: string;     // Filtrar por estatus
    page?: number;
    limit?: number;
  }
  ```
- [ ] `HouseResponseDto` - Response estandarizado

#### 4. Controller (Interfaces Layer)
- [ ] `HousesController`
- [ ] Endpoints:
  - `GET /houses` - Listar casas con filtros
  - `GET /houses/pending-assignment` - Casas del usuario sistema
  - `GET /houses/:numberHouse` - Detalles de una casa
  - `PATCH /houses/:numberHouse/owner` - Reasignar propietario
- [ ] Guards de autenticación y autorización
- [ ] Documentación Swagger

#### 5. Testing
- [ ] Unit tests para casos de uso
- [ ] Unit tests para controller
- [ ] E2E tests para flujo completo de reasignación

#### 6. Documentación
- [ ] `docs/features/houses/README.md`
- [ ] Actualizar `docs/README.md`
- [ ] Casos de uso y ejemplos de API

### Referencias
- Repositorio: `src/shared/database/repositories/house.repository.ts:142`
- Entidad: `src/shared/database/entities/house.entity.ts`
- Contexto: `docs/troubleshooting/system-user-missing.md:169-179`

### Notas Técnicas
- El usuario sistema es usado temporalmente durante conciliación bancaria
- Las casas deben poder reasignarse una vez identificado el propietario real
- Considerar agregar log/auditoría de cambios de propietario
- Validar que el nuevo propietario tenga role 'tenant'

---

## Historical Records Feature

**Prioridad**: Media ✅ **COMPLETADO**
**Fecha registro**: 2025-11-01
**Fecha completado**: 2026-01-11
**Estado**: ✅ IMPLEMENTADO
**Contexto**: Módulo para cargar registros históricos que ya fueron procesados previamente, permitiendo importar datos existentes mediante archivos Excel.

### Estado Actual
- ✅ Módulo `historical-records` completamente implementado en `src/features/historical-records/`
- ✅ Endpoint para carga de archivos históricos: `POST /historical-records/upload`
- ✅ La entidad `Record` existe en `src/shared/database/entities/record.entity.ts`
- ✅ El `RecordRepository` está implementado
- ✅ Parseo y validación de archivos Excel implementados
- ✅ Procesamiento batch con control de concurrencia
- ✅ Validaciones de negocio completadas
- ✅ Manejo de errores con reportes detallados

### Implementación Completada

**Archivos Creados:**
1. `src/features/historical-records/historical-records.module.ts` - Módulo principal
2. `src/features/historical-records/application/upload-historical-records.use-case.ts` - Caso de uso principal
3. `src/features/historical-records/infrastructure/historical-excel-parser.service.ts` - Parser de Excel
4. `src/features/historical-records/infrastructure/historical-row-processor.service.ts` - Procesador de filas
5. `src/features/historical-records/infrastructure/cta-record-creator.service.ts` - Creador de registros contables
6. `src/features/historical-records/controllers/historical-records.controller.ts` - Controller con endpoint

**Funcionalidad Implementada:**
- ✅ `POST /historical-records/upload` - Cargar archivo Excel
  - Validación de archivo (.xlsx)
  - Tamaño máximo: 10MB
  - Parámetro requerido: `bankName`
  - Modo validación solo (validateOnly)
  - Retorna: total filas, exitosas, fallidas con errores detallados

- ✅ Parseo de Excel con validaciones:
  - Lectura de columnas esperadas (FECHA, HORA, CONCEPTO, DEPOSITO, Casa, etc.)
  - Validación de tipos de datos
  - Extracción de número de casa desde centavos si es 0
  - Validación que sum(conceptos) = floor(DEPOSITO)
  - Manejo robusto de errores con mensajes descriptivos

- ✅ Procesamiento batch:
  - Control de concurrencia para evitar exhaustión de pool de conexiones
  - Procesamiento secuencial para garantizar integridad
  - Transacciones ACID
  - Logging detallado de cada fila procesada

- ✅ Validaciones de negocio:
  - Verificación de casas existentes
  - Validación de fechas (no futuras, formato válido)
  - Validación de montos (positivos)
  - Detección de duplicados
  - Auditoría de operaciones

**Formato de Excel Esperado:**
```
| FECHA      | HORA   | CONCEPTO          | DEPOSITO | Casa | Cuota Extra | Mantto | Penalizacion | Agua |
|------------|--------|-------------------|----------|------|-------------|--------|--------------|------|
| 2024-01-15 | 10:30  | Pago mensualidad  | 1542.42  | 0    | 100.00      | 1300   | 100.00       | 42.42|
| 2024-01-20 | 14:45  | Pago parcial      | 2510.15  | 15   | 200.00      | 2000   | 50.00        | 260.15|
```

**Notas:**
- El sistema está completamente operacional y registrado en `app.module.ts`
- Los errores de parseo/validación son capturados y reportados sin interrumpir el procesamiento
- Control de concurrencia implementado para evitar problemas con BD en lotes grandes

**Referencias Técnicas:**
- Entidad Record: `src/shared/database/entities/record.entity.ts`
- RecordRepository: `src/shared/database/repositories/record.repository.ts`
- Módulo: `src/features/historical-records/`
- Pattern similar para referencia: `src/features/transactions-bank/` (procesa archivos Excel de bancos)

---

## Vouchers - Telegram Integration

**Prioridad**: Baja
**Fecha registro**: 2025-11-03
**Fecha completado**: 2025-11-06
**Estado**: ✅ COMPLETADO

**Contexto**: El feature de vouchers ahora procesa comprobantes desde múltiples canales: WhatsApp Business API, Telegram Bot API, y uploads HTTP directos.

### Estado Actual
- ✅ Vouchers funciona con WhatsApp Business API
- ✅ VoucherProcessorService es agnóstico al canal (puede procesar desde cualquier origen)
- ✅ Infraestructura OCR está lista y reutilizable
- ✅ Integración con Telegram Bot API completada
- 🚧 EN DESARROLLO: Integración con Email (correo electrónico) - en rama separada

### Tareas Pendientes

#### 1. Investigación y Setup
- [ ] Crear Bot de Telegram usando BotFather
- [ ] Obtener Bot Token y configurar webhook URL
- [ ] Investigar Telegram Bot API para recepción de fotos y documentos
- [ ] Definir comandos del bot (ej: /start, /ayuda, /enviar_comprobante)

#### 2. Crear infraestructura Telegram
- [ ] `src/features/vouchers/infrastructure/telegram/telegram-api.service.ts`
  - Servicio para interactuar con Telegram Bot API
  - Métodos: sendMessage, sendPhoto, downloadFile, setWebhook
- [ ] `src/features/vouchers/infrastructure/telegram/telegram-media.service.ts`
  - Descargar archivos multimedia desde Telegram
  - Similar a `WhatsAppMediaService`
- [ ] `src/features/vouchers/infrastructure/telegram/telegram-messaging.service.ts`
  - Enviar mensajes de texto
  - Enviar botones inline (InlineKeyboardMarkup)
  - Formateo de mensajes en Markdown
- [ ] `src/features/vouchers/infrastructure/telegram/telegram-message-classifier.service.ts`
  - Clasificar tipo de mensaje (comando, foto, documento, texto)
  - Extraer intención del usuario

#### 3. DTOs para Telegram
- [ ] `src/features/vouchers/dto/telegram-webhook.dto.ts`
  ```typescript
  {
    update_id: number;
    message?: {
      message_id: number;
      from: { id: number; username: string; };
      chat: { id: number; };
      text?: string;
      photo?: Array<{ file_id: string; }>;
      document?: { file_id: string; file_name: string; mime_type: string; };
    };
    callback_query?: {
      id: string;
      from: { id: number; };
      data: string;
    };
  }
  ```

#### 4. Casos de Uso (Application Layer)
- [ ] `HandleTelegramWebhookUseCase` - Orquestador principal
  - Recibir webhook de Telegram
  - Delegar a use cases específicos según tipo de mensaje
- [ ] `HandleTelegramMessageUseCase` - Procesar mensajes
  - Similar a `HandleWhatsAppMessageUseCase`
  - Clasificar tipo de mensaje
  - Extraer media y procesar voucher
- [ ] Reutilizar use cases existentes:
  - ✅ `ProcessVoucherUseCase` (ya funciona con cualquier canal)
  - ✅ `ConfirmVoucherUseCase`
  - ✅ `HandleMissingDataUseCase`
  - ✅ `HandleHouseNumberUseCase`

#### 5. Controller
- [ ] Agregar endpoints en `VouchersController`:
  - `POST /vouchers/telegram-webhook` - Recibir updates de Telegram
  - `GET /vouchers/telegram-webhook` - Verificación de webhook (opcional)

#### 6. Gestión de Estado
- [ ] Adaptar `ConversationStateService` para Telegram
  - Usar `chat_id` de Telegram como identificador (similar a phoneNumber)
  - Reutilizar estados existentes (WAITING_HOUSE_NUMBER, WAITING_MISSING_DATA, etc.)

#### 7. Configuración
- [ ] Variables de entorno:
  ```
  TELEGRAM_BOT_TOKEN=your_bot_token
  TELEGRAM_WEBHOOK_URL=https://your-domain.com/vouchers/telegram-webhook
  ```
- [ ] Documentar en `.env.example`

#### 8. Testing
- [ ] Unit tests para servicios de Telegram
- [ ] E2E test simulando webhook de Telegram
- [ ] Test de descarga de archivos (fotos y PDFs)

#### 9. Documentación
- [ ] Actualizar `docs/features/vouchers/README.md`
- [ ] Crear sección "Telegram Integration"
- [ ] Documentar comandos del bot
- [ ] Screenshots de ejemplo de uso

### Diferencias Telegram vs WhatsApp

| Aspecto | WhatsApp | Telegram |
|---------|----------|----------|
| Identificador | phoneNumber | chat_id |
| Botones | Interactive buttons | InlineKeyboardMarkup |
| Archivos | mediaId + download API | file_id + getFile API |
| Formato mensajes | WhatsApp formatting | Markdown/HTML |
| Webhook | Requiere verificación | Simple POST |

### Referencias
- Telegram Bot API: https://core.telegram.org/bots/api
- VoucherProcessorService: `src/features/vouchers/infrastructure/ocr/voucher-processor.service.ts`
- WhatsApp implementation: `src/features/vouchers/infrastructure/whatsapp/`
- ProcessVoucherUseCase: `src/features/vouchers/application/process-voucher.use-case.ts`

### Implementación Completada

**Archivos Creados:**
1. `src/features/vouchers/infrastructure/telegram/telegram-api.service.ts` - Cliente Telegram Bot API
2. `src/features/vouchers/infrastructure/telegram/telegram-media.service.ts` - Descarga de archivos
3. `src/features/vouchers/infrastructure/telegram/telegram-messaging.service.ts` - Envío de mensajes
4. `src/features/vouchers/dto/telegram-webhook.dto.ts` - DTOs para webhook
5. `src/features/vouchers/application/handle-telegram-webhook.use-case.ts` - Procesamiento de updates

**Archivos Modificados:**
1. `src/features/vouchers/controllers/vouchers.controller.ts` - Agregado endpoint `POST /vouchers/webhook/telegram`
2. `src/features/vouchers/vouchers.module.ts` - Registrados servicios y use case de Telegram
3. `env.example` - Agregadas variables `TELEGRAM_BOT_TOKEN` y `TELEGRAM_WEBHOOK_URL`
4. `docs/features/vouchers/README.md` - Documentación de Telegram Integration

**Funcionalidad Implementada:**
- ✅ Recepción de fotos y documentos (PDFs)
- ✅ Procesamiento con OCR reutilizando VoucherProcessorService
- ✅ Comandos: /start, /ayuda
- ✅ Botones inline para confirmación
- ✅ Manejo de estados de conversación (casa faltante, datos faltantes)
- ✅ Mensajes con formato Markdown

**Pendientes (TODOs en código):**
- Confirmación completa de voucher con inserción en BD (similar a confirm-voucher.use-case.ts)
- Parseo de datos faltantes cuando usuario responde con texto
- Implementar retry logic para envío de mensajes

### Notas Técnicas
- El `VoucherProcessorService` se reutiliza exitosamente entre todos los canales
- Solo fue necesario adaptar la capa de infraestructura (descarga de media y envío de mensajes)
- Los use cases de negocio se reutilizan sin cambios
- Considerar rate limits de Telegram Bot API en producción

---

## Bank Reconciliation - Manual Validation Cases

**Prioridad**: Media-Alta ✅ **COMPLETADO**
**Fecha registro**: 2025-11-14
**Fecha completado**: 2025-11-17
**Estado**: ✅ IMPLEMENTADO Y ACTIVADO
**Contexto**: Funcionalidad para manejar casos ambiguos de conciliación donde una transacción bancaria tiene múltiples vouchers candidatos válidos.

### Estado Actual

**Infraestructura Completa y ACTIVADA**:
- ✅ Entidad `ManualValidationCase` en `domain/reconciliation.entity.ts`
- ✅ Método `persistManualValidationCase()` en persistence service
- ✅ Lógica en `reconcile.use-case.ts` para manejar casos manuales (líneas 166-182)
- ✅ DTO de respuesta con array `manualValidationRequired`
- ✅ `matching.service.ts` retorna `type: 'manual'` cuando hay múltiples candidatos (líneas 173-191)
- ✅ `ENABLE_MANUAL_VALIDATION` está habilitado en config (línea 65)
- ✅ Documentación en `docs/features/bank-reconciliation/README.md`

**Completamente ACTIVADO y Funcional**:
- ✅ Detección automática de múltiples vouchers válidos
- ✅ Creación automática de ManualValidationCase cuando similaridad está dentro del umbral (5%)
- ✅ 4 endpoints REST completamente implementados con Swagger

### Qué Son Manual Validation Cases

Casos donde una transacción bancaria tiene **múltiples vouchers válidos candidatos** y el sistema no puede elegir automáticamente cuál es el correcto.

**Ejemplo**:
```json
{
  "transactionBankId": "TX-001",
  "possibleMatches": [
    {
      "voucherId": 45,
      "similarity": 0.98,
      "dateDifferenceHours": 0.5
    },
    {
      "voucherId": 46,
      "similarity": 0.95,
      "dateDifferenceHours": 6
    }
  ],
  "reason": "2 vouchers con monto exacto $1500.15 dentro de ±36 horas"
}
```

### Implementación Completada

**Archivos Creados:**
1. `src/features/bank-reconciliation/infrastructure/persistence/manual-validation.service.ts` - Servicio completo con 4 métodos
2. `src/features/bank-reconciliation/dto/manual-validation.dto.ts` - DTOs para todos los casos de uso
3. `src/shared/database/entities/manual-validation-approval.entity.ts` - Entidad para auditoría

**Archivos Modificados:**
1. `src/features/bank-reconciliation/controllers/bank-reconciliation.controller.ts`
   - Agregados 4 endpoints REST con Swagger decorators:
     - `GET /bank-reconciliation/manual-validation/pending` (líneas 66-93)
     - `POST /bank-reconciliation/manual-validation/:transactionId/approve` (líneas 95-124)
     - `POST /bank-reconciliation/manual-validation/:transactionId/reject` (líneas 126-155)
     - `GET /bank-reconciliation/manual-validation/stats` (líneas 157-173)

2. `src/features/bank-reconciliation/bank-reconciliation.module.ts`
   - Inyectado ManualValidationService en providers

3. `src/shared/database/database.module.ts`
   - Registrada entidad ManualValidationApproval en TypeOrmModule.forFeature()

4. `src/shared/database/migrations/1731590000000-AddManualValidationFields.ts`
   - Creada tabla `manual_validation_approvals` con campos de auditoría
   - Fixed tipos de columnas para compatibilidad con foreign keys

5. `src/shared/database/entities/voucher.entity.ts`
   - Hecha columna `date` nullable para sincronización con BD existente

**Funcionalidad Implementada:**
- ✅ `getPendingManualCases()` - Listar casos con filtros y paginación
  - Filtros: fechas, número de casa
  - Sorting: por fecha (DESC), similaridad (ASC), número de candidatos (DESC)
  - Paginación configurable
  - Query builder optimizado con JSONB filters

- ✅ `approveManualCase()` - Aprobar caso eligiendo voucher candidato
  - Validación de voucher en posibles matches
  - Transacción ACID para consistencia
  - Auditoría en `manual_validation_approvals`
  - Actualización de estados en `transaction_status` y `transactions_bank`
  - Logging detallado

- ✅ `rejectManualCase()` - Rechazar todos los candidatos
  - Transacción ACID
  - Auditoría con razón de rechazo
  - Marcar transacción como `not-found` (sin fondos)
  - Logging de rechazo

- ✅ `getManualValidationStats()` - Estadísticas agregadas
  - Total pendientes, aprobados, rechazados
  - Casos pendientes en últimas 24 horas
  - Tasa de aprobación
  - Tiempo promedio de resolución
  - Distribución por rango de casas (1-10, 11-20, 21-30, 31-40, 41-66)

- ✅ Detección automática en `matching.service.ts`
  - Detecta múltiples vouchers dentro de tolerancia (±36 horas)
  - Calcula similarity scores basado en diferencia de fecha
  - Si similaridad dentro del umbral (5%) → escala a manual validation
  - Si no → elige automáticamente el más cercano en fecha

**Query Builders Optimizados:**
- Utiliza JSONB queries para filtrar por campos en metadata
- LEFT JOIN con transaction_status para acceso a validación_status
- Paginación eficiente con offset/take
- Índices en campos de filtrado frecuente

### Escenarios de Uso Real

#### Caso 1: Pagos Colectivos
```
Dos residentes pagan juntos desde una cuenta compartida

Transacción: $3000.30 (Casa 30)
Voucher 1: Casa 30, $3000.30 (15-ene 14:00)
Voucher 2: Casa 25, $3000.30 (15-ene 14:45)

Sistema: "Ambas fechas son válidas. ¿Es para casa 30 o 25?"
→ Operador revisa concepto y aprueba la correcta
```

#### Caso 2: Retrasos Bancarios
```
Banco procesa transacción días después

Transacción: $1500.15 (20-ene, reportado por banco)
Voucher: $1500.15 (15-ene, 5 días antes = 120 horas, fuera de tolerancia)

Sistema actual: unclaimedDeposits (depósito no reclamado)
Sistema mejorado: Podría ser manual si otros indicadores son fuertes
```

#### Caso 3: Errores de Entrada
```
Operador ingresa mismo monto dos veces

Transacción: $2000.00 (sin centavos válidos)
Voucher A: $2000.00 (casa 5)
Voucher B: $2000.00 (casa 5) - misma casa, duplicado accidental

Sistema: "Mismo monto, misma casa. Requiere validación manual para evitar duplicado"
```

### Impacto Esperado
- **Tasa de auto-conciliación**: 85-90% (actual) → 75-80% (con manual validation)
- **Precisión**: 98% (actual) → 99%+ (al requerir revisión de casos ambiguos)
- **Carga de trabajo**: +5-15% de casos requieren revisión manual

### Referencias
- Entidad: `src/features/bank-reconciliation/domain/reconciliation.entity.ts:121-155`
- Persistence: `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts:410-452`
- Use Case: `src/features/bank-reconciliation/application/reconcile.use-case.ts:166-182`
- Matching Service: `src/features/bank-reconciliation/infrastructure/matching/matching.service.ts:141-192`
- Documentación: `docs/features/bank-reconciliation/README.md:169-201`

**Resultado Final:**
- ✅ Aplicación compilada y ejecutándose correctamente
- ✅ Todos los endpoints operacionales con Swagger documentado
- ✅ Base de datos con todas las tablas y campos requeridos
- ✅ Transacciones ACID aseguran integridad de datos
- ✅ Auditoría completa de decisiones manuales en `manual_validation_approvals`
- ✅ Sistema listo para producción

### Notas Técnicas
- Query builders optimizados con JSONB para campos anidados en metadata
- Transacciones atómicas previenen inconsistencias
- Logging detallado para troubleshooting
- Índices en transaction_status(validation_status) para queries rápidas de casos pendientes
- Manejo robusto de errores con try-catch y rollback automático

---

## Resumen General de Features

**Última verificación de código**: 2026-01-11

### Features Implementadas (5/6)

| Feature | Prioridad | Estado | Módulo | Controllers | Endpoints |
|---------|-----------|--------|--------|-------------|-----------|
| Payment Management | Alta | ✅ COMPLETO | `payment-management` | 1 | 6 |
| Bank Reconciliation | Alta | ✅ COMPLETO | `bank-reconciliation` | 1 | 5 (+ manual validation) |
| Historical Records | Media | ✅ COMPLETO | `historical-records` | 1 | 1 |
| Vouchers + Telegram | Baja | ✅ COMPLETO | `vouchers` | 2 | 2 (webhook endpoints) |
| Transactions Bank | Media | ✅ OPERACIONAL | `transactions-bank` | 1 | - |
| **Houses Management** | **Media** | **⚠️ PENDIENTE** | **No existe** | **0** | **0** |

### Módulos Registrados en app.module.ts

✅ Todos los módulos principales están registrados y operacionales:
- VouchersModule
- TransactionsBankModule
- BankReconciliationModule
- PaymentManagementModule
- HistoricalRecordsModule
- Plus: AuthModule, DatabaseModule, GoogleCloudModule, OpenAIModule, VertexAIModule, HealthModule

### Próximo Paso Recomendado

**Implementar Houses Management** - Es el único feature planificado sin módulo dedicado:
- Requiere: 1 módulo, 4 use cases, 1 controller con ~4 endpoints
- Dependencias: Todo ya existe en infraestructura
- Esfuerzo: Bajo (solo capa de aplicación e interfaces)
- Impacto: Permite reasignar casas del usuario sistema a propietarios reales

---

## Payment Management - House Period Charges System

**Prioridad**: Alta ✅ **COMPLETADO**
**Fecha registro**: 2026-02-10
**Fecha completado**: 2026-02-11
**Estado**: ✅ COMPLETAMENTE IMPLEMENTADO
**Documentación**: `docs/features/payment-management/HOUSE_PERIOD_CHARGES.md`

### Resumen de Implementación (6 Fases)

Sistema de snapshot inmutable de cargos esperados por casa-período. Reemplaza cálculos dinámicos por datos congelados al crear cada período.

**Fases Completadas:**

| Fase | Descripción | Archivos | Status |
|------|-------------|----------|--------|
| **1** | Modelo de datos (Entity, Migration, Repository) | 4 | ✅ |
| **2** | Seed automático al crear período (M+W+F+P) | 2 | ✅ |
| **3** | Integración con AllocatePaymentUseCase | 3 | ✅ |
| **4** | Penalidades automáticas en seed | 2 | ✅ |
| **5** | Reportes analíticos (período, casa, clasificación) | 5 | ✅ |
| **6** | Ajustes, reversiones y condonaciones | 5 | ✅ |

**Total**: 21 archivos nuevos + 10 modificados

### Qué se Implementó

**Tabla**: `house_period_charges`
- Snapshot inmutable de cargos (casa × período × concepto)
- ~198-264 registros por período (66 casas × 3-4 conceptos)
- Índices: `(house_id, period_id, concept_type)` UNIQUE

**Servicios (4)**:
- `SeedHousePeriodChargesService` - Crear cargos inmutables
- `HousePeriodChargeCalculatorService` - Cálculos basados en cargos
- `CalculatePeriodPenaltiesService` - Penalidades automáticas
- `PaymentReportAnalyzerService` - Reportes analíticos
- `ChargeAdjustmentValidatorService` - Validaciones de negocio

**Use Cases (9)**:
- `CreatePeriodUseCase` - Modificado para ejecutar seed
- `EnsurePeriodExistsUseCase` - Modificado para ejecutar seed
- `AllocatePaymentUseCase` - Modificado para usar HPC
- `GetHousePeriodBalanceUseCase` - Balance casa-período
- `GetPeriodReportUseCase` - Reporte período
- `GetHousePaymentHistoryUseCase` - Historial multi-período
- `ClassifyHousesByPaymentUseCase` - Clasificación de casas
- `AdjustHousePeriodChargeUseCase` - Ajustar cargo
- `ReverseHousePeriodChargeUseCase` - Reversionar cargo
- `CondonePenaltyUseCase` - Condonar penalidades

### Cómo Funciona

**Al crear período:**
```
1. CreatePeriodUseCase.execute()
2. SeedHousePeriodChargesService.seedChargesForPeriod(periodId)
   ├─ Para cada casa (1-66):
   │  ├─ Crear MAINTENANCE (siempre)
   │  ├─ Crear WATER (si water_active)
   │  ├─ Crear EXTRAORDINARY_FEE (si extraordinary_fee_active)
   │  └─ Crear PENALTIES (si hay deuda anterior)
   └─ Batch insert (~264 cargos)
```

**Al distribuir pagos:**
```
1. AllocatePaymentUseCase.execute(recordId, houseId, periodId, amount)
2. preparePaymentConcepts():
   └─ SELECT FROM house_period_charges (montos inmutables)
3. Distribuir pago FIFO usando montos fijos
```

**Consultar balance:**
```
1. GetHousePeriodBalanceUseCase.execute(houseId, periodId)
2. SELECT SUM(expected_amount) FROM house_period_charges
3. SELECT SUM(allocated_amount) FROM record_allocations
4. Calcular diferencia = expected - paid
```

### Validaciones de Negocio

- ✅ No editar períodos > 3 meses atrás (proteger histórico)
- ✅ No reducir cargos por debajo de lo ya pagado
- ✅ Solo condonar penalidades, no otros conceptos
- ✅ No permitir reversión de cargos con pagos asignados

### Integración con Sistema Actual

- ✅ Se integra con `AllocatePaymentUseCase` existente
- ✅ Se integra con `PeriodConfig` para valores por defecto
- ✅ Se integra con `HousePeriodOverride` para sobrescrituras
- ✅ Se integra con `RecordAllocation` para tracking de pagos
- ✅ Retrocompatible con períodos antiguos (fallback a cálculo legacy)

### Beneficios Realizados

| Aspecto | Antes | Después |
|---------|-------|---------|
| Montos esperados | Dinámicos (recalculados) | Inmutables (snapshot) |
| Trazabilidad | Débil | Fuerte (campo `source`) |
| Auditabilidad | Difícil | Fácil (datos congelados) |
| Distribución FIFO | Montos variables | Montos garantizados |
| Penalidades | Manual | Automáticas |
| Reportes | Aproximados | Precisos |

### Documentación

Ver `docs/features/payment-management/HOUSE_PERIOD_CHARGES.md` para:
- Detalles técnicos completos
- Flujos de datos
- Ejemplos de uso
- Próximos desarrollos posibles

---

## Payment Management - Tablas Contables cta_*

**Prioridad**: Baja (No Bloqueante)
**Fecha registro**: 2025-01-05
**Estado**: ⚠️ PENDIENTE DE DEFINICIÓN DE REGLAS DE NEGOCIO

**Contexto**: Las tablas contables `cta_*` existen en el esquema de base de datos pero NO están siendo utilizadas. El sistema actual funciona correctamente usando `record_allocations` para el tracking de pagos.

### Estado Actual

**Tablas existentes pero sin uso:**
- `cta_maintenance` - Cuentas de mantenimiento
- `cta_water` - Cuentas de agua
- `cta_penalties` - Cuentas de penalidades/recargos
- `cta_extraordinary_fee` - Cuentas de cuotas extraordinarias
- `cta_other_payments` - Cuentas de otros pagos

**Entidades TypeORM creadas:**
- ✅ `src/shared/database/entities/cta-maintenance.entity.ts`
- ✅ `src/shared/database/entities/cta-water.entity.ts`
- ✅ `src/shared/database/entities/cta-penalties.entity.ts`
- ✅ `src/shared/database/entities/cta-extraordinary-fee.entity.ts`
- ✅ `src/shared/database/entities/cta-other-payments.entity.ts`

**Relaciones en Record entity:**
```typescript
// src/shared/database/entities/record.entity.ts
@Column({ type: 'int', nullable: true })
cta_maintence_id: number;      // ❌ Nunca se popula

@Column({ type: 'int', nullable: true })
cta_water_id: number;          // ❌ Nunca se popula

@Column({ type: 'int', nullable: true })
cta_penalities_id: number;     // ❌ Nunca se popula

@Column({ type: 'int', nullable: true })
cta_extraordinary_fee_id: number;  // ❌ Nunca se popula

@Column({ type: 'int', nullable: true })
cta_other_payments_id: number;     // ❌ Nunca se popula
```

### Problema Identificado

En `AllocatePaymentUseCase` (líneas 157, 173, 188):
```typescript
concepts.push({
  type: AllocationConceptType.MAINTENANCE,
  conceptId: 1,  // ⚠️ Valor hardcodeado, NO es FK real
  expectedAmount: maintenanceAmount,
});
```

El `conceptId` se guarda en `record_allocations.concept_id` pero:
- NO corresponde a un registro real en las tablas `cta_*`
- NO se crean registros contables individuales por período/casa

### Sistema Actual vs Diseño Original

| Aspecto | Diseño Original (cta_*) | Implementación Actual |
|---------|------------------------|----------------------|
| Tracking de pagos | Registros en cta_maintenance, cta_water, etc. | `record_allocations` |
| Saldos por casa | Sumar registros cta_* | `house_balances` tabla |
| Historial | Consultar cta_* por período | `record_allocations` por house_id |
| FK en Record | Apunta a cta_*.id | No se usa |
| Granularidad | Cuenta contable por concepto/período | Asignación por pago |

**El sistema actual FUNCIONA correctamente** sin las tablas cta_*. Estas tablas representan un diseño contable más detallado que no se implementó.

### Decisión Pendiente

Se necesita definir si:

**Opción A: Eliminar tablas cta_* (Simplificar)**
- Remover entidades y migraciones
- Limpiar FK en Record entity
- Mantener solo `record_allocations` + `house_balances`
- Menor complejidad, sistema más simple

**Opción B: Implementar tablas cta_* (Contabilidad Completa)**
- Definir reglas de negocio para cada tabla
- Crear registros contables al conciliar pagos
- Vincular Record.cta_*_id a registros reales
- Mayor trazabilidad contable

### Reglas de Negocio a Definir (Si se elige Opción B)

1. **¿Cuándo se crea un registro cta_*?**
   - ¿Al inicio del período para todas las casas?
   - ¿Solo cuando hay un pago?
   - ¿Al generar estados de cuenta?

2. **¿Qué representa cada registro cta_*?**
   - ¿Cargo mensual esperado?
   - ¿Pago aplicado?
   - ¿Ambos (débito y crédito)?

3. **¿Cómo se relaciona con Period?**
   - Cada cta_* tiene `period_id`
   - ¿Se crea automáticamente al crear período?
   - ¿Hereda montos de PeriodConfig?

4. **¿Cómo se vincula con Record?**
   - ¿Un Record puede tener múltiples cta_*?
   - ¿O un cta_* puede tener múltiples Records?

5. **¿Qué pasa con pagos parciales?**
   - ¿Se actualiza el cta_* existente?
   - ¿Se crea uno nuevo por cada pago parcial?

### Tareas Pendientes (Si se decide implementar)

- [ ] Definir reglas de negocio con stakeholders
- [ ] Documentar flujo contable esperado
- [ ] Modificar `AllocatePaymentUseCase` para crear cta_*
- [ ] Actualizar Record con FK reales
- [ ] Crear repositorios para cada cta_*
- [ ] Agregar endpoints para consultar cuentas contables
- [ ] Migrar datos existentes si es necesario

### Referencias
- Record entity: `src/shared/database/entities/record.entity.ts`
- AllocatePaymentUseCase: `src/features/payment-management/application/allocate-payment.use-case.ts:157`
- RecordAllocation: `src/shared/database/entities/record-allocation.entity.ts`
- Entidades cta_*: `src/shared/database/entities/cta-*.entity.ts`

### Notas Técnicas
- Las tablas cta_* tienen estructura: `id`, `amount`, `period_id`, `created_at`, `updated_at`
- Cada una tiene relación ManyToOne con Period
- Cada una tiene relación OneToMany con Record
- El sistema funciona sin ellas porque `record_allocations` cumple el rol de tracking
