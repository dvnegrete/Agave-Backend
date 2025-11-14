# Funcionalidades Pendientes

Este archivo registra features y funcionalidades planificadas pero no implementadas aún.

## Houses Management Feature

**Prioridad**: Media
**Fecha registro**: 2025-10-30
**Contexto**: Actualmente el sistema de conciliación bancaria crea casas automáticamente asignadas al usuario sistema (`00000000-0000-0000-0000-000000000000`). Se necesita funcionalidad para reasignar estas casas a sus propietarios reales.

### Estado Actual
- ✅ `HouseRepository` ya tiene métodos `updateOwner()` y `update()` implementados
- ❌ No existe módulo de gestión de casas
- ❌ No hay endpoints API para operaciones de casas
- ❌ No hay casos de uso en capa de aplicación

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

**Prioridad**: Media
**Fecha registro**: 2025-11-01
**Contexto**: Se necesita un módulo para cargar registros históricos que ya fueron procesados previamente, permitiendo importar datos existentes mediante archivos Excel.

### Estado Actual
- ❌ No existe el módulo historical-records
- ❌ No hay endpoint para carga de archivos históricos
- ✅ La entidad `Record` ya existe en `src/shared/database/entities/record.entity.ts`
- ✅ El `RecordRepository` ya está implementado

### Tareas Pendientes

#### 1. Crear módulo Historical Records
- [ ] `src/features/historical-records/historical-records.module.ts`
- [ ] Seguir arquitectura clean (domain, application, infrastructure, interfaces)
- [ ] Registrar en `app.module.ts`

#### 2. Casos de Uso (Application Layer)
- [ ] `UploadHistoricalRecordsUseCase` - Procesar archivo Excel con registros históricos
  - Validar formato del archivo (xlsx)
  - Leer y parsear contenido del Excel
  - Validar estructura de columnas esperadas
  - Validar datos de cada registro (fechas, montos, referencias)
  - Verificar duplicados antes de insertar
  - Insertar registros en batch usando transacciones
  - Generar reporte de éxito/errores
  - Retornar estadísticas: total procesado, insertados, errores

#### 3. DTOs (Interfaces Layer)
- [ ] `UploadHistoricalRecordsResponseDto`
  ```typescript
  {
    totalRecords: number;
    successfulInserts: number;
    failedInserts: number;
    errors: Array<{
      row: number;
      reason: string;
    }>;
  }
  ```
- [ ] Definir estructura esperada del Excel:
  ```typescript
  {
    fecha: Date;              // Fecha del registro
    numeroHouse: number;      // Número de casa
    monto: number;           // Monto del registro
    concepto: string;        // Concepto/descripción
    referencia?: string;     // Referencia opcional
    tipo: RecordType;        // INGRESO | EGRESO
  }
  ```

#### 4. Controller (Interfaces Layer)
- [ ] `HistoricalRecordsController`
- [ ] Endpoint:
  - `POST /historical-records/upload` - Cargar archivo Excel
- [ ] Configurar Multer para manejo de archivos
- [ ] Validar tipo de archivo (solo .xlsx)
- [ ] Validar tamaño máximo de archivo
- [ ] Guards de autenticación y autorización (solo admin)
- [ ] Documentación Swagger con ejemplo de archivo

#### 5. Procesamiento de Excel
- [ ] Instalar dependencia: `npm install xlsx` (si no está instalada)
- [ ] Crear servicio `ExcelParserService` en infrastructure
- [ ] Implementar lectura de hojas de Excel
- [ ] Mapeo de columnas a entidades Record
- [ ] Validación de tipos de datos
- [ ] Manejo de errores de parsing

#### 6. Validaciones de Negocio
- [ ] Validar que las casas (houses) existan antes de insertar
- [ ] Validar que las fechas sean válidas y no futuras
- [ ] Validar rangos de montos (no negativos para tipo INGRESO)
- [ ] Verificar duplicados por combinación: fecha + house + monto + concepto
- [ ] Logging de operaciones para auditoría

#### 7. Testing
- [ ] Unit tests para `UploadHistoricalRecordsUseCase`
- [ ] Unit tests para `ExcelParserService`
- [ ] Unit tests para controller
- [ ] E2E test con archivo Excel de ejemplo
- [ ] Test de validaciones (archivo inválido, datos incorrectos)
- [ ] Test de duplicados

