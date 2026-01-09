# Database Setup & Configuration

## Overview

Este documento describe la configuración completa de la base de datos del proyecto Agave, incluyendo comandos npm, configuración de entorno, y procesos para configurar una base de datos limpia desde cero.

## Table of Contents

1. [Configurar una Base de Datos Limpia](#configurar-una-base-de-datos-limpia)
2. [NPM Commands Reference](#npm-commands-reference)
3. [Environment Configuration](#environment-configuration)
4. [Development Workflow](#development-workflow)
5. [Database Schema Files](#database-schema-files)
6. [Troubleshooting](#troubleshooting)

---

## Configurar una Base de Datos Limpia

**Estado actual del proyecto:** El sistema está en la versión **3.1.0** con soporte completo de Payment Management y Manual Validation Audit Trail.

### Prerrequisitos

Antes de comenzar, asegúrate de tener:

1. **PostgreSQL instalado y corriendo**
   - PostgreSQL 12 o superior (recomendado: PostgreSQL 14+)
   - Acceso como usuario con privilegios de creación de bases de datos
   - Cliente `psql` instalado y accesible desde terminal

2. **Credenciales de acceso**
   - Host (ej: `localhost`, `mydb.railway.app`)
   - Puerto (por defecto: `5432`)
   - Usuario con permisos de CREATE DATABASE
   - Contraseña del usuario

3. **Node.js y dependencias**
   - Node.js 18 o superior
   - Dependencias del proyecto instaladas (`npm install`)

### Paso 1: Crear la Base de Datos PostgreSQL

Conéctate a PostgreSQL y crea una nueva base de datos:

```bash
# Conectar a PostgreSQL como usuario postgres
psql -U postgres

# Dentro de psql, crear la base de datos
CREATE DATABASE agave_db;

# Crear usuario dedicado (opcional pero recomendado)
CREATE USER agave_user WITH PASSWORD 'tu_password_seguro';

# Otorgar privilegios
GRANT ALL PRIVILEGES ON DATABASE agave_db TO agave_user;

# Salir de psql
\q
```

**Alternativa con comando directo**:
```bash
# Crear base de datos directamente
createdb -U postgres agave_db

# Crear usuario
psql -U postgres -c "CREATE USER agave_user WITH PASSWORD 'tu_password_seguro';"

# Otorgar privilegios
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE agave_db TO agave_user;"
```

### Paso 2: Configurar Variables de Entorno

Crea o edita el archivo `.env` en la raíz del proyecto backend:

```bash
# Navegar al directorio del proyecto
cd /ruta/a/agave-backend

# Crear archivo .env (si no existe)
touch .env
```

Agrega las siguientes variables:

```env
# Configuración de Base de Datos
DATABASE_PROVIDER=local
DATABASE_URL=postgresql://agave_user:tu_password_seguro@localhost:5432/agave_db

# Componentes individuales (opcionales, solo si no usas DATABASE_URL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=agave_user
DB_PASSWORD=tu_password_seguro
DB_NAME=agave_db

# Ambiente
NODE_ENV=development
```

**Para bases de datos remotas** (Supabase, Railway, etc.):

```env
# Supabase
DATABASE_PROVIDER=supabase
DATABASE_URL=postgresql://usuario:password@db.host.supabase.co:5432/postgres?sslmode=require

# Railway
DATABASE_PROVIDER=production
DATABASE_URL=postgresql://usuario:password@containers-us-west-xyz.railway.app:5432/railway?sslmode=require

# Producción genérica
DATABASE_PROVIDER=production
DATABASE_URL=postgresql://usuario:password@host:port/database?sslmode=require
```

### Paso 3: Verificar Conexión a la Base de Datos

Antes de continuar, verifica que puedes conectarte:

```bash
# Cargar variables de entorno y probar conexión
source .env
psql "$DATABASE_URL" -c "SELECT version();"
```

Deberías ver la versión de PostgreSQL. Si hay error, revisa:
- Credenciales correctas
- Base de datos existe
- PostgreSQL está corriendo
- Firewall/red permite conexión

### Paso 4: Crear Esquema Completo de Base de Datos

Ejecuta el script que crea todas las tablas, ENUMs, índices y datos iniciales:

```bash
npm run db:push
```

Este comando ejecuta el archivo `bd_initial.sql` (versión 3.1.0) que crea:

- **6 ENUMs** (role_t, status_t, validation_status_t, record_allocations_concept_type_enum, record_allocations_payment_status_enum, house_period_overrides_concept_type_enum)
- **22 Tablas**:
  - Core: `users`, `houses`
  - Transacciones: `transactions_bank`, `vouchers`, `transactions_status`, `last_transaction_bank`, `manual_validation_approvals`
  - Registros: `records`, `house_records`, `record_allocations`
  - Períodos: `periods`, `period_config`
  - Cuentas: `cta_maintenance`, `cta_water`, `cta_extraordinary_fee`, `cta_penalties`, `cta_other_payments`
  - Balances: `house_balances`, `house_period_overrides`
- **Foreign keys** (~30 relaciones con cascade policies)
- **Índices de performance** (~30 índices optimizados)
- **Datos iniciales**:
  - Usuario Sistema (ID: `00000000-0000-0000-0000-000000000000`, email: `sistema@conciliacion.local`)
  - Configuración de período por defecto (mantenimiento: $800, agua: $200, extraordinaria: $1000)

**Salida esperada**:
```
CREATE TYPE
CREATE TYPE
...
CREATE TABLE
CREATE TABLE
...
INSERT 0 1
```

### Paso 5: Instalar Triggers e Índices Adicionales

Configura funciones SQL, triggers e índices optimizados:

```bash
npm run db:setup
```

Este comando instala:

1. **Trigger de detección de duplicados**
   - Función: `check_transaction_duplicate()`
   - Trigger: `trigger_check_transaction_duplicate`
   - Aplica a: `transactions_bank`

2. **Índices de optimización**
   - `idx_transactions_bank_deposits_unconfirmed` (índice parcial para depósitos no confirmados)

### Paso 6: Verificar Configuración Completa

Ejecuta los siguientes comandos para validar la instalación:

```bash
# 1. Contar tablas creadas (debe ser 22)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# 2. Verificar usuario del sistema existe
psql "$DATABASE_URL" -c "SELECT id, mail, role, status FROM users WHERE id = '00000000-0000-0000-0000-000000000000';"

# 3. Verificar configuración de período inicial
psql "$DATABASE_URL" -c "SELECT id, default_maintenance_amount, default_water_amount, default_extraordinary_fee_amount, payment_due_day, is_active FROM period_config WHERE is_active = true;"

# 4. Listar todas las tablas de Payment Management
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE 'period%' OR tablename LIKE 'house_balance%' OR tablename LIKE 'house_period%' OR tablename LIKE 'record_allocation%');"

# 5. Verificar tabla de validación manual existe
psql "$DATABASE_URL" -c "\d manual_validation_approvals"

# 6. Verificar ENUMs de Payment Management
psql "$DATABASE_URL" -c "SELECT typname FROM pg_type WHERE typname IN ('record_allocations_concept_type_enum', 'record_allocations_payment_status_enum', 'house_period_overrides_concept_type_enum');"

# 7. Verificar triggers instalados
psql "$DATABASE_URL" -c "SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_check_transaction_duplicate';"

# 8. Verificar índices de performance
psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'transactions_bank';"
```

**Verificaciones esperadas**:
- 22 tablas en el schema `public`
- Usuario sistema con mail `sistema@conciliacion.local` y role `tenant`
- Configuración de período con `is_active = true` (mantenimiento: 800, agua: 200, extraordinaria: 1000)
- Tablas `periods`, `period_config`, `house_balances`, `house_period_overrides`, `record_allocations` creadas
- Tabla `manual_validation_approvals` creada con índices
- 3 ENUMs de Payment Management creados
- Trigger `trigger_check_transaction_duplicate` habilitado
- Índices `idx_transactions_bank_deposits_unconfirmed` y otros creados

### Paso 7: Iniciar la Aplicación

Con la base de datos configurada, puedes iniciar el backend:

```bash
# Desarrollo con auto-reload
npm run start:dev

# Producción
npm run build
npm run start:prod
```

**Verificación de conexión en logs**:
```
[DatabaseModule] Database connection established
[SystemUserSeed] ✅ Usuario Sistema ya existe: sistema@conciliacion.local
[NestApplication] Nest application successfully started
```

### Resumen de Comandos (Setup Completo)

```bash
# 1. Crear base de datos PostgreSQL
createdb -U postgres agave_db

# 2. Configurar .env
echo "DATABASE_URL=postgresql://agave_user:password@localhost:5432/agave_db" > .env
echo "DATABASE_PROVIDER=local" >> .env
echo "NODE_ENV=development" >> .env

# 3. Verificar conexión
source .env && psql "$DATABASE_URL" -c "SELECT version();"

# 4. Crear esquema completo (v3.1.0)
npm run db:push

# 5. Instalar triggers e índices
npm run db:setup

# 6. Verificar instalación
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
psql "$DATABASE_URL" -c "SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000';"
psql "$DATABASE_URL" -c "SELECT * FROM period_config WHERE is_active = true;"

# 7. Iniciar aplicación
npm run start:dev
```

### Troubleshooting del Setup

#### Error: "database does not exist"

```bash
# Verificar que la base de datos existe
psql -U postgres -c "\l" | grep agave_db

# Si no existe, crearla
createdb -U postgres agave_db
```

#### Error: "role does not exist"

```bash
# Crear el usuario
psql -U postgres -c "CREATE USER agave_user WITH PASSWORD 'password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE agave_db TO agave_user;"
```

#### Error: "permission denied for schema public"

```bash
# Otorgar permisos sobre el schema
psql -U postgres agave_db -c "GRANT ALL ON SCHEMA public TO agave_user;"
psql -U postgres agave_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agave_user;"
```

#### Error: "relation already exists"

La base de datos no está limpia. Opciones:

```bash
# Opción 1: Drop y recrear la base de datos
dropdb -U postgres agave_db
createdb -U postgres agave_db
npm run db:push

# Opción 2: Limpiar el schema
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:push
```

#### Error: "psql: command not found"

Instala el cliente PostgreSQL:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Windows
# Descargar desde https://www.postgresql.org/download/windows/
```

---

## NPM Commands Reference

### Core Database Operations

#### `npm run db:init`
Inicializa la base de datos usando script shell.
```bash
npm run db:init
# Ejecuta: bash scripts/init-db.sh
```

#### `npm run db:deploy`
Ejecuta migraciones TypeORM pendientes (producción y desarrollo).
```bash
npm run db:deploy
# Ejecuta: npm run typeorm migration:run -- -d src/shared/config/datasource.ts
```

**Cuándo usar**: Base de datos existente con migraciones pendientes.

#### `npm run db:dev`
Ejecuta migraciones TypeORM en desarrollo (alias de `db:deploy`).
```bash
npm run db:dev
```

#### `npm run db:generate`
Genera nueva migración TypeORM basada en cambios de entidades.
```bash
npm run db:generate
# Ejecuta: npm run typeorm migration:generate -- -d src/shared/config/datasource.ts
```

**Workflow típico**:
1. Modificar una entidad en `src/shared/database/entities/`
2. Ejecutar `npm run db:generate`
3. Revisar migración generada en `src/shared/database/migrations/`
4. Aplicar con `npm run db:deploy`

#### `npm run db:push`
Ejecuta script SQL completo para **crear base de datos desde cero**.
```bash
npm run db:push
# Ejecuta: psql $DATABASE_URL -f bd_initial.sql
```

**IMPORTANTE**: Crea todas las tablas desde cero. Solo usar para:
- Base de datos completamente nueva
- Reset completo de base de datos de desarrollo
- Primera instalación del proyecto

**NO usar para**: Base de datos existente con datos (usar migraciones).

### Triggers Management

#### `npm run db:install-triggers`
Instala función y trigger de detección de duplicados en `transactions_bank`.
```bash
npm run db:install-triggers
```

**Instala**:
- Función SQL: `check_transaction_duplicate()`
- Trigger: `trigger_check_transaction_duplicate`

**Reglas de negocio implementadas**:
- Bloqueo de transacciones con fecha anterior al último registro
- Detección de duplicados exactos (date + time + concept + amount + bank_name)
- Validación por banco (permite inserciones de bancos diferentes)

#### `npm run db:test-triggers`
Ejecuta suite de pruebas para validar funcionamiento de triggers.
```bash
npm run db:test-triggers
```

### Indexes Management

#### `npm run db:install-indexes`
Instala índices de optimización de performance.
```bash
npm run db:install-indexes
```

**Instala**:
- `idx_transactions_bank_deposits_unconfirmed`: Índice parcial para depósitos no confirmados (optimiza `WHERE is_deposit = true AND confirmation_status = false`)

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

#### `npm run db:ensure-system-user`
Verifica y crea el usuario Sistema requerido para conciliación bancaria.
```bash
npm run db:ensure-system-user
```

### Combined Operations

#### `npm run db:setup`
Comando principal que ejecuta configuración completa de triggers e índices.
```bash
npm run db:setup
# Equivalente a:
# npm run db:install-triggers && npm run db:install-indexes
```

**Recomendado para**:
- Configuración inicial después de `npm run db:push`
- Reinstalación después de reset de BD
- Despliegue en nuevos entornos

---

## Environment Configuration

### Database Provider Options

El proyecto soporta múltiples proveedores configurables mediante `DATABASE_PROVIDER`:

- **`local`**: PostgreSQL local sin SSL
- **`supabase`**: Supabase con SSL habilitado
- **`production`**: Base de datos de producción con SSL
- **default**: PostgreSQL genérico

### Required Variables

```env
# Proveedor de base de datos
DATABASE_PROVIDER=local

# URL de conexión completa (recomendado)
DATABASE_URL=postgresql://user:password@host:port/database

# Componentes individuales (opcionales, solo si no usas DATABASE_URL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_NAME=agave_db

# Ambiente
NODE_ENV=development
```

### Database URL Format

```
postgresql://[user[:password]@][host][:port][/database][?param1=value1&...]
```

### Examples by Environment

#### Local Development
```env
DATABASE_PROVIDER=local
DATABASE_URL=postgresql://postgres:password@localhost:5432/agave_dev
NODE_ENV=development
```

#### Supabase
```env
DATABASE_PROVIDER=supabase
DATABASE_URL=postgresql://postgres:password@db.xyz.supabase.co:5432/postgres?sslmode=require
NODE_ENV=production
```

#### Railway
```env
DATABASE_PROVIDER=production
DATABASE_URL=postgresql://postgres:password@containers-us-west-xyz.railway.app:5432/railway?sslmode=require
NODE_ENV=production
```

### Connection Pool Configuration

El proyecto implementa connection pooling optimizado según ambiente:

**Production**:
- Max connections: 20
- Max query queue: 100
- Idle timeout: 30s
- Connection timeout: 5s

**Development**:
- Max connections: 5
- Max query queue: 50
- Idle timeout: 10s
- Connection timeout: 3s

**Default**:
- Max connections: 10
- Max query queue: 50
- Idle timeout: 20s
- Connection timeout: 4s

Configurado en `src/shared/config/database.config.ts`.

---

## Development Workflow

### Initial Setup - New Database

Para configurar una **base de datos nueva desde cero**:

```bash
# 1. Clonar proyecto
git clone <repo>
cd agave-backend

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con credenciales de BD

# 4. Crear base de datos PostgreSQL
createdb -U postgres agave_db

# 5. Ejecutar script de BD inicial
npm run db:push

# 6. Configurar triggers e índices
npm run db:setup

# 7. Verificar configuración
npm run db:check-transactions
psql $DATABASE_URL -c "SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000';"
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

---

## Database Schema Files

### bd_initial.sql - Complete Schema Script

Archivo de esquema completo de la base de datos.

**Ubicación**: `/bd_initial.sql` (raíz del proyecto)
**Versión actual**: 3.1.0
**Última actualización**: Noviembre 14, 2025

**Contenido**:
1. 6 ENUMs (role_t, status_t, validation_status_t, record_allocations_concept_type_enum, record_allocations_payment_status_enum, house_period_overrides_concept_type_enum)
2. 22 Tablas
3. ~30 Foreign Keys con cascade policies
4. ~30 Índices de performance
5. Usuario Sistema (ID: 00000000-0000-0000-0000-000000000000)
6. Configuración de período inicial (mantenimiento: $800, agua: $200, extraordinaria: $1000)

**Características v3.1.0**:
- Sistema completo de Payment Management (periods, period_config, house_balances, house_period_overrides, record_allocations)
- Sistema de validación manual con auditoría (manual_validation_approvals)
- Normalización 3NF para eliminar redundancia
- Soporte para convenios de pago personalizados
- Gestión automática de centavos y balances

**Cuándo usar**:
- Configurar una base de datos completamente nueva
- Reset de base de datos de desarrollo
- Crear un entorno de pruebas desde cero

**NO usar para**:
- Actualizar base de datos existente (usar `npm run db:deploy`)
- Agregar nuevas tablas (crear migraciones)

### agave-database.dbml - Visual Schema Design

Archivo de esquema en formato DBML para visualización.

**Ubicación**: `/agave-database.dbml`
**Herramienta**: Compatible con [DrawDB](https://www.drawdb.app/)

**Cómo visualizar**:
1. Abrir https://www.drawdb.app/
2. Click en "Import" → "DBML"
3. Copiar contenido de `agave-database.dbml`
4. Visualizar diagrama completo

### Migrations Directory

Migraciones TypeORM generadas automáticamente.

**Ubicación**: `src/shared/database/migrations/`

**Migraciones ejecutadas (11 total)**:
- `1729113600000-add-house-record-table-and-update-relations.ts`: Tabla house_records (Oct 2024)
- `1729622400000-add-voucher-amount-constraint.ts`: Constraints de vouchers (Oct 2024)
- `1731590000000-AddManualValidationFields.ts`: Validación manual (Nov 2024)
- `1731600000000-CreateSystemUser.ts`: Usuario Sistema (Nov 2024)
- `1761855700765-PaymentManagementFeature.ts`: Sistema completo de gestión de pagos (Ene 2025)
- `1761860000000-EnsureSystemUser.ts`: Garantizar usuario sistema (Ene 2025)

**Última migración ejecutada**: 5 de enero de 2025 (Payment Management v3.0+)

---

## Database Module Structure

### Module Configuration

**Archivo**: `src/shared/database/database.module.ts`

El módulo de base de datos es un módulo global (`@Global()`) que exporta:

**Entidades** (22):
- Core: `User`, `House`, `HouseRecord`
- Transacciones: `TransactionBank`, `Voucher`, `TransactionStatus`, `LastTransactionBank`, `ManualValidationApproval`
- Registros: `Record`, `RecordAllocation`
- Períodos: `Period`, `PeriodConfig`
- Balances: `HouseBalance`, `HousePeriodOverride`
- Cuentas (CTA): `CtaMaintenance`, `CtaWater`, `CtaExtraordinaryFee`, `CtaPenalties`, `CtaOtherPayments`

**Repositorios** (12):
- `TransactionBankRepository`, `LastTransactionBankRepository`, `VoucherRepository`, `TransactionStatusRepository`
- `RecordRepository`, `HouseRepository`, `HouseRecordRepository`, `UserRepository`
- `CtaMaintenanceRepository`, `CtaWaterRepository`, `CtaPenaltiesRepository`, `CtaExtraordinaryFeeRepository`

**Servicios**:
- `DatabaseConfigService`: Configuración de conexión (local, supabase, production)
- `SystemUserSeed`: Seed automático del usuario Sistema (ID: 00000000-0000-0000-0000-000000000000)
- `EnsureHouseExistsService`: Servicio compartido para garantizar existencia de casas

**Características del Sistema**:
- Connection pooling optimizado por ambiente (5-20 conexiones)
- Seed automático del usuario Sistema al iniciar
- Soporte multi-proveedor (local, Supabase, Railway, producción)
- Gestión de casas automática con usuario Sistema
- Sistema de períodos con configuración flexible

### Entities Overview

**Core**:
- `User`: Usuarios del sistema (tenants, admins)
- `House`: Propiedades del condominio (1-66)

**Transacciones Bancarias**:
- `TransactionBank`: Transacciones bancarias importadas
- `LastTransactionBank`: Última transacción procesada por banco
- `TransactionStatus`: Estado de procesamiento de transacciones
- `Voucher`: Comprobantes de pago
- `ManualValidationApproval`: Aprobaciones manuales

**Registros**:
- `Record`: Registros de pagos/cargos
- `HouseRecord`: Relación casa-registro
- `RecordAllocation`: Asignación de pagos a conceptos

**Períodos y Configuración**:
- `Period`: Períodos mensuales (year/month)
- `PeriodConfig`: Configuración de montos por período

**Cuentas**:
- `CtaMaintenance`: Cargos de mantenimiento
- `CtaWater`: Cargos de agua
- `CtaExtraordinaryFee`: Cargos extraordinarios
- `CtaPenalties`: Penalidades
- `CtaOtherPayments`: Otros pagos

**Balances**:
- `HouseBalance`: Balance acumulado por casa
- `HousePeriodOverride`: Sobrescritura de montos para casa/período

### Services

#### DatabaseConfigService

**Ubicación**: `src/shared/config/database.config.ts`

Gestiona configuración de conexión según proveedor:

**Métodos principales**:
- `getDatabaseConfig()`: Retorna configuración según `DATABASE_PROVIDER`
- `getConnectionString()`: Construye connection string
- `getTypeOrmConfig()`: Configuración completa de TypeORM con pooling

**Proveedores soportados**:
- `supabase`: Supabase con SSL
- `local`: PostgreSQL local sin SSL
- `production`: Producción con SSL
- `default`: PostgreSQL genérico

#### SystemUserSeed

**Ubicación**: `src/shared/database/seeds/system-user.seed.ts`

Seed que se ejecuta automáticamente al iniciar la aplicación (`OnModuleInit`).

**Responsabilidades**:
- Verificar si el usuario Sistema existe
- Crear el usuario Sistema si no existe
- Logging de estado

**Usuario Sistema**:
- ID: `00000000-0000-0000-0000-000000000000`
- Email: `sistema@conciliacion.local`
- Role: `tenant`
- Status: `active`

**Usado por**:
- Conciliación bancaria (casas identificadas por centavos)
- Registros históricos (casas creadas automáticamente)
- Confirmación de vouchers

#### EnsureHouseExistsService

**Ubicación**: `src/shared/database/services/ensure-house-exists.service.ts`

Servicio compartido para garantizar la existencia de una casa.

**Métodos**:
- `execute(houseNumber, options)`: Busca o crea una casa

**Opciones**:
- `createIfMissing`: Si `true`, crea la casa; si `false`, lanza error
- `userId`: ID del propietario (default: `SYSTEM_USER_ID`)
- `queryRunner`: Para ejecutar dentro de transacciones

**Usado por**:
- BankReconciliation
- HistoricalRecords
- Vouchers

**Validaciones**:
- Número de casa entre 1-66
- Casa existe o se puede crear

### Functions & Triggers

#### Duplicate Detection

**Ubicación**: `src/shared/database/functions/duplicate_detection.sql`

Función SQL y trigger para detectar transacciones bancarias duplicadas.

**Componentes**:
- Función: `check_transaction_duplicate()`
- Trigger: `trigger_check_transaction_duplicate`
- Aplica a: `transactions_bank` (BEFORE INSERT)

**Reglas**:
1. Fecha más reciente: Registro debe tener fecha >= última transacción en `last_transaction_bank`
2. Verificación de banco: Si banco es diferente, permite todas las inserciones
3. Comparación en mismo día: Detección profunda cuando fecha es igual
4. Duplicado exacto: Bloquea si todos los campos son iguales (date, time, concept, amount, bank_name)

**Comportamiento**:
- Permitir inserción: Sin registros previos, banco diferente, fecha posterior, no duplicado exacto
- Ignorar inserción: Fecha anterior o duplicado exacto (retorna `NULL` silenciosamente)

**Documentación completa**: `src/shared/database/functions/README.md`

### Indexes

#### deposits_unconfirmed_index

**Ubicación**: `src/shared/database/indexes/deposits_unconfirmed_index.sql`

Índice parcial para optimizar consultas de depósitos no confirmados.

**Definición**:
```sql
CREATE INDEX idx_transactions_bank_deposits_unconfirmed
ON transactions_bank (is_deposit, confirmation_status)
WHERE is_deposit = true AND confirmation_status = false;
```

**Optimiza**:
```sql
SELECT * FROM transactions_bank
WHERE is_deposit = true AND confirmation_status = false;
```

---

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
sudo service postgresql status

# Verificar credenciales en .env
cat .env | grep DATABASE

# Verificar firewall/network access
telnet localhost 5432
```

#### 3. Permission denied

```bash
# Verificar permisos del usuario
psql -U postgres -c "\du"

# Otorgar permisos
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE agave_db TO agave_user;"
psql -U postgres agave_db -c "GRANT ALL ON SCHEMA public TO agave_user;"
```

#### 4. .env not loading

Los comandos npm ya cargan `.env` automáticamente:
```bash
bash -c 'set -a && source .env && set +a && psql "$DATABASE_URL" ...'
```

Si ejecutas `psql` manualmente:
```bash
source .env
psql "$DATABASE_URL" -c "SELECT version();"
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

# Verificar instalación de triggers
psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE proname = 'check_transaction_duplicate';"

# Verificar índices
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'transactions_bank';"
```

### Advanced Operations

#### Custom SQL Execution

```bash
# Ejecutar archivo SQL custom
bash -c 'set -a && source .env && psql "$DATABASE_URL" -f my_script.sql'

# Ejecutar comando SQL directo
bash -c 'set -a && source .env && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM transactions_bank;"'
```

#### Backup & Restore

```bash
# Backup
bash -c 'set -a && source .env && pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql'

# Restore
bash -c 'set -a && source .env && psql "$DATABASE_URL" < backup.sql'
```

#### Performance Monitoring

```bash
# Estadísticas de índices
bash -c 'set -a && source .env && psql "$DATABASE_URL" -c "SELECT * FROM pg_stat_user_indexes WHERE relname = '\''transactions_bank'\'';"'

# Estadísticas de triggers
bash -c 'set -a && source .env && psql "$DATABASE_URL" -c "SELECT * FROM pg_stat_user_functions WHERE funcname = '\''check_transaction_duplicate'\'';"'
```

### Reset Completo de Base de Datos

Si necesitas empezar desde cero (**DESTRUYE TODOS LOS DATOS**):

```bash
# 1. Backup (opcional pero recomendado)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Drop todas las tablas
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Re-ejecutar script
npm run db:push

# 4. Configurar triggers e índices
npm run db:setup

# 5. Verificar
psql $DATABASE_URL -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

---

## Script Files Reference

### Locations

```
bd_initial.sql                           # Schema completo (v3.0.0)

scripts/
├── init-db.sh                           # Inicialización de BD
└── install-triggers.sh                  # Instalación manual de triggers

src/shared/database/functions/
├── duplicate_detection.sql              # Función y trigger principal
├── install_duplicate_detection.sql      # Script de instalación (deprecado)
└── test_duplicate_detection.sql         # Suite de pruebas

src/shared/database/indexes/
└── deposits_unconfirmed_index.sql       # Índice parcial principal

src/shared/database/scripts/
└── ensure-system-user.sql               # Script manual para crear usuario Sistema

src/shared/database/migrations/
└── *.ts                                 # Migraciones TypeORM generadas

src/shared/database/entities/
└── *.entity.ts                          # Entidades TypeORM

src/shared/database/repositories/
└── *.repository.ts                      # Repositorios personalizados

src/shared/database/seeds/
└── system-user.seed.ts                  # Seed automático del usuario Sistema

src/shared/database/services/
└── ensure-house-exists.service.ts       # Servicio compartido
```

### Manual Execution

Si prefieres ejecutar scripts manualmente:

```bash
# Cargar variables de entorno
source .env

# Ejecutar script específico
psql "$DATABASE_URL" -f src/shared/database/functions/duplicate_detection.sql
psql "$DATABASE_URL" -f src/shared/database/indexes/deposits_unconfirmed_index.sql
psql "$DATABASE_URL" -f src/shared/database/scripts/ensure-system-user.sql
```

---

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
# El código usa: ${DATABASE_URL/\\?pgbouncer=true/}
```

#### 3. SSL/TLS Issues

```bash
# Agregar a DATABASE_URL: ?sslmode=require
# O para desarrollo local: ?sslmode=disable
```

---

## Related Documentation

- **Documentation Index**: `docs/database/README.md` (start here for navigation)
- **Schema Documentation**: `docs/database/schema.md` (v3.1 complete reference with version history)
- **Schema Visualization**: `docs/database/schema-visualization.md`
- **Triggers Documentation**: `docs/database/triggers.md`
- **Indexes Documentation**: `docs/database/indexes.md`
- **Connection Pool**: `docs/database/CONNECTION-POOL-IMPLEMENTATION.md`
- **Payment Management**: `docs/database/payment-management.md` (v3.0+)
- **Payment Management Migrations**: `docs/features/payment-management/MIGRATIONS.md`
- **Usuario Sistema Setup**: `docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md`

---

## Version History

- **v3.1.0** (Noviembre 2025): Manual validation audit trail, normalización 3NF
- **v3.0.0** (Noviembre 2025): Sistema completo de Payment Management
- **v2.0.0** (Octubre 2024): Tabla house_records para múltiples registros por casa
- **v1.0.0** (Septiembre 2024): Schema inicial con transacciones bancarias y vouchers
