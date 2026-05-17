# 🏗️ El Agave Backend

Sistema backend escalable construido con **NestJS** para procesamiento automatizado de comprobantes de pago, transacciones bancarias y conciliación inteligente.

> 📚 **Documentación completa**: Ver [docs/README.md](./docs/README.md)

## 🎯 Estado del Proyecto

| Módulo | Estado | Endpoints |
|--------|--------|-----------|
| **Vouchers** (OCR + WhatsApp) | ✅ Implementado | 5 |
| **Transactions Bank** | ✅ Implementado | 11 |
| **Bank Reconciliation** | ✅ Implementado | 6 |
| **Authentication** | ✅ Implementado | 8 |
| **User Management** | ✅ Implementado | 6 |
| **Payment Management** | ✅ Implementado | 5 |

**Total de endpoints funcionales: 41**

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- npm o yarn
- PostgreSQL (para base de datos)
- Supabase (autenticación)

### Instalación

```bash
# 1. Clonar repositorio
git clone https://github.com/your-org/agave-backend.git
cd agave-backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con credenciales

# 4. Verificar configuración de autenticación
npm run verify:auth

# 5. Configurar base de datos
npm run db:setup

# 6. Ejecutar en desarrollo
npm run start:dev
```

> 💡 **Tip**: Ejecuta `npm run verify:auth` antes de desplegar para validar que las variables de autenticación estén correctas.

## 📡 Funcionalidades Principales

### 💰 Vouchers - Procesamiento de Comprobantes
- Extracción OCR con Google Cloud Vision API
- Integración WhatsApp Business API
- Procesamiento inteligente con IA (OpenAI/Vertex AI)
- Generación automática de códigos de confirmación
- **Endpoint**: `POST /vouchers/ocr-service`

### 🏦 Transactions Bank - Procesamiento Bancario
- Carga multi-formato (XLSX, CSV, JSON, TXT)
- Detección automática de duplicados
- Soporte Santander (extensible a otros bancos)
- Exportación a CSV/JSON
- **Endpoints**: `POST /transactions-bank/upload`, `GET /transactions-bank`

### 🔄 Bank Reconciliation - Conciliación Automática
- Matching automático por monto y fecha
- Identificación de casa por centavos
- Niveles de confianza (HIGH, MEDIUM, LOW, MANUAL)
- Validación transaccional con rollback
- Validación manual y depósitos no reclamados
- **Endpoints**: `POST /bank-reconciliation/reconcile`, `GET /bank-reconciliation/manual-validation/pending`

### 🔐 Authentication - Autenticación con Firebase
- Login con email/password y OAuth (Google, Facebook)
- JWT tokens (access + refresh)
- Cookies httpOnly con detección automática cross-domain
- Verificación de email obligatoria
- **Endpoints**: `POST /auth/signin`, `POST /auth/oauth/callback`

### 👥 User Management - Gestión de Usuarios
- CRUD completo de usuarios
- Asignación de casas y roles
- Suspensión y eliminación segura
- Solo accesible para administradores
- **Endpoints**: `GET /user-management/users`, `PATCH /user-management/users/:userId/role`

## 🛠️ Comandos Principales

```bash
# Desarrollo
npm run start:dev          # Servidor con hot-reload
npm run start:debug        # Con debugging
npm run start:prod         # Producción

# Testing
npm test                   # Pruebas unitarias
npm run test:cov           # Con cobertura
npm run test:e2e           # End-to-end

# Base de datos
npm run db:setup           # Setup completo (triggers + indexes)
npm run db:deploy          # Aplicar migraciones

# Autenticación
npm run verify:auth        # Verificar configuración de auth

# Calidad de código
npm run lint               # ESLint
npm run format             # Prettier
```

## 📚 Documentación

- **[API Documentation](./docs/api/README.md)** - Todos los endpoints con ejemplos
- **[Features](./docs/features/)** - Documentación detallada de módulos
- **[Database Schema](./docs/database/schema.md)** - Estructura de tablas
- **[Database Triggers](./docs/database/triggers.md)** - Lógica automática
- **[Setup & Configuration](./docs/database/setup.md)** - Configuración completa
- **[Google Cloud Setup](./docs/modules/google-cloud/README.md)** - GCP configuration

## 🔧 Variables de Entorno Requeridas

Ver [env.example](./env.example) para la lista completa.

### Variables Críticas

```env
# App Configuration
PORT=3000
NODE_ENV=development|staging|production
FRONTEND_URL=https://your-frontend-url.com  # ⚠️ OBLIGATORIO
BACKEND_URL=https://your-backend-url.com    # ⚠️ Recomendado para cross-domain

# Database
DATABASE_URL=postgresql://user:pass@host:port/db
DIRECT_URL=postgresql://user:pass@host:port/db

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Firebase (Authentication)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Cloud Platform
PROJECT_ID_GCP=your-project-id
BUCKET_NAME_DOCUMENTS=your-bucket-name

# WhatsApp Business API
TOKEN_WA=your_token
PHONE_NUMBER_ID_WA=your_phone_id

# OpenAI
OPENAI_API_KEY=sk-your-key
```

### 🔐 Configuración de Autenticación Cross-Domain

Para evitar problemas de autenticación entre dominios diferentes (ej: frontend en dominio propio, backend en Railway):

1. **Ejecuta el verificador:**
   ```bash
   npm run verify:auth
   ```

2. **Configura variables críticas:**
   - `FRONTEND_URL`: URL completa del frontend (sin `/` al final)
   - `BACKEND_URL`: URL completa del backend (para detectar cross-domain)

3. **Documentación completa:**
   - [CROSS_DOMAIN_AUTH_SETUP.md](./CROSS_DOMAIN_AUTH_SETUP.md) - Configuración técnica
   - [RAILWAY_STAGING_SETUP.md](../RAILWAY_STAGING_SETUP.md) - Guía para Railway
   - [PRODUCTION_SETUP.md](../PRODUCTION_SETUP.md) - Configuración de producción

## 🏗️ Arquitectura

El proyecto sigue **Clean Architecture** con separación clara de capas:
- **Domain**: Lógica de negocio pura
- **Application**: Casos de uso
- **Infrastructure**: Servicios externos
- **Presentation**: Controladores REST

Ver [CLAUDE.md](./CLAUDE.md) para detalles completos.

## 🧪 Testing

```bash
# Todos los tests
npm test

# Tests específicos
npm test -- vouchers
npm test -- transactions-bank
npm test -- bank-reconciliation

# Con cobertura
npm run test:cov
```

## 📖 Próximos Pasos

1. **Agregar más bancos** - Extender soporte a Bancolombia, BBVA, Davivienda
2. **Notificaciones** - Sistema de alertas por email/WhatsApp
3. **Reportes financieros** - Generación automática de reportes
4. **Optimización** - Mejoras de rendimiento y caching

## 🆘 Soporte

- 📖 [Documentación Completa](./docs/README.md)
- 📋 [Troubleshooting](./docs/database/setup.md#troubleshooting)
- 🐛 [Issues](https://github.com/your-org/agave-backend/issues)

## 📝 Licencia

MIT - Ver [LICENSE](LICENSE) para detalles

---

**Versión**: 2.0.0
**Última actualización**: Enero 2026
**Desarrollado con ❤️ por el equipo de El Agave**
