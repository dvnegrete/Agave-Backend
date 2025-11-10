# 🔗 API Documentation - El Agave Backend

## 📋 Descripción General

Esta sección contiene la documentación de la API REST del sistema. La API está construida con NestJS y sigue las mejores prácticas de REST.

**Estado del Proyecto**: ✅ En desarrollo activo - 3 módulos implementados (Vouchers, Transactions Bank, Bank Reconciliation) + 1 en desarrollo (Auth)

## 🏗️ Información General

### Base URL
```
Development: http://localhost:3000
Production: https://api.elagave.com (configurar según ambiente)
```

### Autenticación
La API utiliza autenticación Supabase con JWT Bearer Token para endpoints que lo requieran.

```http
Authorization: Bearer <your_jwt_token>
```

### Códigos de Estado HTTP
- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 📡 Endpoints por Módulo

### 🔐 Autenticación (`/auth`) - 🚧 EN DESARROLLO

⚠️ **Estado**: El módulo de autenticación está en desarrollo. Los endpoints están parcialmente implementados pero aún no están en funcionamiento completo. Se recomienda no usar estos endpoints en producción hasta que se complete el desarrollo.

Gestión de usuarios y autenticación con Supabase.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/signup` | Registro de usuario | No |
| POST | `/auth/signin` | Inicio de sesión | No |
| POST | `/auth/oauth/signin` | Autenticación OAuth (Google, GitHub, etc.) | No |
| GET | `/auth/oauth/callback` | Callback de OAuth | No |
| POST | `/auth/refresh` | Refrescar token JWT | No |
| GET | `/auth/me` | Obtener usuario actual | Sí |
| POST | `/auth/signout` | Cerrar sesión | Sí |
| GET | `/auth/providers` | Listar proveedores OAuth disponibles | No |

**Proveedores OAuth disponibles**: Google, Facebook, GitHub, Twitter, Discord

**Ejemplo de Respuesta**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "role": "tenant",
    "status": "active"
  }
}
```

---

### 💰 Vouchers (`/vouchers`) - ✅ IMPLEMENTADO

Sistema de comprobantes de pago con procesamiento OCR e integración WhatsApp Business API.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/vouchers/ocr-service` | Procesar imagen/PDF con OCR y IA | No |
| GET | `/vouchers` | Listar comprobantes con filtros opcionales | No |
| GET | `/vouchers/:id` | Obtener comprobante específico con URL firmada | No |
| GET | `/vouchers/webhook/whatsapp` | Verificar webhook de WhatsApp | No |
| POST | `/vouchers/webhook/whatsapp` | Recibir mensajes de WhatsApp | No |

**Características Implementadas**:
- ✅ Extracción de datos con Google Cloud Vision API (OCR)
- ✅ Integración WhatsApp Business API (recepción y envío de mensajes)
- ✅ Procesamiento inteligente con IA (OpenAI/Vertex AI)
- ✅ Generación automática de códigos de confirmación (Formato: YYYYMM-XXXXXXX)
- ✅ Manejo de estados de conversación (confirmación, correcciones, etc.)

**Query Parameters** (GET /vouchers):
- `confirmation_status` - Filtrar por estado: `true` (confirmado) | `false` (pendiente)
- `startDate` - Fecha inicio (formato: YYYY-MM-DD)
- `endDate` - Fecha fin (formato: YYYY-MM-DD)

**Ejemplo - POST /vouchers/ocr-service**:
```http
Content-Type: multipart/form-data

