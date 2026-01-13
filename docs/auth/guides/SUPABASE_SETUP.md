# Configuración de Supabase - Guía Paso a Paso

## 🎯 Objetivo

Obtener las credenciales de Supabase necesarias para conectar `@agave-backend/` con tu proyecto de Supabase.

**Variables necesarias:**
```env
SUPABASE_URL=<tu_url_de_supabase>
SUPABASE_ANON_KEY=<tu_clave_anonima>
SUPABASE_SERVICE_ROLE_KEY=<tu_clave_service_role>
```

---

## 📋 Prerequisitos

- ✅ Cuenta en supabase.com
- ✅ Proyecto de Supabase creado
- ✅ Email Provider habilitado
- ✅ Google OAuth configurado en GCP

**Si aún no tienes un proyecto, crea uno en [https://supabase.com](https://supabase.com)**

---

## 🔐 Paso 1: Acceder a las Credenciales del Proyecto

### 1.1 Ir a la Dashboard de Supabase

1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto (ej: "Agave")

### 1.2 Localizar el Menú de Configuración

En la barra lateral izquierda, desplázate hacia abajo hasta encontrar:

```
Configuración (⚙️ Settings icon)
  ├── General
  ├── API Settings ← AQUÍ ESTÁN LAS CLAVES
  ├── Authentication
  ├── Database
  ├── Billing
  └── ...
```

---

## 🔑 Paso 2: Obtener `SUPABASE_URL`

### En Supabase Dashboard:

1. **Abre**: Settings → General
2. **Busca**: "Project URL"
3. **Copia**: La URL que comienza con `https://`

```
Formato:
https://[PROJECT-ID].supabase.co
```

### Ejemplo:
```
SUPABASE_URL=https://xyzabc123def456.supabase.co
```

### ✅ En .env:
```env
SUPABASE_URL=https://xyzabc123def456.supabase.co
```

---

## 🔑 Paso 3: Obtener `SUPABASE_ANON_KEY`

### En Supabase Dashboard:

1. **Abre**: Settings → API Settings
2. **Busca**: "Project API keys"
3. **Localiza**: "anon public" (la primera clave)
4. **Copia**: El valor largo (empieza con `eyJ...`)

```
Sección: Project API keys
├── anon public ← ESTA
├── service_role (secret)
└── jwt_secret
```

### 🚨 IMPORTANTE:
- La `anon key` es **pública**, segura compartir
- Se usa en el cliente (frontend)
- Limita permisos con Row Level Security (RLS)

### ✅ En .env:
```env
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc... (la clave completa)
```

---

## 🔑 Paso 4: Obtener `SUPABASE_SERVICE_ROLE_KEY`

### En Supabase Dashboard:

1. **Abre**: Settings → API Settings
2. **Busca**: "Project API keys"
3. **Localiza**: "service_role (secret)" (la segunda clave)
4. **Copia**: El valor largo

```
Sección: Project API keys
├── anon public
├── service_role (secret) ← ESTA
└── jwt_secret
```

### 🚨 IMPORTANTE:
- Esta clave es **SECRETA** ⚠️
- NUNCA compartir ni exponer en código
- Solo usar en backend
- Tiene acceso total a todo

### ✅ En .env:
```env
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc... (la clave completa)
```

---

## 📝 Paso 5: Archivo .env Completo

Una vez obtenidas las tres claves:

```env
# ===========================
# SUPABASE CONFIGURATION
# ===========================
SUPABASE_URL=https://xyzabc123def456.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# ===========================
# APP CONFIGURATION
# ===========================
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ===========================
# DATABASE CONNECTION (Supabase PostgreSQL)
# ===========================
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public&pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public

# ... resto de variables (GCP, OpenAI, WhatsApp, etc.)
```

---

## 🔌 Paso 6: Configurar Conexión a Base de Datos

Supabase incluye PostgreSQL. Necesitas las credenciales de BD también.

### En Supabase Dashboard:

1. **Abre**: Settings → Database
2. **Busca**: "Connection string"
3. **Selecciona**: "URI"

```
Podrás ver:
- Host: db.[PROJECT-ID].supabase.co
- User: postgres
- Password: [PASSWORD_QUE_CONFIGURASTE]
- Database: postgres
- Port: 5432
```

### URI Completa:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public&pgbouncer=true
```

### ✅ En .env:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public&pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public
```

---

## 🧪 Paso 7: Verificar Configuración

### Test 1: Verificar que las variables existen

```bash
# En la raíz del proyecto
cat .env | grep SUPABASE
```

**Salida esperada:**
```
SUPABASE_URL=https://xyzabc...
SUPABASE_ANON_KEY=eyJ0eXA...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXA...
```

### Test 2: Verificar conexión a Supabase (desde Backend)

```bash
# Instalar si falta
npm install

# Ejecutar el backend
npm run start:dev
```

**Monitorea los logs:**
```
[Nest] ... Logger     NestFactory
  ✓ Supabase initialized successfully
  ✓ Database connection established
```

Si ves estos mensajes, ¡está funcionando!

### Test 3: Probar endpoint de autenticación

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Respuesta esperada:**
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refreshToken": "...",
  "user": {
    "id": "uuid-string",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }
}
```

---

## 🔐 Paso 8: Configuración de Seguridad en Supabase

### 8.1 Habilitar Row Level Security (RLS)

RLS asegura que los usuarios solo vean sus datos.

**En Supabase Dashboard:**

1. **Abre**: SQL Editor (lado izquierdo)
2. **Copia y ejecuta** este script:

```sql
-- Habilitar RLS en tabla users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política: Admin ve todo
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Política: Usuarios ven su propio perfil
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (
    auth.uid() = id::uuid OR auth.jwt() ->> 'role' = 'admin'
  );

