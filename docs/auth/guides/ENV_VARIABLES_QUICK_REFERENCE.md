# Variables de Entorno - Referencia Rápida

## 🚀 TL;DR - 5 Minutos

### Las 3 Variables Esenciales de Supabase

```env
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi... (clave pública)
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi... (clave secreta)
```

---

## 📍 Dónde Obtener Cada Variable

### 1️⃣ SUPABASE_URL

**Ubicación en Supabase Dashboard:**
```
🏠 Home → [Tu Proyecto] → Settings ⚙️ → General
```

**Busca:** "Project URL" o "Refer to this URL"

**Formato:**
```
https://xyzabc123def456.supabase.co
```

**Copia:** El URL completo

---

### 2️⃣ SUPABASE_ANON_KEY

**Ubicación en Supabase Dashboard:**
```
🏠 Home → [Tu Proyecto] → Settings ⚙️ → API Settings
```

**Busca:** "Project API keys" → "anon public"

**Notas:**
- ✅ Es pública, segura compartir
- ✅ Se usa en frontend
- 🔑 Empieza con `eyJ0eXA...`

**Copia:** La clave completa (es larga)

---

### 3️⃣ SUPABASE_SERVICE_ROLE_KEY

**Ubicación en Supabase Dashboard:**
```
🏠 Home → [Tu Proyecto] → Settings ⚙️ → API Settings
```

**Busca:** "Project API keys" → "service_role (secret)"

**Notas:**
- ⚠️ Es SECRETA, nunca exponer
- ⚠️ NUNCA subir a GitHub
- ⚠️ Solo usar en backend
- 🔑 Empieza con `eyJ0eXA...`

**Copia:** La clave completa (es larga)

---

## 📄 Variables Adicionales (Base de Datos)

### DATABASE_URL
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public&pgbouncer=true
```

**Obtener en Supabase:**
```
Settings ⚙️ → Database → Connection strings → URI
```

---

### DIRECT_URL
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public
```

**Igual que DATABASE_URL pero sin `?pgbouncer=true`**

---

## 🎯 Archivo .env Minimal

```env
# SUPABASE (OBLIGATORIO)
SUPABASE_URL=https://xyzabc123def456.supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi... (la clave pública completa)
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi... (la clave secreta completa)

# DATABASE (OBLIGATORIO)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xyzabc123def456.supabase.co:5432/postgres?schema=public&pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.xyzabc123def456.supabase.co:5432/postgres?schema=public

# APP (Recomendado)
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## ✅ Verificación Rápida

```bash
# Verifica que tienes las variables
grep -E "SUPABASE_|DATABASE_" .env

# Debe mostrar 5 líneas con valores
```

**Esperado:**
```
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ0...
SUPABASE_SERVICE_ROLE_KEY=eyJ0...
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

---

## 🐛 Problemas Inmediatos y Soluciones

| Problema | Solución |
|----------|----------|
| "Cannot find SUPABASE_URL" | Verifica que `.env` está en raíz de `agave-backend/` |
| "Invalid JWT" | Las claves están cortadas/incompletas, copiar de nuevo |
| "Database connection refused" | DATABASE_URL incorrea, verifica PASSWORD |
| "Permission denied" | SERVICE_ROLE_KEY incorrea, copiar de nuevo |

---

## 🔒 Seguridad

### ✅ HACER

- ✅ Compartir `SUPABASE_URL` libremente
- ✅ Compartir `SUPABASE_ANON_KEY` con frontend
- ✅ Guardar `SUPABASE_SERVICE_ROLE_KEY` en .env (nunca en GitHub)
- ✅ Guardar `DATABASE_URL` en .env.local
- ✅ Usar `.env.local` en `.gitignore`

### ❌ NO HACER

- ❌ Exponer `SUPABASE_SERVICE_ROLE_KEY` en código
- ❌ Subir `.env` a GitHub
- ❌ Compartir `DATABASE_URL` públicamente
- ❌ Guardar contraseñas en comentarios

---

## 📞 Soporte

Si tienes problemas:

1. **Lee completo**: `SUPABASE_SETUP.md`
2. **Verifica**: Las claves no están truncadas
3. **Consulta**: https://supabase.com/docs/guides/auth

---

**Archivo**: `docs/auth/guides/ENV_VARIABLES_QUICK_REFERENCE.md`
**Actualizado**: 2025-01-12
**Estado**: ✅ Listo para usar
