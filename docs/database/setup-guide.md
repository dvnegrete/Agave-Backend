# 🗄️ Database Setup Guide - Agave Payment Management v3.0+

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración Inicial](#configuración-inicial)
3. [Estructura de la Base de Datos](#estructura-de-la-base-de-datos)
4. [Migraciones](#migraciones)
5. [Usuario Sistema Automático](#usuario-sistema-automático)
6. [Tablas Principales](#tablas-principales)
7. [Relaciones entre Entidades](#relaciones-entre-entidades)

---

## Requisitos Previos

- **PostgreSQL 12+** instalado y ejecutándose
- **Node.js 18+**
- **npm** o **yarn**
- Acceso de administrador a la base de datos PostgreSQL

---

## Configuración Inicial

### 1. Crear la Base de Datos Limpia

Primero, crea una base de datos vacía en PostgreSQL:

```bash
# Conectarse a PostgreSQL con el usuario postgres
psql -U postgres

# En la consola de PostgreSQL:
CREATE DATABASE agave_db ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';

# Verificar creación
\l
# Deberías ver 'agave_db' en la lista

# Salir
\q
```

### 2. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env` y configura la conexión:

```bash
cp .env.example .env
```

Edita `.env` con tus parámetros de PostgreSQL:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password_here
DB_NAME=agave_db

# TypeORM Configuration
TYPEORM_SYNCHRONIZE=false
TYPEORM_LOGGING=true
```

### 3. Instalar Dependencias

```bash
npm install
# o
yarn install
```

---

## Estructura de la Base de Datos

### Arquitectura General

La base de datos Agave está organizada en **3 módulos principales**:

```
┌─────────────────────────────────────────┐
│      TRANSACCIONES BANCARIAS            │
│  (Integración con sistemas bancarios)   │
├─────────────────────────────────────────┤
│ • transactions_bank (transacciones)     │
│ • transaction_status (validación)       │
│ • last_transaction_bank (rastreo)       │
│ • manual_validation_approvals (auditoría)
└─────────────────────────────────────────┘
            ↓ Reconciliación
┌─────────────────────────────────────────┐
│       VOUCHERS Y CASAS                  │
│    (Gestión de propiedades)             │
├─────────────────────────────────────────┤
│ • houses (casas)                        │
│ • vouchers (comprobantes)               │
│ • records (registros de pago)           │
│ • house_records (relación N:N)          │
│ • users (usuarios/propietarios)         │
└─────────────────────────────────────────┘
            ↓ Asignación
┌─────────────────────────────────────────┐
│    PAYMENT MANAGEMENT v3.0+             │
│  (Distribución de pagos a conceptos)    │
├─────────────────────────────────────────┤
│ • periods (períodos de facturación)     │
│ • period_config (montos globales)       │
│ • record_allocations (distribución)     │
│ • house_period_overrides (personalización)
│ • house_balances (saldos)               │
│ • cta_* (conceptos: mantenimiento, etc) │
└─────────────────────────────────────────┘
```

---

## Migraciones

### Ejecutar Migraciones

Las migraciones se ejecutan automáticamente al iniciar la aplicación si `TYPEORM_SYNCHRONIZE=false`.

Para ejecutar migraciones manualmente:

```bash
# Ver estado de migraciones
npm run db:migration:show

# Ejecutar migraciones pendientes
npm run db:migration:run

# Revertir última migración
npm run db:migration:revert

# Ejecutar migración específica
npm run db:migration:run -- --name NombreMigracion
```

### Migraciones Importantes (Orden de Ejecución)

1. **Sistema de Transacciones Bancarias**
   - Crea: `transactions_bank`, `transaction_status`, `last_transaction_bank`
   - Fecha: 2024-08-15

2. **Sistema de Vouchers y Casas**
   - Crea: `vouchers`, `houses`, `house_records`, `records`, `users`
   - Fecha: 2024-10-13

3. **Sistema de Payment Management v3.0+** ⭐
   - Crea: `periods`, `period_config`, `record_allocations`, `house_balances`, `house_period_overrides`
   - Fecha: 2025-01-05
   - **Más reciente y crítica para la funcionalidad actual**

4. **Manual Validation System**
   - Crea: `manual_validation_approvals`
   - Fecha: 2024-11-17

---

## Usuario Sistema Automático

### ¿Qué es el Usuario Sistema?

El Usuario Sistema es una cuenta automática creada para procesos internos del sistema como:
- Conciliación bancaria automática
- Asignación automática de transacciones a casas
- Procesos de auditoría

**UUID:** `00000000-0000-0000-0000-000000000000`
**Email:** `sistema@conciliacion.local`
**Role:** `tenant`
**Estado:** `active`

### Inicialización Automática

El Usuario Sistema se crea automáticamente cuando la aplicación inicia:

```bash
npm run start
```

El proceso de inicialización ocurre en:
- **Archivo:** `src/shared/database/seeds/system-user.seed.ts`
- **Punto de Entrada:** `DatabaseModule` (método `onModuleInit()`)
- **Comportamiento:** No bloquea el inicio si hay errores (log warning)

### Verificación Manual

Si necesitas crear/recrear el Usuario Sistema manualmente:

```bash
# Ejecutar script SQL directamente
psql -U postgres -d agave_db -f src/shared/database/scripts/ensure-system-user.sql
```

**Script:** `/src/shared/database/scripts/ensure-system-user.sql`
- Usa `INSERT ... ON CONFLICT` para idempotencia
- Verifica creación automáticamente
- Seguro para ejecutar múltiples veces

---

## Tablas Principales

### 1. Transacciones Bancarias (`transactions_bank`)

Almacena todas las transacciones importadas desde bancos.

```sql
CREATE TABLE transactions_bank (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  time TIME NOT NULL,
  concept VARCHAR(225),
  amount FLOAT,
  is_deposit BOOLEAN,
  currency VARCHAR(255),
  bank_name TEXT,                      -- ⭐ IMPORTANTE para identificar banco origen
  confirmation_status BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Campos Clave:**
- `bank_name`: Identificador del banco (Santander, BBVA, etc.)
- `is_deposit`: `true` = depósito, `false` = retiro
- `confirmation_status`: Estado de validación/confirmación

---

### 2. Períodos de Facturación (`periods`)

Define períodos mensuales para la gestión de pagos.

```sql
CREATE TABLE periods (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL (1-12),
  start_date DATE GENERATED ALWAYS AS (make_date(year, month, 1)) STORED,
  end_date DATE GENERATED ALWAYS AS (
    make_date(year, month + 1, 1) - INTERVAL '1 day'
  ) STORED,
  period_config_id INT FK -> period_config(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,

  UNIQUE(year, month)
);
```

**Características:**
- Fechas (`start_date`, `end_date`) se calculan automáticamente
- Un período único por mes/año
- Vinculado a configuración de montos

---

### 3. Configuración de Período (`period_config`)

Define los montos y reglas aplicables globalmente a un período.

```sql
CREATE TABLE period_config (
  id SERIAL PRIMARY KEY,
  default_maintenance_amount FLOAT DEFAULT 800,
  default_water_amount FLOAT DEFAULT 200,
  default_extraordinary_fee_amount FLOAT DEFAULT 1000,
  payment_due_day INT DEFAULT 10,
  late_payment_penalty_amount FLOAT DEFAULT 100,
  effective_from DATE,
  effective_until DATE,                -- NULL = sin fecha de vencimiento
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Propósito:**
- Montos globales aplicados a **TODAS** las casas
- Base para cálculo de deudas mensuales
- Modificable sin afectar período (tiene efectividad temporal)

---

### 4. Asignaciones de Registros (`record_allocations`)

Distribuye un pago entre conceptos específicos.

```sql
CREATE TABLE record_allocations (
  id SERIAL PRIMARY KEY,
  record_id INT FK -> records(id) CASCADE,
  house_id INT FK -> houses(id) CASCADE,
  period_id INT FK -> periods(id) NO ACTION,
  concept_type ENUM (maintenance, water, extraordinary_fee, penalties, other),
  allocated_amount FLOAT,              -- Monto pagado
  expected_amount FLOAT,               -- Monto esperado
  payment_status ENUM (complete, partial, overpaid),
  created_at TIMESTAMP
);
```

**Ejemplo de Asignación:**
```
Pago recibido: $125,000 (Voucher#123)
  ├─ Mantenimiento: $75,000 / $100,000 → PARTIAL (faltan $25k)
  ├─ Agua: $50,000 / $50,000 → COMPLETE
  └─ Excedente: $0 → se aplica a accumulated_cents
```

---

### 5. Saldos de Casa (`house_balances`)

Rastreo de créditos y deudas acumuladas.

```sql
CREATE TABLE house_balances (
  id SERIAL PRIMARY KEY,
  house_id INT UNIQUE FK -> houses(id) CASCADE,
  accumulated_cents FLOAT DEFAULT 0,   -- Fracciones 0.00-0.99
  credit_balance FLOAT DEFAULT 0,      -- Saldo a favor
  debit_balance FLOAT DEFAULT 0,       -- Deuda acumulada
  updated_at TIMESTAMP,

  CONSTRAINT pk_house_balance UNIQUE(house_id)
);
```

**Campos:**
- `credit_balance`: Dinero que la casa tiene a favor
- `debit_balance`: Dinero que la casa debe
- `accumulated_cents`: Centavos que se aplican cada cierto período (PENDIENTE: definir lógica)

---

### 6. Tablas de Conceptos (`cta_*`)

Definen los conceptos de pago individuales por período.

```sql
-- Conceptos principales
CREATE TABLE cta_maintenance (id, amount, period_id, created_at, updated_at);
CREATE TABLE cta_water (id, amount, period_id, created_at, updated_at);
CREATE TABLE cta_extraordinary_fee (id, amount, period_id, created_at, updated_at);

-- Conceptos opcionales
CREATE TABLE cta_penalties (id, amount, period_id, description, created_at, updated_at);
CREATE TABLE cta_other_payments (id, amount, description, pending_confirmation, created_at, updated_at);
```

**Relación:**
- Cada CTA está vinculada a un `period_id` (excepto otros pagos)
- Los CTAs son apuntados por `record_allocations`
- No deben eliminarse si hay asignaciones activas (constraint NO ACTION)

---

## Relaciones entre Entidades

### Flujo Completo de un Pago

```
1. Transacción Bancaria
   ↓ (via transaction_status)
2. Validación y Reconciliación
   ↓ (via records)
3. Creación de Voucher
   ↓ (via house_records)
4. Asignación a Casa y Período
   ↓ (via record_allocations)
5. Distribución a Conceptos
   ├─ CTA_Maintenance
   ├─ CTA_Water
   ├─ CTA_ExtraordinaryFee
   ├─ CTA_Penalties
   └─ CTA_OtherPayments
   ↓
6. Actualización de Saldos (house_balances)
```

### Diagram ER Simplificado

```
┌────────────────┐
│    periods     │◄─────────┐
└────────────────┘          │
       │ 1:N                │
       │             ┌──────────────┐
       │             │period_config │
       │             └──────────────┘
       │
   ┌───┴────────────────────┬─────────────────┬──────────────┐
   │                        │                 │              │
 1:N                      1:N               1:N            1:N
   │                        │                 │              │
   ▼                        ▼                 ▼              ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│cta_maint... │  │cta_water     │  │cta_extraor..│  │cta_penalties │
└─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘
   │                   │                   │              │
   │                   │                   │              │
   └─────┬─────────────┴───────────────────┴──────────────┘
         │ N:1 (concept_id)
         │
   ┌─────▼──────────────┐
   │record_allocations  │
   └────────────────────┘
         │ N:1
         │
   ┌─────▼───────┐      ┌──────────────┐
   │   records   │──────│   vouchers   │
   └─────────────┘      └──────────────┘
         │ N:N              │
         └────┬─────────────┘
              │ (house_records)
              │ N:N
         ┌────▼──────┐
         │  houses   │◄─────┐
         └───────────┘      │ 1:1
              │        ┌─────┴──────────┐
              │        │house_balances  │
              │        └────────────────┘
              │
         (usuarios)
```

---

## Scripts SQL Útiles

### Verificar Estado de la Base de Datos

```sql
-- Total de registros por tabla
SELECT
  schemaname,
  tablename,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = schemaname) as total_tables
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

-- Verificar Usuario Sistema
SELECT id, email, role, status FROM users
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Contar períodos
SELECT COUNT(*) as total_periods, MAX(year) as ultimo_year FROM periods;

-- Ver últimas transacciones
SELECT id, date, time, amount, bank_name, is_deposit
FROM transactions_bank
ORDER BY created_at DESC LIMIT 10;
```

### Limpiar Base de Datos (⚠️ CUIDADO - Destruye datos)

```bash
# ADVERTENCIA: Elimina TODOS los datos
npm run db:drop
npm run db:migration:run

# O manualmente en PostgreSQL:
psql -U postgres -d agave_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run start
```

---

## Troubleshooting

### Problema: "Database does not exist"

**Solución:**
```bash
# Crear base de datos manualmente
psql -U postgres -c "CREATE DATABASE agave_db;"

# Luego ejecutar migraciones
npm run db:migration:run
```

### Problema: "User sistema not created"

**Solución:**
```bash
# Ejecutar seed manualmente
npm run db:seed:system-user

# O ejecutar script SQL
psql -U postgres -d agave_db -f src/shared/database/scripts/ensure-system-user.sql
```

### Problema: "Foreign key constraint violation"

**Verificar integridad:**
```sql
-- Ver constraints activos
SELECT constraint_name, table_name FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY';

-- Deshabilitar temporalmente (NO RECOMENDADO en producción)
ALTER TABLE table_name DISABLE TRIGGER ALL;
```

---

## Mantenimiento

### Backups Regulares

```bash
# Crear backup
pg_dump -U postgres agave_db > agave_backup.sql

# Restaurar desde backup
psql -U postgres agave_db < agave_backup.sql
```

### Monitoreo

```sql
-- Tamaño de la base de datos
SELECT pg_size_pretty(pg_database_size('agave_db'));

-- Tamaño por tabla
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Índices no usados
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

---

## Documentación Relacionada

- [Índices de la Base de Datos](./indexes.md)
- [Triggers y Funciones](./triggers.md)
- [README Principal del Proyecto](../../README.md)

---

**Última actualización:** Enero 2025
**Versión:** 3.0+ (Payment Management)
