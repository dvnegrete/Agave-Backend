# Database Setup & Commands

## Overview

Este documento describe todos los comandos npm disponibles para gestionar la base de datos, triggers, índices y configuración del proyecto.

## Quick Start

### Complete Database Setup
```bash
# Configuración completa (triggers + índices)
npm run db:setup
```

Este comando ejecuta automáticamente:
1. Instalación de triggers de detección de duplicados
2. Instalación de índices de optimización

## NPM Commands Reference

### Core Database Operations

#### `npm run db:init`
Inicializa la base de datos usando script shell.
```bash
npm run db:init
# Ejecuta: bash scripts/init-db.sh
```

#### `npm run db:deploy`
Ejecuta migraciones TypeORM en producción.
```bash
npm run db:deploy
# Ejecuta: npm run typeorm migration:run -- -d src/shared/config/datasource.ts
```

#### `npm run db:dev`
Ejecuta migraciones TypeORM en desarrollo.
```bash
npm run db:dev
# Equivalente a db:deploy para desarrollo
```

#### `npm run db:generate`
Genera nueva migración TypeORM basada en cambios de entidades.
```bash
npm run db:generate
# Ejecuta: npm run typeorm migration:generate -- -d src/shared/config/datasource.ts
```

#### `npm run db:push`
Ejecuta script SQL directo en la base de datos.
```bash
npm run db:push
# Ejecuta: psql $DATABASE_URL -f bd_initial.sql
```

### Triggers Management

#### `npm run db:install-triggers`
Instala función y trigger de detección de duplicados.
```bash
npm run db:install-triggers
```

**Instala:**
- Función `check_transaction_duplicate()`
- Trigger `trigger_check_transaction_duplicate`
- Aplicado a tabla `transactions_bank`

#### `npm run db:test-triggers`
Ejecuta suite de pruebas para validar funcionamiento de triggers.
```bash
npm run db:test-triggers
```

**Pruebas incluidas:**
- Inserción de primera transacción
- Detección de duplicados exactos
- Transacciones con campos diferentes
- Diferentes bancos y fechas

### Indexes Management

#### `npm run db:install-indexes`
Instala índices de optimización de performance.
```bash
npm run db:install-indexes
```

**Instala:**
- `idx_transactions_bank_deposits_unconfirmed` (índice parcial)
- Optimización para depósitos no confirmados

### Schema Inspection

#### `npm run db:check-schema`
Muestra estructura de tabla `last_transaction_bank`.
```bash
npm run db:check-schema
```

#### `npm run db:check-transactions`
Muestra estructura de tabla `transactions_bank`.
```bash
npm run db:check-transactions
```

### Combined Operations

#### `npm run db:setup` ⭐
Comando principal que ejecuta configuración completa.
```bash
npm run db:setup
# Equivalente a:
# npm run db:install-triggers && npm run db:install-indexes
```

**Recomendado para:**
- Configuración inicial de proyecto
- Reinstalación después de reset de BD
- Despliegue en nuevos entornos

## Environment Configuration

### Required Variables

```env
# Primary database connection
DATABASE_URL=postgresql://user:password@host:port/database

# Alternative for specific tools (si es diferente)
DIRECT_URL=postgresql://user:password@host:port/database
```

### Database URL Format

```
postgresql://[user[:password]@][host][:port][/database][?param1=value1&...]
```

**Ejemplos:**
```env
# Local development
DATABASE_URL=postgresql://postgres:password@localhost:5432/agave_dev

# Railway (production)
DATABASE_URL=postgresql://postgres:password@host.railway.app:5432/railway?sslmode=require

# Con parámetros adicionales
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require&connect_timeout=10
```

## Connection Testing

### Test Database Connection
```bash
# Verificar conexión básica
psql $DATABASE_URL -c "SELECT version();"

# Con variables de entorno cargadas
bash -c 'set -a && source .env && psql $DATABASE_URL -c "SELECT version();"'
```

### Common Connection Issues

#### 1. Variable no configurada
```bash
# Error: psql: error: invalid URI
# Solución: Verificar .env file
echo $DATABASE_URL
```