-- Política: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (
    auth.uid() = id::uuid OR auth.jwt() ->> 'role' = 'admin'
  );
```

### 8.2 Configurar Email en Supabase

Ya lo tienes habilitado, pero verifica:

**En Supabase Dashboard:**

1. **Abre**: Authentication → Providers
2. **Busca**: "Email"
3. **Verifica**: ✅ Habilitado

### 8.3 Verificar Google OAuth

Ya lo tienes configurado, pero verifica:

**En Supabase Dashboard:**

1. **Abre**: Authentication → Providers
2. **Busca**: "Google"
3. **Verifica**: ✅ Habilitado
4. **Verifica**: Client ID y Client Secret del GCP están configurados

---

## 📧 Paso 9: Configurar Webhooks (Opcional pero Recomendado)

Si decidiste usar Webhooks para sincronización Supabase → PostgreSQL:

**En Supabase Dashboard:**

1. **Abre**: Database → Webhooks
2. **Click**: "Create a new webhook"
3. **Configura:**

```
Name: Sync Users on Auth
Events: user.created, user.updated, user.deleted
HTTP endpoint: https://tuapp.com/webhooks/supabase/auth
HTTP method: POST
```

4. **Headers** (agregar):
```
Authorization: Bearer <tu_token_secreto>
Content-Type: application/json
```

---

## 🚀 Paso 10: Verificar Providers Habilitados

### Email Provider

```
✅ Supabase Dashboard → Authentication → Providers → Email
  - Enable email provider: ✓
  - Auto confirm users: (depende de tu preferencia)
  - Enable email OTP: (opcional)
```

### Google OAuth

```
✅ Supabase Dashboard → Authentication → Providers → Google
  - Enabled: ✓
  - Client ID: (desde GCP)
  - Client Secret: (desde GCP)
```

---

## 📚 Variables de Entorno Completas para Backend

### Después de completar todos los pasos:

```env
# ===========================
# SUPABASE AUTHENTICATION
# ===========================
SUPABASE_URL=https://xyzabc123def456.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.[CLAVE_COMPLETA]
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.[CLAVE_SECRETA]

