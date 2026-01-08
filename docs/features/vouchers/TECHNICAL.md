# Vouchers - Technical Documentation

Documentación técnica detallada de arquitectura, decisiones de diseño y patrones implementados.

## Clean Architecture

```
vouchers/
├── domain/                    # Reglas de negocio puras
│   ├── voucher.entity.ts
│   └── voucher-validator.ts
├── application/               # Casos de uso (orquestación)
│   ├── process-voucher.use-case.ts
│   ├── confirm-voucher.use-case.ts
│   ├── upload-voucher-frontend.use-case.ts
│   ├── confirm-voucher-frontend.use-case.ts
│   ├── handle-whatsapp-webhook.use-case.ts
│   ├── handle-telegram-webhook.use-case.ts
│   └── ...
├── infrastructure/            # Implementaciones técnicas
│   ├── ocr/
│   │   ├── ocr.service.ts
│   │   └── voucher-processor.service.ts
│   ├── whatsapp/
│   │   ├── whatsapp-api.service.ts
│   │   ├── whatsapp-media.service.ts
│   │   ├── whatsapp-messaging.service.ts
│   │   ├── whatsapp-deduplication.service.ts
│   │   └── whatsapp-message-classifier.service.ts
│   ├── telegram/
│   │   ├── telegram-api.service.ts
│   │   ├── telegram-media.service.ts
│   │   └── telegram-messaging.service.ts
│   └── persistence/
│       ├── vouchers.service.ts
│       ├── conversation-state.service.ts
│       ├── voucher-duplicate-detector.service.ts
│       └── voucher-garbage-collector.service.ts
└── interfaces/                # Capa de presentación
    └── controllers/
        ├── vouchers.controller.ts
        └── vouchers-frontend.controller.ts
```

### Responsabilidades por Capa

**Domain (Dominio):**
- Reglas de negocio puras
- Sin dependencias externas
- VoucherValidator: validaciones, extracción de casa desde centavos, detección de campos faltantes

**Application (Casos de Uso):**
- Orquestación entre dominio e infraestructura
- No contienen lógica de negocio ni implementación técnica
- Reutilizables entre canales

**Infrastructure (Infraestructura):**
- Implementaciones técnicas: OCR, APIs, BD
- VoucherProcessorService: agnóstico al canal (WhatsApp, Telegram, HTTP)
- Servicios especializados por tecnología

**Interfaces (Presentación):**
- Exposición HTTP
- VouchersController: API principal + webhooks
- VouchersFrontendController: API stateless para UI

## Data Flows

### WhatsApp Processing

```
Usuario envía imagen
    ↓
WhatsApp API → POST /vouchers/webhook/whatsapp
    ↓
HandleWhatsAppWebhookUseCase
    ↓
    ├→ Texto → HandleWhatsAppMessageUseCase
    ├→ Imagen/PDF → ProcessVoucherUseCase
    └→ Botón → ConfirmVoucherUseCase / CorrectVoucherDataUseCase
    ↓
ProcessVoucherUseCase:
    1. Descargar (WhatsAppMediaService)
    2. OCR (VoucherProcessorService)
    3. Extraer casa (VoucherValidator)
    4. Guardar estado (ConversationStateService)
    5. Enviar botones (WhatsAppMessagingService)
    ↓
Usuario presiona "✅ Sí"
    ↓
ConfirmVoucherUseCase:
    1. Obtener datos (ConversationStateService)
    2. Validar (VoucherValidator)
    3. Detectar duplicados (VoucherDuplicateDetectorService)
    4. TRANSACCIÓN ACID:
        a. Crear Voucher
        b. Buscar/crear User
        c. Crear Record
        d. Crear TransactionStatus
        e. Buscar/crear House
        f. Crear HouseRecord
    5. Commit
    6. Enviar mensaje éxito
    7. Limpiar contexto
```

### Frontend HTTP (Stateless)

```
Usuario sube archivo en UI
    ↓
POST /vouchers/frontend/upload
    ↓
UploadVoucherFrontendUseCase:
    1. OCR (VoucherProcessorService)
    2. Validar datos
    3. Trigger garbage collection (async)
    4. Retornar datos estructurados
    ↓
Frontend muestra confirmación
    ↓
Usuario confirma
    ↓
POST /vouchers/frontend/confirm
    ↓
ConfirmVoucherFrontendUseCase:
    1. Validar completo
    2. Detectar duplicados
    3. TRANSACCIÓN ACID (igual que WhatsApp)
    4. Retornar código
```

## Key Design Decisions

### 1. Stateless Frontend API

**Decisión:** Frontend controller no mantiene estado.

**Razón:**
- Escalabilidad horizontal
- Simplicidad (no requiere Redis)
- Frontend controla el flujo
- Mejor para SPAs/React

