# Supabase Auth SOLO (Sin BD de Supabase)

## ✅ Confirmación: NO Necesitas la BD de Supabase

Si solo usas **Supabase Auth**, puedes ignorar completamente la BD de Supabase.

```
┌─────────────────────────────────────────────┐
│ Supabase Auth (Solo lo que necesitas)       │
│ - Email provider                             │
│ - Google OAuth                              │
│ - JWT tokens                                │
│ - User management                           │
└────────────────┬────────────────────────────┘
                 │
                 ↓ (Solo tokens)
        ┌────────────────────┐
        │ Tu PostgreSQL      │
        │ (tu infraestructura)│
        │ - users            │
        │ - roles            │
        │ - permissions      │
        └────────────────────┘
```

---

## 📋 Variables de Entorno REALMENTE NECESARIAS (Solo 3)

**OLVIDA DATABASE_URL y DIRECT_URL si no usas BD de Supabase.**

Solo necesitas:

```env
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJ0eXA... (200+ caracteres)
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXA... (200+ caracteres)
```

**Eso es TODO.**

---

## 🚀 Configuración Mínima (5 Minutos)

### Paso 1: Ir a Supabase

```
https://app.supabase.com → Tu Proyecto → Settings ⚙️
```

### Paso 2: Copiar 3 Claves

```
Settings → API Settings → Project API keys
├─ Project URL → SUPABASE_URL
├─ anon public → SUPABASE_ANON_KEY
└─ service_role (secret) → SUPABASE_SERVICE_ROLE_KEY
```

### Paso 3: Actualizar .env

```env
SUPABASE_URL=https://abc123xyz456.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...

# Resto de tu configuración
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Paso 4: Verificar

```bash
# Ejecuta el script de verificación (pero ignorará DATABASE_URL)
bash verify-supabase.sh

# O simplemente prueba el backend
npm install
npm run start:dev
```

---

## 📊 Cómo Funciona Sin BD de Supabase

### Flujo de Autenticación

```
1. Usuario hace signup
   ↓
2. AuthService envía credenciales a Supabase Auth
   ↓
3. Supabase Auth valida y crea usuario
   ↓
4. Supabase retorna:
   - user object (id, email, metadata)
   - access_token (JWT)
   - refresh_token
   ↓
5. Tu backend almacena lo que necesite en TU BD
   (opcional - depende de tu lógica)
   ↓
6. Usuario autenticado ✓
```

---

## 🏗️ Tu Arquitectura Actual

```
Supabase Cloud
└─ Auth Service (JWT, emails, OAuth)
   │
   ├─→ Genera tokens
   ├─→ Valida emails
   └─→ Maneja OAuth

Tu Backend (Node.js + NestJS)
└─ Recibe tokens JWT
   ├─→ Valida con Supabase
   └─→ Guarda datos en TU PostgreSQL

Tu PostgreSQL (Local o RDS)
└─ users table
   ├─ id (del JWT de Supabase)
   ├─ email
   ├─ role
   ├─ status
   └─ ... (lo que necesites)
```

---

## 💾 Cómo Sincronizar Usuarios

Si necesitas datos del usuario en tu BD:

### Opción 1: Crear Usuario en Tu BD durante Sign Up

```typescript
// auth.service.ts
async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
  // 1. Crear en Supabase Auth
  const { data, error } = await this.supabaseClient.auth.signUp({
    email: signUpDto.email,
    password: signUpDto.password,
  });

  if (error) throw error;

  // 2. Crear en TU BD (usando el ID de Supabase)
  await this.userRepository.create({
    id: data.user.id,  // ← ID de Supabase
    email: data.user.email,
    role: 'inquilino',
    status: 'active',
  });

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: { id: data.user.id, email: data.user.email },
  };
}
```

### Opción 2: Lazy Create (Crear cuando intenta acceder)

```typescript
// Cuando el usuario intenta hacer algo que requiere roles
async getUserWithRole(userId: string) {
  let user = await this.userRepository.findOne(userId);

  if (!user) {
    // No existe en tu BD, créalo
    user = await this.userRepository.create({
      id: userId,
      email: '...', // del token JWT
      role: 'inquilino',
      status: 'active',
    });
  }

  return user;
}
```

---

## 🔐 ¿Dónde Guardas los Roles y Permisos?

**En TU BD, no en Supabase.**

```
Supabase Auth
└─ Almacena: emails, passwords, OAuth
  └─ NO almacena: roles, permisos, datos específicos

Tu PostgreSQL
└─ Almacena: users, roles, permissions, houses, etc.
  ├─ users table
  │  ├─ id (UUID de Supabase Auth)
  │  ├─ email
  │  ├─ role (propietario, inquilino, etc.)
  │  └─ status
  ├─ roles table (admin, propietario, inquilino, etc.)
  ├─ permissions table
  └─ ... resto de tu modelo