{
  "file": [imagen JPG/PNG/PDF],
  "language": "es"  // opcional, default: "es"
}
```

**Respuesta**:
```json
{
  "structuredData": {
    "monto": "1500.15",
    "fecha_pago": "2024-10-03",
    "referencia": "REF123456",
    "hora_transaccion": "14:30:45",
    "casa": 15
  },
  "whatsappMessage": "Voy a registrar tu pago...",
  "originalFilename": "comprobante.jpg",
  "gcsFilename": "vouchers/2024-10-03/comprobante_1696348800000.jpg"
}
```

---

### 🏦 Transactions Bank (`/transactions-bank`) - ✅ IMPLEMENTADO

Procesamiento de extractos bancarios de múltiples formatos y bancos.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/transactions-bank/upload` | Cargar archivo bancario (XLSX, CSV, JSON, TXT) | No |
| GET | `/transactions-bank` | Listar transacciones bancarias | No |
| GET | `/transactions-bank/summary` | Resumen de transacciones | No |
| GET | `/transactions-bank/:id` | Obtener transacción específica | No |
| POST | `/transactions-bank` | Crear transacción manual | No |
| PUT | `/transactions-bank/:id` | Actualizar transacción | No |
| DELETE | `/transactions-bank/:id` | Eliminar transacción | No |
| POST | `/transactions-bank/batch` | Crear múltiples transacciones | No |
| POST | `/transactions-bank/reconcile` | Ejecutar proceso de conciliación | No |
| GET | `/transactions-bank/export/csv` | Exportar a CSV | No |
| GET | `/transactions-bank/export/json` | Exportar a JSON | No |

**Formatos soportados**: XLSX, CSV, JSON, TXT
**Bancos con procesamiento específico**: Santander (XLSX)
**Nota**: Extensible a otros bancos mediante Strategy Pattern

**Características Implementadas**:
- ✅ Procesamiento multi-formato de archivos
- ✅ Detección automática de duplicados (Trigger SQL)
- ✅ Validaciones de datos automáticas
- ✅ Tracking de referencias de última transacción procesada
- ✅ Exportación a CSV y JSON

**Query Parameters** (GET /transactions-bank):
- `status` - Filtrar por estado: `pending` | `processed` | `failed` | `reconciled`
- `startDate` - Fecha inicio (formato: YYYY-MM-DD)
- `endDate` - Fecha fin (formato: YYYY-MM-DD)

**Ejemplo - POST /transactions-bank/upload**:
```http
Content-Type: multipart/form-data

{
  "file": [archivo XLSX/CSV/JSON/TXT],
  "bank": "santander"  // u otro banco
}
```

**Respuesta**:
```json
{
  "success": true,
  "totalTransactions": 150,
  "validTransactions": 145,
  "invalidTransactions": 5,
  "processingTime": 2500,
  "errors": ["Línea 15: Monto inválido"],
  "bankName": "Santander",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  }
}
```

---

### 🔄 Bank Reconciliation (`/bank-reconciliation`) - ✅ IMPLEMENTADO