#### 8. Documentación
- [ ] `docs/features/historical-records/README.md`
- [ ] Crear archivo Excel de ejemplo/template
- [ ] Documentar estructura esperada del archivo
- [ ] Actualizar `docs/README.md`
- [ ] Casos de uso y ejemplos de API

### Estructura de Archivo Excel Esperada

```
| Fecha      | Casa | Monto    | Concepto           | Referencia | Tipo    |
|------------|------|----------|-------------------|------------|---------|
| 2024-01-15 | 101  | 1500.00  | Pago mensualidad  | REF-001    | INGRESO |
| 2024-01-20 | 102  | 1500.00  | Pago mensualidad  | REF-002    | INGRESO |
| 2024-01-25 | 0    | 500.00   | Mantenimiento     | REF-003    | EGRESO  |
```

### Referencias
- Entidad Record: `src/shared/database/entities/record.entity.ts`
- RecordRepository: `src/shared/database/repositories/record.repository.ts`
- Similar pattern: `src/features/transactions-bank/` (procesa archivos Excel de bancos)

### Notas Técnicas
- Usar transacciones para asegurar atomicidad en inserciones batch
- Considerar límite de registros por archivo para evitar timeouts
- Implementar procesamiento asíncrono si el archivo es muy grande
- Guardar archivo original en storage por auditoría (opcional)
- Enviar notificación al usuario cuando termine el procesamiento
- Considerar validación previa antes de insertar (dry-run mode)

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

**Prioridad**: Media-Alta
**Fecha registro**: 2025-11-14
**Contexto**: Funcionalidad para manejar casos ambiguos de conciliación donde una transacción bancaria tiene múltiples vouchers candidatos válidos.

### Estado Actual

**Infraestructura Completa (pero NO ACTIVADA)**:
- ✅ Entidad `ManualValidationCase` en `domain/reconciliation.entity.ts`
- ✅ Método `persistManualValidationCase()` en persistence service
- ✅ Lógica en `reconcile.use-case.ts` para manejar casos manuales (líneas 166-182)
- ✅ DTO de respuesta con array `manualValidationRequired`
- ✅ Documentación en `docs/features/bank-reconciliation/README.md`

**NO ACTIVADO**:
- ❌ `matching.service.ts` NO retorna `type: 'manual'`
- ❌ No existe lógica que detecte múltiples vouchers candidatos
- ❌ Resultado: array `manualValidationRequired` siempre está vacío en producción

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

### Tareas Pendientes

#### 1. Activar Detección en Matching Service
- [ ] Modificar `resolveMultipleMatches()` en `matching.service.ts` (líneas 141-192)
  - Si hay múltiples vouchers dentro de tolerancia de fecha (±36 horas)
  - Crear instancia de `ManualValidationCase` en lugar de elegir el primero
  - Retornar `{ type: 'manual', case: manualCase }`
- [ ] Calcular similarity score para cada candidato
  - Basado en diferencia de fecha: `1.0 - (dateDiff / DATE_TOLERANCE_HOURS)`
  - Considerar otras variables: monto, concepto, etc.

#### 2. Casos de Uso a Soportar
- [ ] **Múltiples vouchers con mismo monto exacto**
  - Transacción: $1500.15, 15-ene 10:00
  - Voucher 1: $1500.15, 15-ene 08:30 ✓
  - Voucher 2: $1500.15, 15-ene 18:00 ✓
  - Acción: Manual validation

- [ ] **Voucher marginal (límite de tolerancia)**
  - Transacción: $2000.50, 15-ene
  - Voucher: $2000.50, 20-ene (5 días = 120 horas, fuera de ±36 horas)
  - Si hay múltiples lejanos: considerar manual

- [ ] **Conflicto entre centavos y concepto**
  - Transacción: $1500.15 (centavos sugieren casa 15)
  - Concepto: "Pago casa 20"
  - Sin voucher: actualmente va a `unclaimedDeposits`
  - Considerar escalar a manual si ambas fuentes son confiables

