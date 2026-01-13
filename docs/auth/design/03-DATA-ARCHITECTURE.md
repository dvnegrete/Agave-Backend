# Arquitectura de Datos para Autenticación y Privilegios

## 📐 Diseño General

```
┌─────────────────────────────────────────────────────────────┐
│ Supabase Auth (auth.users)                                  │
│ - Email                                                      │
│ - Password (hashed)                                          │
│ - user_metadata: {role, houseId, status, ...}              │
└─────────────────────┬───────────────────────────────────────┘
                      │ (Link via supabase_id)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│ PostgreSQL: users table                                      │
│ - id (UUID, PK)                                              │
│ - supabase_id (UUID, FK → Supabase)                          │
│ - email, name, phone_number                                  │
│ - avatar, status, last_login                                │
├─────────────────────────────────────────────────────────────┤
│ Relaciones:                                                  │
│ - users → houses (one-to-many)                             │
│ - users → user_house_assignments (one-to-many)             │
│ - users → contractor_assignments (one-to-many)             │
│ - users → role_permissions (many-to-many)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗃️ Tablas Propuestas en PostgreSQL

### 1. Tabla: `roles`

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(50) UNIQUE NOT NULL,
  -- Ejemplos: 'admin', 'propietario', 'inquilino', 'empleado', 'proveedor'

  level INT NOT NULL,
  -- Niveles jerárquicos (0=admin, 1=propietario, 2=inquilino, 3=empleado, 4=proveedor)
  -- Usado para validaciones rápidas de jerarquía

  description TEXT,
  -- Descripción legible del rol

  is_system_role BOOLEAN DEFAULT FALSE,
  -- Si es un rol del sistema (no se puede eliminar)

  max_houses INT DEFAULT NULL,
  -- Null = sin límite; 1 = máximo 1 casa; usado para propietarios

  requires_approval BOOLEAN DEFAULT FALSE,
  -- Si la asignación requiere aprobación de admin

  can_delegate BOOLEAN DEFAULT FALSE,
  -- Si los usuarios con este rol pueden delegar a otros usuarios

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(name)
);

-- Índices
CREATE INDEX idx_roles_level ON roles(level);
CREATE INDEX idx_roles_name ON roles(name);
```

---

### 2. Tabla: `permissions`

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(100) UNIQUE NOT NULL,
  -- Ejemplos: 'view_payments', 'approve_payments', 'manage_users'
  -- Formato: recurso_acción (snake_case)

  resource VARCHAR(50) NOT NULL,
  -- Categoría del permiso: 'payments', 'users', 'reports', 'properties'

  action VARCHAR(50) NOT NULL,
  -- Acción: 'read', 'create', 'update', 'delete', 'approve'

  description TEXT,
  -- Descripción del permiso

  is_system BOOLEAN DEFAULT FALSE,
  -- Si es un permiso del sistema

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(resource, action),
  CHECK (action IN ('read', 'create', 'update', 'delete', 'approve'))
);

-- Índices
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_name ON permissions(name);
```

---

### 3. Tabla: `role_permissions` (many-to-many)

```sql
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (role_id, permission_id)
);

-- Índices
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
```

---

### 4. Tabla: `user_house_assignments`

```sql
CREATE TABLE user_house_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,

  role_id UUID NOT NULL REFERENCES roles(id),
  -- El rol que tiene el usuario en ESTA casa específica

  assigned_by_id UUID REFERENCES users(id),
  -- Quién asignó este rol (para auditoría)

  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ DEFAULT NULL,
  -- NULL = asignación activa; fecha = asignación expirada/removida

  notes TEXT,
  -- Notas sobre la asignación (ej: "Temporal hasta 2025-12-31")

  is_active BOOLEAN GENERATED ALWAYS AS (removed_at IS NULL) STORED,

  UNIQUE(user_id, house_id),
  UNIQUE(user_id, house_id, role_id) -- Evitar duplicados
);

