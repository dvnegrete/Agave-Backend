# Vouchers Feature

Sistema de procesamiento automatizado de comprobantes de pago con OCR, soporte multi-canal (WhatsApp, Telegram, HTTP) y registro transaccional en base de datos.

## Capacidades

- OCR con Google Cloud Vision (imágenes y PDFs)
- Recepción por WhatsApp Business API, Telegram Bot API, HTTP
- Extracción automática de: monto, fecha, casa (desde centavos), referencia, hora
- Conversaciones con estado y corrección de datos
- Registro transaccional ACID en múltiples tablas
- Detección de duplicados
- Garbage collection de archivos

## Configuración

### Variables de Entorno

```env
# Google Cloud Platform
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# WhatsApp Business API
WHATSAPP_API_TOKEN=your_whatsapp_token
PHONE_NUMBER_ID_WA=your_phone_number_id
VERIFY_TOKEN_WA=your_verify_token

# Telegram Bot API
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://your-domain.com/vouchers/webhook/telegram

# AI Services
OPENAI_API_KEY=your_openai_key
```

Ver: [Google Cloud Vision Setup](../../GOOGLE_CLOUD_VISION_SETUP.md)

### Reglas de Negocio

**Detección de Casa desde Centavos:**
```
$1,500.15 → Casa 15
$2,300.42 → Casa 42
$1,000.00 → Casa null (solicitar al usuario)
```

**Validación:**
- Casa: 1-66
- Monto: positivo, no NaN
- Formatos: JPG, PNG, PDF, WEBP, GIF, BMP, TIFF (max 10MB)

**Duplicados:** Mismo (monto + fecha + casa) con tolerancia ±5 minutos

## API Endpoints

### HTTP Upload (Stateless)

```http
POST /vouchers/frontend/upload
Content-Type: multipart/form-data

{
  "file": [archivo],
  "language": "es"
}
```

**Response:**
```json
{
  "structuredData": {
    "monto": "1500.15",
    "fecha_pago": "2024-10-03",
    "referencia": "REF123",
    "hora_transaccion": "14:30:45",
    "casa": 15,
    "faltan_datos": false
  },
  "gcsFilename": "vouchers/2024-10-03/file.jpg",
  "validation": {
    "isValid": true,
    "missingFields": []
  }
}
```

```http
POST /vouchers/frontend/confirm
Content-Type: application/json

{
  "voucherData": { /* datos del upload */ },
  "gcsFilename": "vouchers/2024-10-03/file.jpg",
  "phoneNumber": "525512345678"
}
```

**Response:**
```json
{
  "success": true,
  "confirmationCode": "202410-A7K2M3P",
  "message": "Pago registrado exitosamente"
}
```

### Consultas

```http
GET /vouchers
GET /vouchers?confirmation_status=false
GET /vouchers?startDate=2024-01-01&endDate=2024-12-31
GET /vouchers/:id
```

### WhatsApp Webhook

```http
GET /vouchers/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=...
POST /vouchers/webhook/whatsapp
```

### Telegram Webhook

```http
POST /vouchers/webhook/telegram
```

## Canales de Recepción

### WhatsApp

**Setup:**
1. Crear app en Meta for Developers
2. Configurar webhook URL
3. Agregar variables de entorno

**Tipos de mensaje:**
- Imagen → OCR automático
- Documento (PDF) → OCR automático
- Texto → Clasificación con IA
- Botones interactivos → Confirmación/corrección

**Flujo:**
1. Usuario envía imagen
2. OCR extrae datos
3. Bot muestra datos + botones (SI/NO)
4. Usuario confirma → Registro en BD
5. Usuario corrige → Lista de campos → Nuevo valor → Volver a confirmar

Ver: [WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp)

### Telegram

**Setup:**
1. Crear bot con @BotFather
2. Configurar webhook: `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=..."`

**Comandos:**
- `/start` - Bienvenida
- `/ayuda` - Instrucciones

**Flujo:** Similar a WhatsApp (fotos, PDFs, botones inline)

### HTTP

**Arquitectura stateless:** Frontend retiene datos entre upload y confirm.

