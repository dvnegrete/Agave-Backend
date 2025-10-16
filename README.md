# 🏗️ El Agave Backend

Sistema backend escalable construido con **NestJS** para procesamiento automatizado de comprobantes de pago, transacciones bancarias y conciliación inteligente.

> 📚 **Documentación completa**: Ver [docs/README.md](./docs/README.md)

## 🎯 Estado del Proyecto

| Módulo | Estado | Endpoints |
|--------|--------|-----------|
| **Vouchers** (OCR + WhatsApp) | ✅ Implementado | 5 |
| **Transactions Bank** | ✅ Implementado | 11 |
| **Bank Reconciliation** | ✅ Implementado | 1 |
| **Authentication** | 🚧 En Desarrollo | 8 |

**Total de endpoints funcionales: 17**

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

# 4. Configurar base de datos
npm run db:setup

# 5. Ejecutar en desarrollo
npm run start:dev
```

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
- **Endpoint**: `POST /bank-reconciliation/reconcile`

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

```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# WhatsApp
WHATSAPP_API_TOKEN=your_token
PHONE_NUMBER_ID_WA=your_phone_id
ACCESS_TOKEN_VERIFY_WA=your_verify_token

# AI Services
OPENAI_API_KEY=your_openai_key
```

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

1. **Completar Auth Module** - Finalizar implementación de autenticación
2. **Agregar más bancos** - Extender soporte a Bancolombia, BBVA, Davivienda
3. **Notificaciones** - Sistema de alertas por email/WhatsApp
4. **Dashboard** - Interfaz para validación manual de conciliaciones

## 🆘 Soporte

- 📖 [Documentación Completa](./docs/README.md)
- 📋 [Troubleshooting](./docs/database/setup.md#troubleshooting)
- 🐛 [Issues](https://github.com/your-org/agave-backend/issues)

## 📝 Licencia

MIT - Ver [LICENSE](LICENSE) para detalles

---

**Versión**: 1.0.1
**Última actualización**: Octubre 2025
**Desarrollado con ❤️ por el equipo de El Agave**