Conciliación automática inteligente de vouchers con transacciones bancarias.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/bank-reconciliation/reconcile` | Ejecutar proceso de conciliación automática | No |

**Arquitectura**: Clean Architecture (Domain, Application, Infrastructure, Presentation)

**Características Implementadas**:
- ✅ Matching automático por monto exacto (tolerancia < $0.01)
- ✅ Filtrado por fecha (±36 horas, configurable)
- ✅ Identificación automática de casa por centavos (Ej: $500.15 → Casa #15)
- ✅ Niveles de confianza (HIGH, MEDIUM, LOW, MANUAL)
- ✅ Transacciones con rollback automático en caso de error

**Request Body - POST /bank-reconciliation/reconcile**:
```json
{
  "startDate": "2025-01-01",    // Opcional
  "endDate": "2025-01-31"       // Opcional (si no se envían, procesa TODOS los pendientes)
}
```

**Response**: Agrupa resultados en 4 categorías:
```json
{
  "summary": {
    "totalProcessed": 100,
    "conciliados": 75,
    "pendientes": 15,
    "sobrantes": 10,
    "requiresManualValidation": 5
  },
  "conciliados": [
    {
      "transactionBankId": "123",
      "voucherId": 456,
      "houseNumber": 15,
      "amount": 500.15,
      "matchCriteria": ["amount", "date"],
      "confidenceLevel": "high",
      "dateDifferenceHours": 0.5
    }
  ],
  "pendientes": [
    {
      "voucherId": 789,
      "amount": 300.25,
      "date": "2025-01-10T10:00:00.000Z",
      "reason": "No matching transaction found"
    }
  ],
  "sobrantes": [
    {
      "transactionBankId": "999",
      "amount": 600.00,
      "date": "2025-01-12T15:30:00.000Z",
      "reason": "No voucher found, no cents to identify house",
      "requiresManualReview": true
    }
  ],
  "manualValidationRequired": [...]
}
```

**Estados de Conciliación**:
- **✅ Conciliados**: Vouchers que coinciden automáticamente con transacciones
- **⏳ Pendientes**: Vouchers sin coincidencia en banco
- **📊 Sobrantes**: Transacciones sin voucher asociado
- **👤 Validación Manual**: Casos con múltiples coincidencias o datos ambigüos

---

## 📊 Estadísticas de la API

### Endpoints Implementados
- **Vouchers** (`/vouchers`): 5 endpoints ✅
- **Transactions Bank** (`/transactions-bank`): 11 endpoints ✅
- **Bank Reconciliation** (`/bank-reconciliation`): 1 endpoint ✅

### Endpoints En Desarrollo
- **Autenticación** (`/auth`): 8 endpoints 🚧 (En desarrollo)

**Total Implementados**: 17 endpoints
**Total En Desarrollo**: 8 endpoints

### Métodos HTTP Utilizados
- **GET**: 8 endpoints
- **POST**: 14 endpoints
- **PUT**: 2 endpoints
- **DELETE**: 1 endpoint

---

## 🔧 Configuración de la API

### Variables de Entorno Requeridas

**Supabase (Autenticación)**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

**Google Cloud (OCR y Storage)**:
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

**WhatsApp (Integración de Comprobantes)**:
```env
WHATSAPP_API_TOKEN=your_token
PHONE_NUMBER_ID_WA=your_phone_id
ACCESS_TOKEN_VERIFY_WA=your_verify_token
```

**AI Services (Procesamiento Inteligente)**:
```env
OPENAI_API_KEY=your_openai_key
# O alternativa:
VERTEX_AI_PROJECT_ID=your_vertex_project
```

---

## 🛡️ Seguridad

### Autenticación
- ✅ JWT Bearer Token con Supabase
- ✅ Refresh Token para renovación automática
- ✅ Tokens con expiración configurable

### Validación
- ✅ DTOs con class-validator
- ✅ Sanitización de datos de entrada
- ✅ Validación de tipos de archivo
- ✅ Límites de tamaño de archivo (10MB para OCR, configurable por formato)

### Rate Limiting
- ✅ Implementado por ventana temporal
- ✅ Límite global de 100 requests por 15 minutos

### CORS
- ✅ Configurado para frontend en desarrollo y producción
- ✅ Credenciales permitidas para autenticación

---

## 🧪 Testing

### Ejemplos con cURL

**Autenticación - Registro**:
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "password123"
  }'
```

**Autenticación - Login**:
```bash
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "password123"
  }'
```

**Vouchers - Obtener todos**:
```bash
curl -X GET "http://localhost:3000/vouchers?confirmation_status=false" \
  -H "Authorization: Bearer <token>"
```

**Vouchers - OCR Service**:
```bash
curl -X POST http://localhost:3000/vouchers/ocr-service \
  -F "file=@comprobante.jpg" \
  -F "language=es"
```

**Transactions Bank - Cargar archivo**:
```bash
curl -X POST http://localhost:3000/transactions-bank/upload \
  -F "file=@banco.xlsx" \
  -F "bank=santander"
```

**Bank Reconciliation - Ejecutar**:
```bash
curl -X POST http://localhost:3000/bank-reconciliation/reconcile \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }'
```

---

## 📈 Monitoreo y Logs

### Logs Disponibles
- Requests HTTP (método, endpoint, duración)
- Errores de autenticación
- Errores de validación
- Errores de procesamiento
- Detalles de conciliación bancaria

### Métricas Recomendadas
- Tiempo de respuesta promedio por endpoint
- Tasa de errores por tipo
- Uso de endpoints más frecuentes
- Tasa de autenticaciones exitosas/fallidas