```

---

## 🔄 Flujo Completo (Sin BD de Supabase)

### Signup

```
Usuario → Frontend → Backend (/auth/signup)
                       ↓
                   Supabase Auth
                   (crea usuario)
                       ↓
                   Tu PostgreSQL
                   (guarda rol/permisos)
                       ↓
                   Retorna token JWT
                       ↓
                   Usuario autenticado
```

### Login

```
Usuario → Frontend → Backend (/auth/signin)
                       ↓
                   Supabase Auth
                   (valida credenciales)
                       ↓
                   Retorna token JWT
                       ↓
                   Backend valida en tu BD
                   (verifica rol/status)
                       ↓
                   Usuario autenticado
```

### Acceso a Recurso

```
Petición HTTP
+ Authorization: Bearer [JWT de Supabase]
    ↓
AuthGuard
├─ Valida JWT con Supabase
├─ Extrae user ID
├─ Busca en tu BD
├─ Verifica rol/permisos
└─ Autoriza o rechaza
```

---

## 📝 .env Actualizado (Sin BD de Supabase)

```env
# ===========================
# SUPABASE AUTH (OBLIGATORIO)
# ===========================
SUPABASE_URL=https://abc123xyz456.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi...

# ===========================
# APP CONFIG
# ===========================
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ===========================
# TU POSTGRESQL (No es de Supabase)
# ===========================
DATABASE_URL=postgresql://user:password@localhost:5432/agave
# O si usas Supabase para BD de verdad:
# DATABASE_URL=postgresql://postgres:password@db.abc123.supabase.co:5432/postgres

# ===========================
# Otros servicios
# ===========================
OPENAI_API_KEY=sk-...
# ... resto
```

---

## ✅ Script de Verificación (Ignorará DATABASE_URL)

```bash
bash verify-supabase.sh
```

El script mostrará una advertencia sobre DATABASE_URL, pero no es error:

```
⚠ DATABASE_URL está vacío (opcional)
```

Puedes ignorarlo si no usas BD de Supabase.

---

## 🧪 Verificar que Funciona

### Test 1: Verificar que Supabase Auth conecta

```bash
npm run start:dev
```

**Logs esperados:**
```
✓ Supabase initialized successfully
✓ Application listening on port 3000
```

### Test 2: Probar signup

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Respuesta esperada:**
```json
{
  "accessToken": "eyJ0eXA...",
  "refreshToken": "...",
  "user": {
    "id": "uuid-de-supabase",
    "email": "test@example.com"
  }
}
```

### Test 3: Verificar en Supabase Dashboard

```
Supabase → Authentication → Users
```

Deberías ver el usuario que acabas de crear.

---

## 💡 Resumen: Lo que SÍ y NO Necesitas

### ✅ NECESITAS

```
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- Tu propia BD PostgreSQL
- Tablas de usuarios, roles, permisos en TU BD
```

### ❌ NO NECESITAS

```
- DATABASE_URL de Supabase
- DIRECT_URL de Supabase
- Tablas en Supabase (si solo quieres Auth)
- Row Level Security de Supabase
- Webhooks de Supabase
```

---

## 🔗 Próximos Pasos

1. **Configurar Supabase Auth**: Solo las 3 variables
2. **Crear tabla users en TU BD**: Con campos para roles/permisos
3. **Integrar en AuthService**: Guardar usuario en TU BD después de Supabase Auth
4. **Implementar RBAC**: Guards, servicios, permisos (según `DECISION-POINTS.md`)

---

## 📚 Documentos Relevantes

- **SUPABASE_CONFIGURATION.md** - Resumen ejecutivo
- **SUPABASE_STEP_BY_STEP.md** - Solo los 3 primeros pasos (ignorar BD)
- **ENV_VARIABLES_QUICK_REFERENCE.md** - Solo las 3 variables
- **docs/auth/design/03-DATA-ARCHITECTURE.md** - Tu BD, no Supabase
- **docs/auth/design/04-AUTHENTICATION-FLOW.md** - Lee "Opción B: Sincronización Directa"

---

## ⚡ Configuración Rápida (5 Min)

```bash
# 1. Copia 3 claves de Supabase
# Settings → API Settings → Project API keys

# 2. Actualiza .env
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ0...
SUPABASE_SERVICE_ROLE_KEY=eyJ0...

# 3. Instala dependencias
npm install

# 4. Inicia
npm run start:dev

# 5. Prueba signup ✓
```

---

**Archivo**: `docs/auth/guides/SUPABASE_AUTH_ONLY.md`
**Actualizado**: 2025-01-12
**Estado**: ✅ Configuración simplificada - SOLO AUTH