-- Índices
CREATE INDEX idx_user_house_user ON user_house_assignments(user_id);
CREATE INDEX idx_user_house_house ON user_house_assignments(house_id);
CREATE INDEX idx_user_house_role ON user_house_assignments(role_id);
CREATE INDEX idx_user_house_active ON user_house_assignments(is_active) WHERE is_active;
```

---

### 5. Tabla: `contractor_assignments`

```sql
CREATE TABLE contractor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  contractor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- El empleado o proveedor

  owner_id UUID NOT NULL REFERENCES users(id),
  -- El propietario que lo contrató

  role_id UUID NOT NULL REFERENCES roles(id),
  -- 'empleado' o 'proveedor'

  description VARCHAR(255),
  -- Descripción del trabajo: "Jardinero", "Fontanero", etc.

  services TEXT[],
  -- Array de servicios: ['jardinería', 'mantenimiento_general']

  verified BOOLEAN DEFAULT FALSE,
  -- Si el contratista ha sido verificado por el admin

  verification_date TIMESTAMPTZ,
  verified_by_id UUID REFERENCES users(id),

  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NULL,
  -- NULL = sin vencimiento; fecha = vencimiento automático

  is_active BOOLEAN GENERATED ALWAYS AS (
    valid_until IS NULL OR valid_until > NOW()
  ) STORED,

  notes TEXT,

  UNIQUE(contractor_id, owner_id)
);

-- Índices
CREATE INDEX idx_contractor_user ON contractor_assignments(contractor_id);
CREATE INDEX idx_contractor_owner ON contractor_assignments(owner_id);
CREATE INDEX idx_contractor_active ON contractor_assignments(is_active) WHERE is_active;
```

---

### 6. Tabla: `user_invitations`

```sql
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  invitation_code VARCHAR(64) UNIQUE NOT NULL,
  -- Código único para la invitación

  email VARCHAR(255) NOT NULL,
  -- Email del usuario a invitar

  role_id UUID NOT NULL REFERENCES roles(id),
  -- Rol que tendrá después de aceptar

  house_id UUID REFERENCES houses(id),
  -- Casa si es relevante (null para admins)

  invited_by_id UUID NOT NULL REFERENCES users(id),
  -- Quién envió la invitación

  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'accepted', 'expired', 'revoked'
  -- CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  -- Invitaciones válidas por 7 días

  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES users(id),
  -- El usuario que aceptó la invitación

  notes TEXT,

  metadata JSONB DEFAULT '{}'
);

-- Índices
CREATE INDEX idx_invitations_code ON user_invitations(invitation_code);
CREATE INDEX idx_invitations_email ON user_invitations(email);
CREATE INDEX idx_invitations_status ON user_invitations(status);
CREATE INDEX idx_invitations_expires ON user_invitations(expires_at);
```

---

### 7. Tabla: `audit_logs`

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES users(id),
  -- Quién realizó la acción (NULL si es sistema)

  action VARCHAR(50) NOT NULL,
  -- 'login', 'logout', 'role_change', 'permission_grant', 'user_created', etc.

  resource_type VARCHAR(50) NOT NULL,
  -- 'user', 'role', 'permission', 'house'

  resource_id UUID,
  -- ID del recurso afectado

  details JSONB,
  -- Detalles adicionales de la acción

  ip_address INET,
  user_agent TEXT,

  status VARCHAR(50) DEFAULT 'success',
  -- 'success', 'failure', 'unauthorized'

  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT audit_logs_check CHECK (
    status IN ('success', 'failure', 'unauthorized')
  )
);

-- Índices
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

---

## 📝 Cambios a Tabla Existente `users`

```sql
ALTER TABLE users ADD COLUMN (
  supabase_id UUID UNIQUE NOT NULL,
  -- Link con auth.users de Supabase

  phone_number VARCHAR(20) UNIQUE,
  -- Teléfono de contacto

  verification_status VARCHAR(50) DEFAULT 'unverified',
  -- 'unverified', 'verified', 'rejected', 'pending_approval'
  -- CHECK (verification_status IN ('unverified', 'verified', 'rejected', 'pending_approval'))

  login_count INT DEFAULT 0,
  -- Contador de logins

  last_login_ip INET,
  -- IP del último login

  last_login_user_agent TEXT,
  -- User agent del último login

  is_verified_email BOOLEAN DEFAULT FALSE,
  -- Si el email ha sido verificado

  verified_email_at TIMESTAMPTZ,

  two_factor_enabled BOOLEAN DEFAULT FALSE,
  -- Si el usuario tiene 2FA habilitado

  preferred_language VARCHAR(10) DEFAULT 'es'
);