---

## 📘 Documentación Interactiva con Swagger

### Acceso a Swagger UI

**Desarrollo**:
- Swagger UI: http://localhost:3000/api/docs
- OpenAPI JSON: http://localhost:3000/api/docs-json

**Producción**:
- Swagger UI: https://api.elagave.com/api/docs
- OpenAPI JSON: https://api.elagave.com/api/docs-json

### Endpoints Documentados

✅ **11 endpoints documentados con Swagger/OpenAPI**:
- **Bank Reconciliation**: 1 endpoint (POST /reconcile)
- **Transactions Bank**: 8 endpoints (upload, CRUD, summary, reconcile legacy)
- **Vouchers**: 2 endpoints (GET lista, GET por ID)

### Generación de Cliente TypeScript

Para integrar con frontends React/Angular/Vue:

```bash
# Instalar generador
npm install --save-dev openapi-typescript-codegen

# Generar cliente TypeScript
npx openapi-typescript-codegen \
  --input http://localhost:3000/api/docs-json \
  --output ./src/api \
  --client axios
```

📖 **Documentación completa**: [Swagger Integration Guide](./swagger-integration.md)

---

## ⚠️ Funcionalidades Pendientes (TODOs)

### Auth Module
- [ ] Two-factor authentication (2FA)
- [ ] API Keys para integraciones de terceros
- [ ] Role-based access control (RBAC) avanzado

### Vouchers Module
- [ ] Validación de comprobantes por concepto con IA (próxima implementación)
- [ ] Eliminación automática de archivos del bucket cuando se concilian
- [ ] Endpoint para obtener casos pendientes de validación manual
- [ ] Endpoints para aprobar/rechazar conciliaciones manualmente

### Transactions Bank
- [ ] Soporte para más bancos (Bancolombia, BBVA, Davivienda, etc.)
- [ ] Detección de anomalías con Machine Learning
- [ ] Procesamiento en tiempo real con WebSockets
- [ ] Sistema de colas para archivos grandes (Bull/Redis)

### Bank Reconciliation
- [ ] Tabla de auditoría para histórico de conciliaciones
- [ ] Notificaciones por email cuando hay validación manual requerida
- [ ] Dashboard de validación manual
- [ ] API de webhooks para eventos de conciliación

### General
- [x] ~~Documentación con Swagger/OpenAPI~~ ✅ **COMPLETADO**
- [ ] Versionado de API (v1, v2, etc.)
- [ ] GraphQL endpoint alternativo
- [ ] Health check endpoint

---

## 📚 Referencias y Documentación

- **[Swagger Integration Guide](./swagger-integration.md)** - Documentación completa de Swagger/OpenAPI
- [Documentación de Features - Vouchers](../features/vouchers/README.md)
- [Documentación de Features - Transactions Bank](../features/transactions-bank/README.md)
- [Documentación de Features - Bank Reconciliation](../features/bank-reconciliation/README.md)
- [Esquema de Base de Datos](../database/schema.md)
- [Google Cloud Setup](../modules/google-cloud/README.md)

---

## 🚀 Soporte y Troubleshooting

**Problema**: Error 401 en endpoints que requieren autenticación
**Solución**: Verificar que el JWT token en el header `Authorization: Bearer <token>` es válido y no ha expirado

**Problema**: OCR no extrae datos correctamente
**Solución**: Verificar que la imagen tiene calidad suficiente (mínimo 300 DPI) y el texto es legible

**Problema**: Reconciliación muy lenta
**Solución**: Usar parámetros `startDate` y `endDate` para procesar rangos más pequeños

**Problema**: Webhook de WhatsApp no recibe mensajes
**Solución**: Verificar que `ACCESS_TOKEN_VERIFY_WA` coincide, que la URL es HTTPS y que el webhook está verificado en Meta Dashboard

---

**Versión de la API**: 1.0.0
**Última actualización**: Octubre 2025
**Estado**: ✅ En desarrollo activo
