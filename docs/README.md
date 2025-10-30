# Agave Backend Documentation

## Overview

Documentación completa del backend de Agave, incluyendo arquitectura, features, base de datos y configuración.

> 📚 **Guía de navegación**: Ver [DOCUMENTATION_STRUCTURE.md](DOCUMENTATION_STRUCTURE.md) para entender la organización completa de la documentación.

## Table of Contents

### 🏗️ Architecture
- [Project Structure](../CLAUDE.md) - Estructura del proyecto y comandos principales
- [Clean Architecture](features/transactions-bank/README.md#architecture) - Patrón de arquitectura implementado

### 💾 Database
- [**Schema & Tables**](database/schema.md) - Estructura completa de tablas (Transactions Bank + Vouchers/Houses)
- [**Schema Visualization**](database/schema-visualization.md) - Diagrama visual con DBML (DrawDB/dbdiagram.io)
- [**Triggers & Functions**](database/triggers.md) - Lógica automática de duplicados
- [**Indexes & Optimization**](database/indexes.md) - Optimización de performance
- [**Setup & Commands**](database/setup.md) - Comandos npm y configuración
- [**Migration History**](database/schema.md#migration-history) - Historial de cambios de esquema

### 🏦 Features

#### Transactions Bank
- [**Feature Overview**](features/transactions-bank/README.md) - Módulo completo de transacciones bancarias
- [API Endpoints](features/transactions-bank/README.md#api-endpoints) - REST API documentation
- [Business Logic](features/transactions-bank/README.md#business-logic) - Reglas de negocio
- [File Processing](features/transactions-bank/README.md#supported-formats) - Formatos soportados

#### Vouchers & OCR
- [**Vouchers Feature Overview**](features/vouchers/README.md) - Módulo completo de procesamiento de comprobantes
- [**Database Integration**](features/vouchers/database-integration.md) - Sistema transaccional multi-tabla (users, houses, records, vouchers)
- [**OCR Implementation**](modules/vouchers/ocr-implementation.md) - Implementación de OCR con Google Cloud Vision
- [WhatsApp Integration](features/vouchers/README.md#whatsapp-integration) - Integración con WhatsApp Business API

#### Bank Reconciliation
- [**Feature Overview**](features/bank-reconciliation/README.md) - Conciliación automática de vouchers vs transacciones bancarias
- [API Endpoints](features/bank-reconciliation/README.md#api-endpoints) - Endpoint de conciliación
- [Business Logic](features/bank-reconciliation/README.md#business-logic) - Algoritmo de matching y reglas
- [Configuration](features/bank-reconciliation/README.md#configuration) - Configuración de tolerancias y umbrales

<<<<<<< Updated upstream
=======
#### Payment Management
- [**Feature Overview**](features/payment-management/README.md) - Sistema de gestión de períodos de facturación y distribución de pagos
- [API Endpoints](features/payment-management/README.md#api-endpoints) - Endpoints de períodos y configuración
- [Database Entities](features/payment-management/README.md#database-entities) - PeriodConfig, HouseBalance, RecordAllocation
- [Migrations Guide](features/payment-management/MIGRATIONS.md) - Guía de migraciones de base de datos
- [Integration](features/payment-management/README.md#integration-with-bank-reconciliation) - Integración con conciliación bancaria

### 📋 Pending Features
- [**Pending Features**](PENDING_FEATURES.md) - Funcionalidades planificadas para implementación futura

>>>>>>> Stashed changes
### 📦 Shared Modules

#### Google Cloud Platform
- [**Google Cloud Library**](modules/google-cloud/README.md) - Librería unificada para servicios de GCP
- [**Vision API Setup**](modules/google-cloud/vision-api-setup.md) - Configuración de Google Cloud Vision para OCR
- [Cloud Storage Service](modules/google-cloud/README.md#cloud-storage-service) - Servicio centralizado de almacenamiento
- [Services Available](modules/google-cloud/README.md#servicios-disponibles) - Vision, Storage, Translate, TTS, STT

#### Content Dictionary System
- [**Content System Overview**](modules/content/README.md) - Sistema centralizado de mensajes y configuración
- [Messages](modules/content/README.md#mensajes) - Mensajes de WhatsApp y Transacciones Bancarias
- [Prompts](modules/content/README.md#prompts-de-ia) - Prompts de IA centralizados
- [Business Values](modules/content/README.md#configuración) - Valores de negocio y configuración

## Quick Start

### Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Setup database (triggers + indexes)
npm run db:setup

# 4. Run migrations
npm run db:deploy

# 5. Start development server
npm run start:dev
```

### Database Commands
```bash
# Complete setup (recommended)
npm run db:setup

# Individual components
npm run db:install-triggers    # SQL triggers for duplicate detection
npm run db:install-indexes     # Performance optimization indexes

# Testing & verification
npm run db:test-triggers       # Test trigger functionality
npm run db:check-transactions  # View table schema
```

## Key Features

### 🔄 Automatic Duplicate Detection
- **Database-level**: SQL triggers handle all duplicate logic
- **Silent processing**: Duplicates ignored without errors
- **Performance optimized**: No backend overhead for duplicate checking

### 📊 Performance Optimization
- **Partial indexes**: Optimized for frequent queries
- **Batch processing**: Efficient bulk operations
- **Connection pooling**: Optimized database connections

### 🏦 Multi-Bank Support
- **Santander XLSX**: Implemented with Strategy pattern
- **Extensible design**: Easy to add new banks and formats
- **Format agnostic**: Support for XLSX, CSV, JSON, TXT

### 🛡️ Data Integrity
- **Validation layers**: Multiple validation stages
- **Error handling**: Comprehensive error reporting
- **Transaction safety**: ACID compliance

## Architecture Highlights

### Clean Architecture
```
src/
├── features/                # Business logic modules
│   ├── transactions-bank/   # Bank transaction processing
│   └── vouchers/           # Voucher processing with OCR & WhatsApp
├── shared/                  # Shared utilities and services
│   ├── database/           # Database layer
│   │   ├── entities/       # TypeORM entities
│   │   ├── repositories/   # Data access layer
│   │   ├── functions/      # SQL functions & triggers
│   │   └── indexes/        # Database indexes
│   ├── libs/               # External service integrations
│   │   ├── google-cloud/   # GCP services (Vision, Storage, etc.)
│   │   ├── openai/         # OpenAI integration
│   │   └── vertex-ai/      # Google Vertex AI integration
│   ├── content/            # Centralized messages, prompts & config
│   │   ├── messages/       # All user-facing messages
│   │   ├── prompts/        # AI prompts
│   │   └── config/         # Business values & URLs
│   └── config/             # Configuration management
```

### Database Design
- **PostgreSQL**: Primary database
- **TypeORM**: ORM with migrations
- **SQL Functions**: Database-level business logic
- **Partial Indexes**: Performance optimization

## Database Schema Overview

### Transactions Bank Module
- `transactions_bank`: Main transactions storage
- `last_transaction_bank`: Processing reference tracking

### Vouchers & Houses Module
- `vouchers`: Comprobantes de pago con OCR
- `records`: Registros centrales que relacionan vouchers con casas
- `houses`: Casas/propiedades del sistema
- `house_records`: Tabla intermedia (múltiples pagos por casa)
- `users`: Usuarios con autenticación y números de teléfono internacionales

### Automatic Features
- **Duplicate Detection**: SQL trigger prevents duplicates (transactions-bank)
- **Performance Optimization**: Partial indexes for common queries
- **Transactional Integrity**: ACID transactions for voucher registration
- **Multi-table Relationships**: Normalized schema with proper foreign keys

## API Overview

### Transactions Bank Endpoints
```http
POST   /transactions-bank/upload         # Upload bank statement file
GET    /transactions-bank                # Get all transactions
GET    /transactions-bank/:id            # Get specific transaction
GET    /transactions-bank/status/:status # Get by status
POST   /transactions-bank/reconcile      # Reconcile transactions
GET    /transactions-bank/export/csv     # Export to CSV
GET    /transactions-bank/export/json    # Export to JSON
```

### Vouchers & OCR Endpoints
```http
POST   /vouchers/ocr-service             # Process voucher with OCR
GET    /vouchers/ocr-service/languages   # Get supported languages
POST   /vouchers/whatsapp-webhook        # WhatsApp webhook (register voucher + multi-table insert)
GET    /vouchers/whatsapp-webhook        # WhatsApp verification
GET    /vouchers                         # Get all vouchers (with filters)
GET    /vouchers/:id                     # Get voucher by ID with signed URL
```

### Bank Reconciliation Endpoints
```http
POST   /bank-reconciliation/reconcile    # Execute reconciliation (all or by date range)
```

## Development Guidelines

### Code Quality
```bash
npm run lint          # ESLint with auto-fix
npm run format        # Prettier formatting
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
```

### Database Changes
1. Modify entities in `src/shared/database/entities/`
2. Generate migration: `npm run db:generate`
3. Apply changes: `npm run db:deploy`
4. Update triggers/indexes if needed: `npm run db:setup`

### Adding New Banks
1. Create model in `src/features/transactions-bank/models/`
2. Implement Strategy pattern
3. Add to `FileProcessorService`
4. Update documentation

## Environment Configuration

### Required Variables
```env
# Database connection
DATABASE_URL=postgresql://user:pass@host:port/db

# Application settings
PORT=3000
NODE_ENV=development

# External services
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Google Cloud Platform
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
PROJECT_ID_GCP=your-project-id

# WhatsApp Business API
WHATSAPP_API_TOKEN=your_whatsapp_token
PHONE_NUMBER_ID_WA=your_phone_number_id
VERIFY_TOKEN_WA=your_verify_token

# AI Services
OPENAI_API_KEY=your_openai_key
```

## Monitoring & Debugging

### Database Performance
```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE relname = 'transactions_bank';

-- Monitor trigger performance
SELECT * FROM pg_stat_user_functions WHERE funcname = 'check_transaction_duplicate';
```

### Application Logs
```bash
# Development with detailed logs
npm run start:debug

# Production optimized
npm run start:prod
```

## Contributing

### Development Flow
1. Create feature branch
2. Implement changes following clean architecture
3. Add/update tests
4. Update documentation
5. Run quality checks: `npm run lint && npm run test`
6. Submit pull request

### Database Changes
1. Always create migrations for schema changes
2. Test triggers and functions thoroughly
3. Document performance implications
4. Update relevant documentation

## Support

### Documentation
- [Database Schema](database/schema.md) - Complete database documentation
- [Triggers](database/triggers.md) - Duplicate detection logic
- [Setup Commands](database/setup.md) - All npm commands reference
- [Google Cloud Setup](../GOOGLE_CLOUD_VISION_SETUP.md) - GCP configuration guide
- [Content Dictionary](modules/content/README.md) - Centralized content system

### Troubleshooting
- Check [Setup Guide](database/setup.md#troubleshooting) for common issues
- Verify environment variables are correctly configured
- Ensure database triggers and indexes are installed: `npm run db:setup`

## Future Roadmap

### Planned Features
- Additional bank support (Bancolombia, BBVA, Davivienda)
- Real-time processing with WebSockets
- Advanced validation with ML
- Export functionality
- Batch file processing

### Scalability Considerations
- Microservice architecture
- Queue-based processing
- Database partitioning
- Cloud storage integration