-- Índices nuevos
CREATE INDEX idx_users_supabase_id ON users(supabase_id);
CREATE INDEX idx_users_verification ON users(verification_status);
CREATE INDEX idx_users_email_verified ON users(is_verified_email);
```

---

## 🔗 Relaciones Visuales

### Usuario Individual en Múltiples Casas

```
users (Juan, id=123)
    ├── user_house_assignments
    │   ├── house_id=A, role_id=propietario
    │   ├── house_id=B, role_id=inquilino
    │   └── house_id=C, role_id=empleado
    │
    └── contractor_assignments
        ├── owner_id=456 (propietario de otra casa)
        └── role_id=proveedor
```

---

### Estructura Completa de Casa

```
houses (Casa_A, id=uuid1)
    ├── house_balance
    ├── transactions_bank
    ├── records
    │
    └── user_house_assignments
        ├── user_id=prop1, role_id=propietario
        ├── user_id=tenant1, role_id=inquilino
        ├── user_id=tenant2, role_id=inquilino
        ├── user_id=emp1, role_id=empleado
        └── user_id=prov1, role_id=proveedor
```

---

## 📊 Estadísticas Esperadas

### Ejemplo de Data Inicial

```sql
-- Roles
INSERT INTO roles (name, level, description, is_system_role, can_delegate) VALUES
('admin', 0, 'Administrator', true, true),
('propietario', 1, 'House Owner', true, true),
('gestor_financiero', 2, 'Financial Manager', true, false),
('inquilino', 3, 'Tenant/Resident', true, false),
('empleado', 4, 'Employee', true, false),
('proveedor', 5, 'Service Provider', true, false);

-- Permissions (ejemplos)
INSERT INTO permissions (name, resource, action, description) VALUES
('view_payments', 'payments', 'read', 'Ver pagos'),
('create_payment', 'payments', 'create', 'Crear pago'),
('approve_payments', 'payments', 'approve', 'Aprobar pagos'),
('manage_users', 'users', 'update', 'Gestionar usuarios'),
...
```

---

## 🛡️ Consideraciones de Seguridad

### 1. Integridad Referencial
- Usar ON DELETE CASCADE donde sea apropiado
- Usar ON DELETE RESTRICT para datos críticos
- Foreign keys en todas las relaciones

### 2. Validaciones
- CHECK constraints en enums
- Validaciones de datos en aplicación
- Índices en campos frecuentemente consultados

### 3. Auditoría
- Tabla `audit_logs` para tracking de cambios
- Created/Updated timestamps en todas las tablas
- Quién hizo qué y cuándo

### 4. Privacidad
- Encriptar datos sensibles (phone_number, etc.)
- Usar hashed passwords (manejado por Supabase)
- Maskear datos en logs

---

## 🚀 Estrategia de Migración

### Fase 1: Crear Nuevas Tablas
```bash
npm run typeorm migration:generate -- -d src/shared/config/datasource.ts
npm run typeorm migration:run -- -d src/shared/config/datasource.ts
```

### Fase 2: Sincronizar Usuarios Existentes
- Mapear usuarios existentes con sus IDs de Supabase
- Crear asignaciones usuario→casa con roles existentes
- Validar integridad de datos

### Fase 3: Crear Roles y Permisos Base
- Insertar roles estándar
- Insertar permisos base
- Asignar permisos a roles

---

## 📝 Próximos Pasos

1. Revisar [04-AUTHENTICATION-FLOW.md](./04-AUTHENTICATION-FLOW.md)
2. Revisar [05-COMPONENTS.md](../architecture/05-COMPONENTS.md)
3. Crear migraciones TypeORM
4. Implementar servicios de sincronización

---

**Archivo**: `docs/auth/design/03-DATA-ARCHITECTURE.md`
**Actualizado**: 2025-01-11
**Estado**: Propuesta - Pendiente revisión de base de datos