**Ventajas:** Escalable horizontalmente, sin Redis, backend sin estado.

## Registro en Base de Datos

### Flujo Transaccional (ACID)

Al confirmar un voucher:

```
1. Crear Voucher (código único YYYYMM-XXXXXXX, confirmation_status=false)
2. Buscar/Crear Usuario (parsePhoneNumberE164, UUID v4, role=TENANT)
3. Crear Record (vouchers_id, transaction_status_id=null)
4. Crear TransactionStatus (status=PENDING)
5. Buscar/Crear Casa (number_house único, user_id)
6. Crear HouseRecord (house_id, record_id)
```

**Relaciones:**
```
users (1) → (N) houses (1) → (N) house_records (N) → (1) records (1) → (1) vouchers
```

**Características:**
- Transacción ACID (todo o nada)
- Rollback automático en errores
- Casa obligatoria (si falta → error)
- Teléfono internacional (formato E.164)
- Casa puede cambiar de propietario
- Usuario puede tener múltiples casas
- Casa puede tener múltiples pagos

### Tablas Principales

**vouchers:**
- id, date, amount, casa, no_referencia, time
- confirmation_code (UNIQUE), confirmation_status (boolean)
- image_url (GCS path)

**records:**
- id, vouchers_id, transaction_status_id
- cta_water_id, cta_maintenance_id, cta_ordinary_fee_id, cta_extraordinary_fee_id

**houses:**
- id (PK), number_house (UNIQUE), user_id

**house_records:**
- id, house_id, record_id

**users:**
- id (UUID), cel_phone (E.164), role, status

Ver: [Database Schema](../../database/schema.md)

## Estados de Conversación

```typescript
enum ConversationState {
  IDLE = 'idle',
  WAITING_CONFIRMATION = 'waiting_confirmation',
  WAITING_HOUSE_NUMBER = 'waiting_house_number',
  WAITING_MISSING_DATA = 'waiting_missing_data',
  WAITING_CORRECTION_TYPE = 'waiting_correction_type',
  WAITING_CORRECTION_VALUE = 'waiting_correction_value',
}
```

**Gestión:**
- Storage: In-memory (Redis en producción)
- Timeout: 10 minutos
- Cleanup: Cada 5 minutos

## Errores Comunes

**WhatsApp:**
- Token expirado → Regenerar en Meta Dashboard
- Número no permitido → Agregar a lista (dev) o mover app a Live (prod)
- Mensaje fuera de ventana 24h → Usar Message Templates aprobados

**OCR:**
- Imagen ilegible → Mejorar calidad (min 300 DPI)
- Datos faltantes → Sistema solicita manualmente

**Duplicados:**
- Detectado → Mensaje de error + eliminación de archivo GCS

## Performance

| Métrica | Valor | Notas |
|---------|-------|-------|
| OCR (imagen) | 2-5 seg | Depende de tamaño |
| OCR (PDF) | +1-2 seg/página | Multi-página |
| WhatsApp response | < 1 seg | Requerido por Meta |
| Session timeout | 10 min | Auto-expire |
| File max size | 10 MB | Validado |
| Deduplication cache | 24 horas | WhatsApp message IDs |

## Troubleshooting

**OCR no extrae datos:**
- Verificar calidad de imagen
- Revisar logs de Google Vision API
- Validar que texto sea legible

**WhatsApp no recibe:**
- Verificar webhook URL en Meta Dashboard
- Comprobar VERIFY_TOKEN_WA
- Validar HTTPS activo
- Revisar que número esté en lista permitida (dev)

**Sesión expirada:**
- Timeout es 10 minutos
- Pedir al usuario reenviar comprobante

## Documentación Técnica

Para detalles de arquitectura, Clean Architecture, Use Cases, servicios y decisiones de diseño, ver:

[TECHNICAL.md](TECHNICAL.md)

## Referencias

- [Database Schema](../../database/schema.md)
- [Google Cloud Setup](../../GOOGLE_CLOUD_VISION_SETUP.md)
- [Content Dictionary](../../modules/content/README.md)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Telegram Bot API](https://core.telegram.org/bots/api)