#### 2. Parámetros incompatibles
```bash
# Error: invalid URI query parameter: "pgbouncer"
# Solución: Los comandos ya filtran este parámetro automáticamente
```

#### 3. SSL/TLS Issues
```bash
# Agregar a DATABASE_URL: ?sslmode=require
# O para desarrollo local: ?sslmode=disable
```

## Development Workflow

### Initial Setup
```bash
# 1. Clonar proyecto
git clone <repo>
cd agave-backend

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con credenciales de BD

# 4. Configurar base de datos
npm run db:setup

# 5. Ejecutar migraciones (si existen)
npm run db:deploy

# 6. Verificar configuración
npm run db:check-transactions
```

### Regular Development
```bash
# Al hacer cambios en entidades
npm run db:generate

# Aplicar migraciones
npm run db:dev

# Reinstalar triggers/índices si es necesario
npm run db:setup
```

### Production Deployment
```bash
# 1. Aplicar migraciones
npm run db:deploy

# 2. Configurar triggers e índices
npm run db:setup

# 3. Verificar configuración
npm run db:check-schema
npm run db:check-transactions
```

## Troubleshooting

### Common Issues

#### 1. Command not found: psql
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Windows
# Instalar PostgreSQL desde sitio oficial
```

#### 2. Connection refused
```bash
# Verificar que la BD está corriendo
# Verificar credenciales en .env
# Verificar firewall/network access
```

#### 3. Permission denied
```bash
# Verificar usuario tiene permisos
# Verificar rol de usuario en PostgreSQL
# Verificar que usuario puede crear funciones/triggers
```

#### 4. .env not loading
```bash
# Los comandos ya cargan .env automáticamente con:
# set -a && source .env && set +a
```

### Debugging Commands

#### Show loaded environment
```bash
# Verificar variables (sin mostrar valores sensibles)
bash -c 'source .env && env | grep -E "DATABASE|DIRECT" | sed "s/=.*$/=***/"'
```

#### Test specific components
```bash
# Solo triggers
npm run db:install-triggers
npm run db:test-triggers

# Solo índices
npm run db:install-indexes

# Verificar instalación
psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname = 'check_transaction_duplicate';"
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'transactions_bank';"
```

## Advanced Usage

### Custom SQL Execution
```bash
# Ejecutar archivo SQL custom
bash -c 'set -a && source .env && psql "$DATABASE_URL" -f my_script.sql'

# Ejecutar comando SQL directo
bash -c 'set -a && source .env && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM transactions_bank;"'
```

### Backup & Restore
```bash
# Backup
bash -c 'set -a && source .env && pg_dump "$DATABASE_URL" > backup.sql'

# Restore
bash -c 'set -a && source .env && psql "$DATABASE_URL" < backup.sql'
```

### Performance Monitoring
```bash
# Estadísticas de índices
bash -c 'set -a && source .env && psql "$DATABASE_URL" -c "SELECT * FROM pg_stat_user_indexes WHERE relname = '\''transactions_bank'\'';"'

# Estadísticas de triggers
bash -c 'set -a && source .env && psql "$DATABASE_URL" -c "SELECT * FROM pg_stat_user_functions WHERE funcname = '\''check_transaction_duplicate'\'';"'
```

## Script Files Reference

### Locations
```
scripts/
├── init-db.sh                           # Inicialización de BD
└── install-triggers.sh                  # Instalación manual de triggers

src/shared/database/functions/
├── duplicate_detection.sql              # Función y trigger principal
├── install_duplicate_detection.sql      # Script de instalación (deprecado)
└── test_duplicate_detection.sql        # Suite de pruebas

src/shared/database/indexes/
└── deposits_unconfirmed_index.sql      # Índice parcial principal
```

### Manual Execution
Si prefieres ejecutar scripts manualmente:

```bash
# Cargar variables de entorno
source .env

# Ejecutar script específico
psql "$DATABASE_URL" -f src/shared/database/functions/duplicate_detection.sql
psql "$DATABASE_URL" -f src/shared/database/indexes/deposits_unconfirmed_index.sql
```