#### 3. Endpoints de Validación Manual
- [ ] `GET /bank-reconciliation/pending-manual-validation`
  - Listar casos pendientes de revisión
  - Filtros: dateRange, house, status
  - Paginación

- [ ] `POST /bank-reconciliation/manual-approve`
  - Aprobar un caso eligiendo un voucher específico
  - Body: `{ transactionBankId: string, voucherId: number }`
  - Persistir conciliación y marcar transacción como confirmed

- [ ] `POST /bank-reconciliation/manual-reject`
  - Rechazar todos los vouchers candidatos
  - Marcar transacción como `not-found` o `conflict`

- [ ] `GET /bank-reconciliation/manual-validation-stats`
  - Estadísticas: total pendientes, pendientes por rango de fecha, tasa de aprobación

#### 4. DTOs (Interfaces Layer)
- [ ] `GetManualValidationCasesFilterDto`
  ```typescript
  {
    startDate?: Date;
    endDate?: Date;
    houseNumber?: number;
    page?: number;
    limit?: number;
    sortBy?: 'date' | 'similarity' | 'candidates';
  }
  ```

- [ ] `ApproveManualCaseDto`
  ```typescript
  {
    voucherId: number;
    // Opcional: comentario del operador
    approverNotes?: string;
  }
  ```

- [ ] `ManualValidationCaseResponseDto` (respuesta detallada)
  ```typescript
  {
    transactionBankId: string;
    transactionAmount: number;
    transactionDate: Date;
    transactionConcept: string;
    possibleMatches: Array<{
      voucherId: number;
      voucherAmount: number;
      voucherDate: Date;
      similarity: number;
      dateDifferenceHours: number;
      houseNumber?: number;
    }>;
    reason: string;
    createdAt: Date;
    status: 'pending' | 'approved' | 'rejected';
  }
  ```

#### 5. Persistencia de Aprobaciones
- [ ] Extender `transactions_status` para guardar:
  - Campo `approved_by_user_id` (NULL hasta que se apruebe)
  - Campo `approval_notes` (comentarios del operador)
  - Actualizar `processed_at` cuando se apruebe

- [ ] Crear tabla `manual_validation_approvals` para auditoría
  ```sql
  CREATE TABLE manual_validation_approvals (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR,
    voucher_id INT,
    approved_by UUID,
    approval_notes TEXT,
    approved_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (transaction_id) REFERENCES transactions_bank(id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );
  ```

#### 6. UI/Frontend Considerations
- [ ] Crear interfaz de aprobación manual
  - Mostrar ambos lados (transacción + vouchers candidatos)
  - Permitir comparación visual
  - Botones: Aprobar con este voucher / Rechazar todos

- [ ] Dashboard de casos pendientes
  - Filtros por fecha, casa
  - Ordenar por prioridad (similaridad, fecha)
  - Indicador visual de urgencia

#### 7. Testing
- [ ] Unit tests para lógica mejorada de `resolveMultipleMatches()`
- [ ] Unit tests para cálculo de similarity score
- [ ] E2E tests con múltiples escenarios:
  - Exactamente 2 vouchers candidatos
  - 3+ vouchers candidatos
  - Todos fuera de tolerancia
  - Mix de dentro/fuera de tolerancia

- [ ] Tests para endpoints de aprobación:
  - Aprobar un caso válido
  - Rechazar un caso
  - Listar casos pendientes con filtros

#### 8. Documentación
- [ ] Sección "Manual Validation" en `docs/features/bank-reconciliation/README.md`
- [ ] Workflow diagram: cómo un caso se convierte en manual
- [ ] Ejemplos de escenarios que requieren validación manual
- [ ] Guía de operador: cómo revisar y aprobar casos
- [ ] API documentation con ejemplos

#### 9. Configuración
- [ ] Nueva variable en `reconciliation.config.ts`
  ```typescript
  ENABLE_MANUAL_VALIDATION: boolean = true;
  MANUAL_VALIDATION_THRESHOLD?: number;  // % de similaridad mínima
  ```

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

### Notas Técnicas
- La infraestructura de persistencia ya está 100% lista
- Solo falta activar la lógica de detección en `matching.service.ts`
- Considerar impacto en performance (cálculo de similarity scores)
- Implementar indices en `transactions_status(validation_status)` para queries rápidas de casos pendientes
