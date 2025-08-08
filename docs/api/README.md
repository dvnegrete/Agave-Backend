# 🔗 API Documentation - El Agave Backend

## 📋 Descripción General

Esta sección contiene la documentación completa de la API REST del sistema. La API está construida con NestJS y sigue las mejores prácticas de REST.

## 🏗️ Información General

### Base URL
```
Development: http://localhost:3000
Production: https://api.elagave.com
```

### Autenticación
La API utiliza autenticación JWT Bearer Token para endpoints protegidos.

```http
Authorization: Bearer <your_jwt_token>
```

### Formato de Respuesta
Todas las respuestas siguen un formato estándar:

```json
{
  "success": true,
  "data": {...},
  "message": "Operación exitosa",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Códigos de Estado HTTP
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## 📡 Endpoints por Módulo

### 🔐 Autenticación (`/auth`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/auth/signup` | Registro de usuario | No |
| POST | `/auth/signin` | Inicio de sesión | No |
| POST | `/auth/oauth/signin` | Autenticación OAuth | No |
| GET | `/auth/oauth/callback` | Callback OAuth | No |
| POST | `/auth/refresh` | Refrescar token | No |
| GET | `/auth/me` | Obtener usuario actual | Sí |
| POST | `/auth/signout` | Cerrar sesión | Sí |
| GET | `/auth/providers` | Proveedores OAuth disponibles | No |

### 💰 Vouchers (`/vouchers`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/vouchers/upload` | Cargar archivo de transacciones | Sí |
| GET | `/vouchers` | Listar transacciones | Sí |
| GET | `/vouchers/summary` | Resumen de transacciones | Sí |
| GET | `/vouchers/:id` | Obtener transacción específica | Sí |
| POST | `/vouchers` | Crear transacción | Sí |
| PUT | `/vouchers/:id` | Actualizar transacción | Sí |
| DELETE | `/vouchers/:id` | Eliminar transacción | Sí |
| POST | `/vouchers/batch` | Crear transacciones en lote | Sí |
| GET | `/vouchers/export/csv` | Exportar a CSV | Sí |
| GET | `/vouchers/export/json` | Exportar a JSON | Sí |

### 🏦 TransactionsBank (`/transactions-bank`)

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| POST | `/transactions-bank/upload` | Cargar archivo bancario | Sí |
| GET | `/transactions-bank` | Listar transacciones bancarias | Sí |
| GET | `/transactions-bank/summary` | Resumen de transacciones bancarias | Sí |
| GET | `/transactions-bank/:id` | Obtener transacción bancaria específica | Sí |
| POST | `/transactions-bank` | Crear transacción bancaria | Sí |
| PUT | `/transactions-bank/:id` | Actualizar transacción bancaria | Sí |
| DELETE | `/transactions-bank/:id` | Eliminar transacción bancaria | Sí |
| POST | `/transactions-bank/batch` | Crear transacciones bancarias en lote | Sí |
| POST | `/transactions-bank/reconcile` | Reconciliar transacciones | Sí |
| GET | `/transactions-bank/export/csv` | Exportar a CSV | Sí |
| GET | `/transactions-bank/export/json` | Exportar a JSON | Sí |

## 📊 Estadísticas de la API

### Endpoints por Método HTTP
- **GET**: 12 endpoints
- **POST**: 12 endpoints
- **PUT**: 2 endpoints
- **DELETE**: 2 endpoints

### Endpoints por Autenticación
- **Públicos**: 6 endpoints
- **Protegidos**: 22 endpoints

### Endpoints por Módulo
- **Auth**: 8 endpoints
- **Vouchers**: 10 endpoints
- **TransactionsBank**: 11 endpoints

## 🔧 Configuración de la API

### Rate Limiting
```javascript
// Configuración por defecto
{
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por ventana
}
```

### CORS
```javascript
{
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}
```

### Validación Global
```javascript
{
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true
}
```

## 📝 Esquemas de Datos

### Usuario
```typescript
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Transacción
```typescript
interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  accountNumber: string;
  reference?: string;
  category?: string;
  status: 'pending' | 'processed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

### Respuesta de Autenticación
```typescript
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
```

## 🛡️ Seguridad

### Autenticación
- JWT Bearer Token
- Refresh Token para renovación automática
- Tokens con expiración configurable

### Autorización
- Guards de autenticación
- Decoradores para obtener usuario actual
- Validación de permisos por endpoint

### Validación
- DTOs con class-validator
- Sanitización de datos de entrada
- Validación de tipos de archivo
- Límites de tamaño de archivo

## 🧪 Testing

### Endpoints de Testing
```bash
# Probar autenticación
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Probar vouchers
curl -X GET http://localhost:3000/vouchers \
  -H "Authorization: Bearer <token>"
```

### Colección Postman
Se incluye una colección de Postman con todos los endpoints configurados.

## 📈 Monitoreo

### Métricas Recolectadas
- Tiempo de respuesta por endpoint
- Tasa de errores
- Uso de endpoints
- Autenticaciones exitosas/fallidas

### Logs
- Requests HTTP
- Errores de autenticación
- Errores de validación
- Errores de procesamiento

## 🚀 Próximas Mejoras

### API v2
- [ ] Versionado de API
- [ ] GraphQL endpoint
- [ ] WebSocket para tiempo real
- [ ] API de webhooks
- [ ] Documentación con Swagger/OpenAPI

### Seguridad
- [ ] Rate limiting por usuario
- [ ] API keys para integraciones
- [ ] Auditoría de requests
- [ ] Detección de anomalías

---

**Versión de la API**: 1.0.0  
**Última actualización**: $(date)  
**Responsable**: Equipo de Backend
