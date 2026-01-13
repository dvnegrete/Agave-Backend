# Supabase - Configuración Paso a Paso Visual

## 🎯 Objetivo Final

Obtener estas 3 variables:
```env
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ0eXA...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXA...
```

---

## 📍 PASO 1: Acceder a Supabase

### 1.1 Abre supabase.com
```
https://app.supabase.com
```

### 1.2 Verás la página de login o dashboard

**Si ves:**
```
┌─────────────────────────────────────────────┐
│ My Projects                                  │
│ ┌──────────────┐  ┌──────────────┐         │
│ │ Agave        │  │ New Project  │         │
│ │ (tu proyecto)│  │              │         │
│ └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

### 1.3 Haz clic en tu proyecto (ej: "Agave")

---

## 🔐 PASO 2: Ir a Settings (Configuración)

Una vez dentro del proyecto, verás la barra lateral izquierda:

```
┌─ PROJECT MENU ─┐
│ 🏠 Home        │
│ 📊 Dashboard   │
│ 🗃️  Editor      │
│ 🗄️  Tables     │
│ 🔐 Authentication
│ 🔑 RLS          │
│ 🤝 Webhooks    │
│ ⚙️  Settings ← AQUÍ
└────────────────┘
```

### Haz clic en ⚙️ **Settings**

---

## 📍 PASO 3: General Settings

Después de hacer clic en Settings, verás:

```
┌─ SETTINGS SUBMENU ──┐
│ General ← AQUÍ      │
│ API Settings        │
│ Authentication      │
│ Database            │
│ Billing             │
│ Logs                │
│ Policies            │
└─────────────────────┘
```

### Haz clic en **General**

---

## 🌐 PASO 4: Obtener SUPABASE_URL

### En la página General, desplázate hacia abajo

```
┌─────────────────────────────────────────────────┐
│ General Settings                                │
│                                                 │
│ Project Info                                    │
│ ├─ Project ID: abc123xyz456                    │
│ ├─ Project Name: Agave                         │
│ │                                              │
│ └─ Project URL:                                │
│    https://abc123xyz456.supabase.co ← CÓPIALO │
│                                                 │
│ [Copiar] [Copiar]                             │
└─────────────────────────────────────────────────┘
```

### Paso 4.1: Localiza "Project URL"

Es la URL que comienza con `https://`

### Paso 4.2: Haz clic en el botón de copiar (📋)

O simplemente selecciona y copia:
```
https://abc123xyz456.supabase.co
```

### Paso 4.3: Guarda en .env

```env
SUPABASE_URL=https://abc123xyz456.supabase.co
```

✅ **Primera variable completada**

---

## 🔑 PASO 5: API Settings (Claves)

### Paso 5.1: Ve a Settings → API Settings

```
┌─ SETTINGS SUBMENU ──┐
│ General             │
│ API Settings ← AQUÍ │
│ Authentication      │
│ Database            │
│ Billing             │
│ Logs                │
│ Policies            │
└─────────────────────┘
```

### Paso 5.2: Desplázate hacia abajo

Verás una sección como esta:

```
┌─────────────────────────────────────────────────────┐
│ Project API keys                                    │
│                                                     │
│ anon public                                         │
│ eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR... 📋   │
│                                                     │
│ service_role (secret)                              │
│ eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR... 📋   │
│                                                     │
│ jwt_secret                                          │
│ super-secret-jwt-seed-string-here 📋              │
└─────────────────────────────────────────────────────┘
```

---

## 📋 PASO 6: Obtener SUPABASE_ANON_KEY

### Paso 6.1: Localiza "anon public"

Es la primera clave en "Project API keys"

```
anon public
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR...
```

### Paso 6.2: Haz clic en el botón de copiar (📋)

O selecciona toda la clave (es larga):
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR0eXAiOiJKV1QiLCJhbGc...
[muchos más caracteres...]
```

### Paso 6.3: Guarda en .env

```env
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR0eXAi...[LA CLAVE COMPLETA]
```

✅ **Segunda variable completada**

---

## 🔐 PASO 7: Obtener SUPABASE_SERVICE_ROLE_KEY

### Paso 7.1: En la misma página, localiza "service_role (secret)"

Es la segunda clave:

```
service_role (secret)
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR...
```

### ⚠️ IMPORTANTE
- Esta clave es **SECRETA**
- No la compartas nunca
- Solo va en `.env` (nunca en GitHub)

### Paso 7.2: Haz clic en el botón de copiar (📋)

O selecciona toda la clave:
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR0eXAiOiJKV1QiLCJhbGc...
[muchos más caracteres...]
```