**Trade-off:** Frontend debe retener datos.

### 2. Stateful WhatsApp/Telegram

**Decisión:** Conversaciones con estado en memoria.

**Razón:**
- Conversaciones requieren contexto
- Usuarios esperan flujo continuo
- Timeout 10 min previene memoria infinita
- Cleanup automático cada 5 min

**Trade-off:** No cluster-ready (usar Redis en prod).

### 3. Multi-Channel Architecture

**Decisión:** VoucherProcessorService agnóstico al canal.

**Razón:**
- Reutilización de lógica OCR
- Mismo comportamiento en todos los canales
- Fácil agregar canales (Email, SMS)

**Implementación:**
- Core: VoucherProcessorService
- Adapters: WhatsApp, Telegram, HTTP

### 4. ACID Transaction

**Decisión:** Transacción ACID para confirmación.

**Razón:**
- Garantiza integridad referencial
- Todo o nada
- Rollback automático

**Tablas involucradas:**
1. vouchers
2. users (find or create)
3. records
4. transaction_status
5. houses (find or create)
6. house_records

### 5. Casa from Centavos

**Decisión:** Usar centavos como identificador de casa.

**Razón:**
- Patrón adoptado por usuarios
- Evita errores de entrada manual
- Validación automática (1-66)

**Ejemplos:**
- $1500.15 → Casa 15
- $800.42 → Casa 42
- $2000.00 → null (solicitar)

### 6. Duplicate Detection

**Regla:** Mismo (monto + fecha + casa) ±5 minutos.

**Razón:**
- Previene duplicados por error
- Previene reintentos de WhatsApp
- Ahorra storage en GCS

### 7. Confirmation Code

**Formato:** `YYYYMM-XXXXXXX`

**Razón:**
- Único a nivel mes (búsqueda fácil)
- Fácil comunicar por teléfono
- Resistente a colisiones (36^7)

### 8. Garbage Collection

**Trigger:** Después de upload (fire-and-forget).

**Criterio:** Archivos > 2 horas sin referencia en `vouchers.url`.

**Razón:**
- Ahorra storage
- No afecta performance (async)
- Recupera espacio de errores

## Services Architecture

### WhatsApp Services

**WhatsAppApiService** (Base Layer):
- Cliente HTTP genérico
- Manejo de autenticación
- request(), sendMessage(), getMediaInfo(), downloadMedia()

**WhatsAppMessagingService** (Messaging):
- sendTextMessage()
- sendButtonMessage() (max 3 botones)
- sendListMessage() (max 10 opciones)
- sendImageMessage()
- sendDocumentMessage()

**WhatsAppMediaService** (Media):
- downloadMedia() → { buffer, mimeType, filename }
- getMediaInfo()
- isSupportedMediaType()

**WhatsAppMessageClassifierService** (IA):
- Clasifica intención: payment_voucher, greeting, off_topic
- Usa OpenAI GPT-3.5-turbo

**WhatsAppDeduplicationService** (Anti-duplicados):
- Cache de message IDs (24h TTL)
- Previene procesamiento múltiple
- Limpieza automática cada hora

### Telegram Services

**TelegramApiService:**
- Cliente HTTP
- getMe(), setWebhook(), getFile()

**TelegramMediaService:**
- Descarga fotos (JPEG)
- Descarga documentos (PDF, max 20MB)

**TelegramMessagingService:**
- Markdown formatting
- InlineKeyboardMarkup (botones inline)
- Callback handling

### OCR Services

**VoucherProcessorService** (Orquestador):
- processVoucher(buffer, filename, language, phoneNumber)
- Validación de formato
- Extracción con Vision API
- Estructuración con IA (OpenAI/Vertex AI)
- Extracción de casa
- Detección de faltantes
- Upload a GCS
- Generación de mensajes

**OcrService:**
- Integración con Google Cloud Vision
- Procesamiento de imágenes y PDFs multi-página

### Persistence Services

**VouchersService:**
- CRUD básico
- Consultas con filtros

**ConversationStateService** (In-Memory):
- Gestión de estado
- Estados: IDLE, WAITING_CONFIRMATION, WAITING_HOUSE_NUMBER, etc.
- Timeout 10 min, cleanup 5 min

**VoucherDuplicateDetectorService:**
- Detecta: fecha + monto + casa ±5 min
- Previene duplicados

**VoucherGarbageCollectorService:**
- Limpieza automática archivos huérfanos
- Background (fire-and-forget)
- Archivos > 2h sin referencia en BD

## Error Handling Strategy

### Levels

**Domain:**
- Validaciones de negocio
- Lanza excepciones descriptivas

**Application (Use Cases):**
- Captura errores de infraestructura
- Traduce a errores de negocio
- Logging de contexto
- Cleanup de recursos

