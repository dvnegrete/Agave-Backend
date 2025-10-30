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

#### `npm run db:push` ⭐
Ejecuta script SQL completo para **crear base de datos desde cero**.
```bash
npm run db:push
# Ejecuta: psql $DATABASE_URL -f bd_initial.sql
```

**⚠️ IMPORTANTE**: Este comando crea **todas las tablas desde cero**. Solo úsalo para:
- Base de datos completamente nueva
- Reset completo de base de datos de desarrollo
- Primera instalación del proyecto

**Incluye**:
- 18 tablas del sistema (users, houses, vouchers, transactions, periods, etc.)
- Tablas de payment management (period_config, house_balances, etc.)
- ENUMs (role_t, status_t, validation_status_t, payment_enums)
- Foreign keys y constraints
- Índices de performance
- Usuario del sistema (00000000-0000-0000-0000-000000000000)
- Configuración inicial de períodos

**Para bases de datos existentes, usa**: `npm run db:deploy` (migraciones)

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

### Initial Setup - New Database

Si estás configurando una **base de datos nueva desde cero**:

```bash
# 1. Clonar proyecto
git clone <repo>
cd agave-backend

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con credenciales de BD

# 4. Ejecutar script de BD inicial (crea todas las tablas)
npm run db:push
# Ejecuta: psql $DATABASE_URL -f bd_initial.sql
# Esto crea:
#   - Todas las tablas (users, houses, transactions_bank, vouchers, etc.)
#   - ENUMs (role_t, status_t, validation_status_t, payment_management_enums)
#   - Foreign keys y constraints
#   - Índices de performance
#   - Usuario del sistema (requerido)
#   - Configuración inicial de períodos

# 5. Configurar triggers e índices adicionales
npm run db:setup

# 6. Verificar configuración
npm run db:check-transactions
psql $DATABASE_URL -c "SELECT * FROM period_config WHERE is_active = true;"
```

### Initial Setup - Existing Database

Si ya tienes una base de datos y solo necesitas aplicar nuevas migraciones:

```bash
# 1. Clonar proyecto
git clone <repo>
cd agave-backend

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con credenciales de BD

# 4. Ejecutar migraciones pendientes
npm run db:deploy

# 5. Configurar triggers e índices
npm run db:setup

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

## Database Schema Files

### bd_initial.sql - Complete Schema Script

El archivo `bd_initial.sql` en la raíz del proyecto contiene el **esquema completo de la base de datos**.

**Ubicación**: `/bd_initial.sql`
**Versión actual**: 3.0.0 (Octubre 30, 2025)

### agave-database.dbml - Visual Schema Design

El archivo `agave-database.dbml` contiene el esquema en formato DBML para visualización.

**Ubicación**: `/agave-database.dbml`
**Versión**: 3.0.0 (Octubre 30, 2025)
**Herramienta**: Compatible con [DrawDB](https://www.drawdb.app/)

**Cómo usar**:
1. Abre https://www.drawdb.app/
2. Click en "Import" → "DBML"
3. Copia el contenido de `agave-database.dbml`
4. Visualiza el diagrama completo de la base de datos

**Incluye**:
- 18 tablas con todas sus columnas
- 6 ENUMs
- 27 relaciones (foreign keys)
- Índices documentados
- Comentarios y notas en cada tabla
- Agrupación por funcionalidad (Core, Banking, Records, Billing, Charges)

### Overview de bd_initial.sql

### ¿Cuándo usar bd_initial.sql?

**✅ Úsalo para**:
- Configurar una base de datos completamente nueva
- Reset de base de datos de desarrollo
- Crear un entorno de pruebas desde cero
- Entender la estructura completa del sistema

**❌ NO lo uses para**:
- Actualizar base de datos existente → usa `npm run db:deploy`
- Agregar nuevas tablas → crea migraciones con `npm run db:generate`
- Base de datos en producción con datos → usa migraciones

### Contenido del Script

El script incluye **en orden**:

1. **ENUMs** (6 tipos)
   - role_t, status_t, validation_status_t
   - record_allocations_concept_type_enum
   - record_allocations_payment_status_enum
   - house_period_overrides_concept_type_enum

2. **Tablas Core** (4 tablas)
   - users, houses

3. **Transacciones y Vouchers** (4 tablas)
   - transactions_bank, vouchers, transactions_status, last_transaction_bank

4. **Registros y Relaciones** (2 tablas)
   - records, house_records

5. **Períodos y Payment Management** (8 tablas)
   - periods, period_config
   - house_balances, house_period_overrides, record_allocations
   - cta_maintenance, cta_water, cta_extraordinary_fee, cta_penalties, cta_other_payments

6. **Foreign Keys** (~27 relaciones)

7. **Índices de Performance** (~26 índices)

8. **Datos Iniciales**
   - Usuario del sistema (required for bank reconciliation)
   - Configuración inicial de período

### Ejecución

**Método 1: Con npm (recomendado)**
```bash
npm run db:push
```

**Método 2: Directamente con psql**
```bash
# Cargar variables de entorno
source .env

