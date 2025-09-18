# Agave Backend Documentation

## Overview

Documentación completa del backend de Agave, incluyendo arquitectura, features, base de datos y configuración.

## Table of Contents

### 🏗️ Architecture
- [Project Structure](../CLAUDE.md) - Estructura del proyecto y comandos principales
- [Clean Architecture](features/transactions-bank/README.md#architecture) - Patrón de arquitectura implementado

### 💾 Database
- [**Schema & Tables**](database/schema.md) - Estructura de tablas y relaciones
- [**Triggers & Functions**](database/triggers.md) - Lógica automática de duplicados
- [**Indexes & Optimization**](database/indexes.md) - Optimización de performance
- [**Setup & Commands**](database/setup.md) - Comandos npm y configuración

### 🏦 Features

#### Transactions Bank
- [**Feature Overview**](features/transactions-bank/README.md) - Módulo completo de transacciones bancarias
- [API Endpoints](features/transactions-bank/README.md#api-endpoints) - REST API documentation
- [Business Logic](features/transactions-bank/README.md#business-logic) - Reglas de negocio
- [File Processing](features/transactions-bank/README.md#supported-formats) - Formatos soportados

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
│   └── transactions-bank/   # Bank transaction processing
├── shared/                  # Shared utilities and services
│   ├── database/           # Database layer
│   │   ├── entities/       # TypeORM entities
│   │   ├── repositories/   # Data access layer
│   │   ├── functions/      # SQL functions & triggers
│   │   └── indexes/        # Database indexes
│   └── config/             # Configuration management
```

### Database Design
- **PostgreSQL**: Primary database
- **TypeORM**: ORM with migrations
- **SQL Functions**: Database-level business logic
- **Partial Indexes**: Performance optimization

## Database Schema Overview

### Core Tables
- `transactions_bank`: Main transactions storage
- `last_transaction_bank`: Processing reference tracking

### Automatic Features
- **Duplicate Detection**: SQL trigger prevents duplicates
- **Performance Optimization**: Partial indexes for common queries
- **Reference Tracking**: Incremental processing support

## API Overview

### Transactions Bank Endpoints
```http
POST   /transactions-bank/upload         # Upload bank statement file
GET    /transactions-bank                # Get all transactions
GET    /transactions-bank/:id            # Get specific transaction
GET    /transactions-bank/status/:status # Get by status
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

# External services (if used)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
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