# Estado Actual del Sistema de Autenticación

## ✅ Fortalezas Identificadas

### 1. Infraestructura de Supabase
- ✅ Supabase Auth ya integrado (`@supabase/supabase-js` v2.54.0)
- ✅ Clientes Supabase configurados (anon + service role)
- ✅ Variables de entorno bien organizadas

### 2. Servicio de Autenticación
- ✅ AuthService implementado con métodos principales:
  - `signUp()` - Registro de usuarios
  - `signIn()` - Login con credenciales
  - `signInWithOAuth()` - OAuth (Google, Facebook, GitHub, etc.)
  - `refreshToken()` - Renovación de tokens
  - `signOut()` - Cierre de sesión
  - `getCurrentUser()` - Obtener usuario actual
  - `handleOAuthCallback()` - Manejo de callback OAuth

### 3. Seguridad
- ✅ AuthGuard implementado para proteger rutas
- ✅ Validación de Bearer tokens en headers
- ✅ CurrentUser decorator para inyectar usuario en controladores
- ✅ Control de errores (UnauthorizedException, BadRequestException)

### 4. Estructura de Datos
- ✅ Entidad User en PostgreSQL con campos:
  - id (UUID primario)
  - role (enum: admin, owner, tenant)
  - status (enum: active, suspend, inactive)
  - name, email, cel_phone
  - avatar, last_login, observations
  - timestamps (created_at, updated_at)

### 5. API Endpoints
- ✅ POST `/auth/signup` - Registrar usuario
- ✅ POST `/auth/signin` - Login
- ✅ POST `/auth/oauth/signin` - Iniciar OAuth
- ✅ GET `/auth/oauth/callback` - Callback OAuth
- ✅ POST `/auth/refresh` - Renovar tokens
- ✅ POST `/auth/signout` - Logout
- ✅ GET `/auth/me` - Obtener perfil actual
- ✅ GET `/auth/providers` - Listar proveedores OAuth

### 6. Relaciones de Datos
- ✅ Relación User → Houses (uno a muchos)
- ✅ Relación User → ManualValidationApprovals (uno a muchos)

---

## ❌ Carencias y Gaps

### 1. Sistema de Privilegios Incompleto
- ❌ Roles limitados: Solo Admin, Owner, Tenant
- ❌ Falta: Empleado, Proveedor, y otros roles sugeridos
- ❌ Sin sistema de permisos granular (capabilities/permissions)
- ❌ Sin matriz de permisos por rol
- ❌ Sin guards basados en roles (RoleGuard)
- ❌ Sin guards basados en permisos (PermissionGuard)

### 2. Sincronización Supabase ↔ PostgreSQL
- ❌ Usuario de Supabase Auth no se sincroniza automáticamente con tabla users
- ❌ Sin webhook de Supabase para crear/actualizar usuarios locales
- ❌ Sin manejo de eliminación de usuarios
- ❌ Sin campo supabase_id en tabla users para hacer join

### 3. Relaciones Contextuales
- ❌ Sin tabla de asignación usuario → casa → rol
- ❌ Sin forma de definir que un inquilino pertenece a una casa específica
- ❌ Sin forma de definir que un empleado trabaja para un propietario
- ❌ Sin guards de acceso contextual (ej: inquilino solo ve su casa)

### 4. Sistema de Invitaciones
- ❌ Sin sistema de invitación de empleados/proveedores
- ❌ Sin códigos de invitación únicos
- ❌ Sin emails de invitación
- ❌ Sin validación de invitaciones

### 5. Gestión de Usuarios
- ❌ Sin endpoint para crear usuarios como Admin
- ❌ Sin endpoint para cambiar rol de usuario
- ❌ Sin endpoint para listar usuarios con filtros
- ❌ Sin servicio de gestión de usuarios (UserService)

### 6. Audit y Logging
- ❌ Sin registro de intentos de acceso
- ❌ Sin registro de cambios de rol/permisos
- ❌ Sin campo login_count en tabla users
- ❌ Sin campo verification_status para verificación de email

### 7. Metadatos Personalizados
- ❌ User metadata de Supabase no se utiliza
- ❌ Sin custom claims para roles y contexto
- ❌ Sin sincronización de metadata entre Supabase y PostgreSQL

---

## 📊 Comparativa: Actual vs Necesario

| Aspecto | Actual | Necesario |
|---------|:------:|:---------:|
| Roles definidos | 3 | 5-7 |
| Sistema de permisos | No | Sí |
| Guards basados en roles | No | Sí |
| Guards basados en permisos | No | Sí |
| Guards de contexto | No | Sí |
| Sincronización Supabase | Parcial | Completa |
| Invitaciones de usuarios | No | Sí |
| Gestión de usuarios | Mínima | Completa |
| Audit/Logging | No | Sí |
| Relaciones usuario-casa | Básica | Completa |

---

## 🔍 Impacto en Otros Módulos

Módulos que se verían afectados por cambios en autenticación:

### Alto Impacto
- **payment-management**: Control de acceso a pagos
- **bank-reconciliation**: Control de acceso a reconciliaciones
- **historical-records**: Control de lectura de registros históricos

### Medio Impacto
- **vouchers**: Control de acceso a comprobantes
- **transactions-bank**: Control de acceso a transacciones

### Bajo Impacto
- **google-cloud**: Solo afecta autenticación de credenciales
- **openai**: No usa autenticación de usuarios

---

## 💭 Consideraciones Importantes

1. **Backward Compatibility**: Cualquier cambio debe mantener los usuarios existentes funcionales
2. **Datos Existentes**: Necesidad de migración para usuarios actuales
3. **Testing**: Requiere tests completos de RBAC y permisos
4. **Performance**: Validación de permisos debe ser eficiente
5. **Seguridad**: Nunca confiar en datos del cliente, validar siempre en backend

---

## 📋 Próximos Pasos

1. Revisar [02-PRIVILEGE-HIERARCHY.md](../design/02-PRIVILEGE-HIERARCHY.md)
2. Revisar [03-DATA-ARCHITECTURE.md](../design/03-DATA-ARCHITECTURE.md)
3. Completar [DECISION-POINTS.md](../DECISION-POINTS.md)
4. Validar diseño propuesto
5. Proceder con implementación en fases

---

**Archivo**: `docs/auth/analysis/01-CURRENT-STATE.md`
**Actualizado**: 2025-01-11