### Paso 7.3: Guarda en .env

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsInR0eXAi...[LA CLAVE COMPLETA]
```

✅ **Tercera variable completada**

---

## 💾 PASO 8: Actualizar .env

### Paso 8.1: Abre tu archivo `.env`

En `agave-backend/.env`

### Paso 8.2: Reemplaza las líneas de Supabase

**Antes:**
```env
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

**Después:**
```env
SUPABASE_URL=https://abc123xyz456.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi...CLAVE_COMPLETA...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi...CLAVE_COMPLETA...
```

### Paso 8.3: Guarda el archivo

```bash
# En macOS/Linux: Ctrl + S
# En Windows: Ctrl + S
```

---

## 🔌 PASO 9: Configurar Base de Datos (Opcional pero Recomendado)

### Paso 9.1: Ve a Settings → Database

```
┌─ SETTINGS SUBMENU ──┐
│ General             │
│ API Settings        │
│ Authentication      │
│ Database ← AQUÍ     │
│ Billing             │
│ Logs                │
│ Policies            │
└─────────────────────┘
```

### Paso 9.2: Desplázate hacia abajo

Verás:
```
┌─────────────────────────────────────────┐
│ Connection strings                      │
│                                         │
│ URI                                     │
│ postgresql://postgres:PASSWORD@db.ab... │
│                                         │
│ PSQL                                    │
│ psql -h db.abc123.supabase.co -U ...   │
│                                         │
│ JDBC                                    │
│ jdbc:postgresql://db.abc123...          │
└─────────────────────────────────────────┘
```

### Paso 9.3: Copia la "URI"

```
postgresql://postgres:PASSWORD@db.abc123xyz456.supabase.co:5432/postgres?schema=public&pgbouncer=true
```

### Paso 9.4: Guarda en .env

```env
DATABASE_URL=postgresql://postgres:PASSWORD@db.abc123xyz456.supabase.co:5432/postgres?schema=public&pgbouncer=true
DIRECT_URL=postgresql://postgres:PASSWORD@db.abc123xyz456.supabase.co:5432/postgres?schema=public
```

---

## ✅ PASO 10: Verificación Final

### Paso 10.1: Abre terminal

```bash
# Ve a la carpeta del proyecto
cd agave-backend
```

### Paso 10.2: Verifica que las variables están configuradas

```bash
# Mostra las variables de Supabase
cat .env | grep SUPABASE
```

**Esperado:**
```
SUPABASE_URL=https://abc123xyz456.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi...
```

### Paso 10.3: Instala dependencias

```bash
npm install
```

### Paso 10.4: Inicia el backend

```bash
npm run start:dev
```

**Verifica en los logs:**
```
[Nest] ... Logger     NestFactory
✓ Supabase initialized successfully
✓ Application listening on port 3000
```

### Paso 10.5: Prueba un endpoint

```bash
# En otra terminal
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Esperado:**
```json
{
  "accessToken": "eyJ0eXAi...",
  "refreshToken": "...",
  "user": {
    "id": "uuid-123...",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }
}
```

✅ **¡Configuración completada!**

---

## 🎯 Resumen Rápido de Clics

```
1. Abre https://app.supabase.com
2. Haz clic en tu proyecto (Agave)
3. Haz clic en ⚙️ Settings (barra lateral)
4. Haz clic en General
5. Copia "Project URL" → SUPABASE_URL
6. Haz clic en API Settings
7. Copia "anon public" → SUPABASE_ANON_KEY
8. Copia "service_role" → SUPABASE_SERVICE_ROLE_KEY
9. Haz clic en Database
10. Copia "URI" → DATABASE_URL
11. Actualiza .env en agave-backend
12. npm install
13. npm run start:dev
14. ¡Listo!
```

---

## 📸 Esquema de Ubicaciones

```
Supabase Dashboard
│
├─ Home
│  └─ [Tu Proyecto: Agave]
│     │
│     └─ Settings ⚙️
│        ├─ General
│        │  └─ Project URL ← SUPABASE_URL
│        │
│        ├─ API Settings
│        │  ├─ anon public ← SUPABASE_ANON_KEY
│        │  └─ service_role (secret) ← SUPABASE_SERVICE_ROLE_KEY
│        │
│        └─ Database
│           └─ URI ← DATABASE_URL
│
└─ agave-backend/.env ← Aquí copias todo
```

---

**Archivo**: `docs/auth/guides/SUPABASE_STEP_BY_STEP.md`
**Actualizado**: 2025-01-12
**Estado**: ✅ Guía visual paso a paso