**Infrastructure:**
- Manejo de servicios externos
- Retry logic
- Logging detallado

**Interface (Controllers):**
- Captura final
- HTTP status codes
- Respuestas formateadas

### WhatsApp Webhook

**Principio:** Siempre 200 OK a WhatsApp.

**Razón:** Evitar reintentos infinitos.

```typescript
@Post('webhook/whatsapp')
receiveWhatsAppMessage(@Body() body: unknown) {
  if (!hasValidStructure(body)) {
    return { success: true }; // No reintentar
  }

  // Async (fire-and-forget)
  this.handleWebhookUseCase.execute(body).catch(error => {
    console.error('Error:', error);
  });

  return { success: true };
}
```

## Performance Characteristics

| Aspect | Value | Notes |
|--------|-------|-------|
| OCR (image) | 2-5 seg | Tamaño-dependiente |
| OCR (PDF) | +1-2 seg/página | Multi-página |
| WhatsApp timeout | 20 seg | Meta requirement |
| Response time | < 1 seg | No bloquear |
| Session storage | In-memory | Redis en prod |
| Session timeout | 10 min | Auto-expire |
| Cleanup interval | 5 min | Background |
| Deduplication | 24h cache | Message IDs |
| GC threshold | 2 horas | Antes de eliminar |

## Scalability

### Current Limitations

1. **Conversation state:** In-memory (no cluster)
   - Solución: Redis con TTL

2. **File processing:** Síncrono
   - Solución: Queue (Bull/Redis)

3. **No rate limiting**
   - Solución: Implementar rate limiting

### Scaling Strategies

**Horizontal:**
- Redis para conversaciones
- GCS (ya implementado)
- Load balancer

**Queue-Based:**
- OCR en background
- Retry automático
- Distribución de carga
- Priorización

**Database:**
- Índices actuales: confirmation_code (unique), casa, confirmation_status
- Sugeridos: (date, casa), (amount, date, casa)

## Integration Points

| Service | Purpose | Config |
|---------|---------|--------|
| Google Cloud Vision | OCR | GOOGLE_APPLICATION_CREDENTIALS |
| Google Cloud Storage | Files | GOOGLE_CLOUD_PROJECT_ID |
| OpenAI GPT-3.5 | IA | OPENAI_API_KEY |
| Vertex AI Gemini | Fallback IA | PROJECT_ID_GCP |
| WhatsApp Business API | Messaging | WHATSAPP_API_TOKEN |
| Telegram Bot API | Messaging | TELEGRAM_BOT_TOKEN |

**Internal Modules:**
- GoogleCloudModule: Vision, Storage, Translate
- VertexAIModule: Gemini 2.0 Flash
- OpenAIModule: GPT models
- Content Dictionary: Mensajes centralizados
- Database Repositories: Persistencia

## Testing Strategy

**Unit Tests:**
- Domain: voucher-validator.spec.ts, voucher.entity.spec.ts
- Infrastructure: ocr-data-normalization.spec.ts, extract-centavos.spec.ts, voucher-processor.service.spec.ts
- Application: upload-voucher-frontend.use-case.spec.ts, confirm-voucher.use-case.spec.ts

**E2E (Planificados):**
- Flujo completo WhatsApp
- Flujo completo Frontend
- Duplicados
- Datos faltantes
- Timeout conversación

## Security

**Authentication:**
- WhatsApp: VERIFY_TOKEN_WA
- Telegram: TELEGRAM_BOT_TOKEN
- Frontend: Opcional (JWT)

**Data Validation:**
- MIME types
- Sanitización
- Rangos (casa 1-66)
- Montos (positivos, no NaN)

**Privacy:**
- Teléfonos E.164
- GCS privado
- Signed URLs (1h)
- Cleanup automático

**Error Messages:**
- No exponer internals
- Mensajes genéricos al usuario
- Logging detallado en servidor

## Adding a New Channel

Para agregar Email, SMS, etc:

1. **Crear Infrastructure Services:**
   ```
   infrastructure/{channel}/
   ├── {channel}-api.service.ts
   ├── {channel}-media.service.ts
   └── {channel}-messaging.service.ts
   ```

2. **Crear Use Case:**
   ```typescript
   HandleChannelWebhookUseCase
   ```

3. **Reutilizar:**
   - VoucherProcessorService (OCR)
   - VoucherValidator (validaciones)
   - ConversationStateService (estado)

4. **Agregar endpoint:**
   ```typescript
   @Post('webhook/{channel}')
   ```

## References

- [Feature README](README.md)
- [Database Schema](../../database/schema.md)
- [Google Cloud Setup](../../GOOGLE_CLOUD_VISION_SETUP.md)
- [Content Dictionary](../../modules/content/README.md)