# Ejecutar script
psql "$DATABASE_URL" -f bd_initial.sql
```

**Método 3: Con bash (carga automática de .env)**
```bash
bash -c 'set -a && source .env && psql "$DATABASE_URL" -f bd_initial.sql'
```

### Verificación Post-Ejecución

Después de ejecutar el script, verifica:

```bash
# 1. Contar tablas creadas (debe ser 18)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# 2. Verificar usuario del sistema
psql $DATABASE_URL -c "SELECT id, mail, role FROM users WHERE id = '00000000-0000-0000-0000-000000000000';"

# 3. Verificar configuración de período inicial
psql $DATABASE_URL -c "SELECT * FROM period_config WHERE is_active = true;"

# 4. Listar todas las tablas
psql $DATABASE_URL -c "\dt"

# 5. Verificar ENUMs
psql $DATABASE_URL -c "SELECT typname FROM pg_type WHERE typcategory = 'E' ORDER BY typname;"
```

### Changelog

**v3.0.0 (Octubre 30, 2025)**
- ✅ Agregadas 4 tablas de payment management
- ✅ Agregados 3 ENUMs para payment management
- ✅ Modificada tabla periods (columna period_config_id)
- ✅ Agregados 11 índices de performance
- ✅ Agregada configuración inicial de período

**v2.1.0 (Octubre 22, 2025)**
- Soporte para conciliación bancaria
- Persistencia de estados de reconciliación

### Troubleshooting

**Error: relation "X" already exists**
```bash
# La tabla ya existe. Opciones:
# 1. Dropear la tabla existente (⚠️ perderás datos)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS nombre_tabla CASCADE;"

# 2. Usar migraciones en lugar de bd_initial.sql
npm run db:deploy
```

**Error: type "X" already exists**
```bash
# El ENUM ya existe. Opciones:
# 1. Dropear el tipo
psql $DATABASE_URL -c "DROP TYPE IF EXISTS nombre_tipo CASCADE;"

# 2. Skipear y continuar con las tablas
```

**Error: constraint "X" already exists**
```bash
# La constraint ya existe, skipear o recrear tabla
```

### Reset Completo de Base de Datos

Si necesitas empezar desde cero (⚠️ DESTRUYE TODOS LOS DATOS):

```bash
# 1. Backup (opcional pero recomendado)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Drop todas las tablas
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Re-ejecutar script
npm run db:push

# 4. Configurar triggers e índices
npm run db:setup
```

## Script Files Reference

### Locations
```
bd_initial.sql                           # ⭐ Schema completo (v3.0.0)

scripts/
├── init-db.sh                           # Inicialización de BD
└── install-triggers.sh                  # Instalación manual de triggers

src/shared/database/functions/
├── duplicate_detection.sql              # Función y trigger principal
├── install_duplicate_detection.sql      # Script de instalación (deprecado)
└── test_duplicate_detection.sql        # Suite de pruebas

src/shared/database/indexes/
└── deposits_unconfirmed_index.sql      # Índice parcial principal

src/shared/database/migrations/
└── *.ts                                 # Migraciones TypeORM generadas
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