# ===========================
# APP CONFIGURATION
# ===========================
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ===========================
# DATABASE (Supabase PostgreSQL)
# ===========================
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xyzabc123def456.supabase.co:5432/postgres?schema=public&pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.xyzabc123def456.supabase.co:5432/postgres?schema=public

# ===========================
# GCP (Google Cloud Platform)
# ===========================
PROJECT_ID_GCP=tu-proyecto-gcp
PRIVATE_KEY_ID=xxxxx
PRIVATE_KEY_GCP=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
CLIENT_EMAIL_GCP=service-account@tu-proyecto.iam.gserviceaccount.com
CLIENT_ID_GCP=1234567890
BUCKET_NAME_GCP=tu-bucket
BUCKET_NAME_VOUCHERS=tu-bucket-vouchers

# ===========================
# EXTERNAL SERVICES
# ===========================
OPENAI_API_KEY=sk-...
TOKEN_WA=...
ACCESS_TOKEN_VERIFY_WA=...
PHONE_NUMBER_ID_WA=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=...
```

---

## 🧪 Verificación Final

Ejecuta este comando para verificar que todo está configurado:

```bash
# Desde agave-backend/
npm run typeorm query "SELECT NOW()"
```

**Salida esperada:**
```
now
2026-01-12 14:30:45.123456-05
```

Si ves esta salida, ¡la BD está conectada correctamente!

---

## ⚠️ Problemas Comunes

### Error: "Cannot connect to Supabase"

**Posibles causas:**
1. Variables vacías en .env
2. URL incorrecta (falta `https://`)
3. Claves incorrectas (copiar de nuevo)
4. Proyecto de Supabase pausado

**Solución:**
```bash
# 1. Verifica el archivo .env
cat .env | grep SUPABASE

# 2. Copia de nuevo las claves de Supabase
# 3. Verifica en Supabase Dashboard que el proyecto está activo
```

---

### Error: "Invalid JWT"

**Posibles causas:**
1. `SUPABASE_ANON_KEY` o `SUPABASE_SERVICE_ROLE_KEY` incorrectos
2. Claves cortadas o incompletas

**Solución:**
```bash
# Verificar longitud de las claves (deben ser largas)
echo $SUPABASE_ANON_KEY | wc -c

# Debería ser > 200 caracteres
```

---

### Error: "Database connection refused"

**Posibles causas:**
1. DATABASE_URL incorrecta
2. Contraseña de BD incorrecta
3. BD no inicializada

**Solución:**
```bash
# Verificar la URL de BD
echo $DATABASE_URL

# En Supabase Dashboard → Settings → Database
# Verificar password y host
```

---

## 📚 Recursos Útiles

- **Documentación de Supabase**: https://supabase.com/docs
- **Autenticación en Supabase**: https://supabase.com/docs/guides/auth
- **API Reference**: https://supabase.com/docs/reference/javascript/introduction

---

## ✅ Checklist de Configuración

```
SUPABASE SETUP CHECKLIST:

[ ] Proyecto creado en supabase.com
[ ] SUPABASE_URL obtenida y copiada a .env
[ ] SUPABASE_ANON_KEY obtenida y copiada a .env
[ ] SUPABASE_SERVICE_ROLE_KEY obtenida y copiada a .env
[ ] DATABASE_URL configurada con credenciales correctas
[ ] DIRECT_URL configurada
[ ] Email Provider habilitado en Supabase
[ ] Google OAuth configurado en Supabase
[ ] RLS habilitado en tablas (opcional)
[ ] Webhooks configurados (si decidiste usar)
[ ] npm install ejecutado
[ ] npm run start:dev inicia correctamente
[ ] curl test a /auth/signup funciona
[ ] Variables de entorno verificadas
```

---

**Archivo**: `docs/auth/guides/SUPABASE_SETUP.md`
**Actualizado**: 2025-01-12
**Estado**: ✅ Completo - Listo para seguir
