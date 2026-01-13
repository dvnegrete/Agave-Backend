# 🚀 Configuración de Supabase para Agave Backend

## ⚡ TL;DR - 5 Minutos

### Las 3 Claves que Necesitas

```env
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJ0eXA... (200+ caracteres)
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXA... (200+ caracteres)
```

### Dónde Obtenerlas

```
supabase.com → Tu Proyecto → Settings ⚙️
  ├─ General → "Project URL" = SUPABASE_URL
  └─ API Settings → Project API keys
     ├─ "anon public" = SUPABASE_ANON_KEY
     └─ "service_role (secret)" = SUPABASE_SERVICE_ROLE_KEY
```

### En 5 Pasos

1. Ve a [supabase.com](https://supabase.com)
2. Abre tu proyecto (Agave)
3. Settings → General → Copia URL
4. Settings → API Settings → Copia ambas claves
5. Actualiza `.env` en `agave-backend/`

---

## 📚 Documentación Completa

Hay guías detalladas en `docs/auth/guides/`:

| Documento | Duración | Caso de Uso |
|-----------|----------|-----------|
| **SUPABASE_STEP_BY_STEP.md** | 5-10 min | Instrucciones visuales paso a paso ⭐ |
| **ENV_VARIABLES_QUICK_REFERENCE.md** | 2-3 min | Referencia rápida de variables |
| **SUPABASE_SETUP.md** | 15-20 min | Guía completa y detallada |
| **VERIFICATION_SCRIPT.md** | 1 min | Verificar configuración automáticamente |

---

## ✅ Verificación Rápida

Ejecuta este script desde `agave-backend/`:

```bash
bash verify-supabase.sh
```

El script verifica automáticamente que:
- ✓ .env existe
- ✓ SUPABASE_URL está configurado
- ✓ SUPABASE_ANON_KEY está configurado
- ✓ SUPABASE_SERVICE_ROLE_KEY está configurado
- ✓ DATABASE_URL está configurado (opcional)
- ✓ @supabase/supabase-js está instalado
- ✓ .env está protegido en .gitignore

---

## 🔧 Archivo .env Completo

### Mínimo Requerido
```env
# Supabase Auth
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi... (la clave pública)
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi... (la clave secreta)

# Base de Datos
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public&pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Completo (Incluido GCP, OpenAI, etc.)
Ver `env.example`

---

## 🚀 Después de Configurar

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar backend
npm run start:dev

# 3. Verifica los logs (debe decir: ✓ Supabase initialized successfully)

# 4. Prueba un endpoint
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# 5. Respuesta esperada:
# {
#   "accessToken": "eyJ0eXA...",
#   "refreshToken": "...",
#   "user": { "id": "...", "email": "test@example.com" }
# }
```

---

## 🔒 Seguridad

### ✅ HACER
- Compartir SUPABASE_URL libremente
- Compartir SUPABASE_ANON_KEY con frontend
- Guardar SERVICE_ROLE_KEY en .env (nunca en código)
- Tener .env en .gitignore

### ❌ NO HACER
- Exponer SERVICE_ROLE_KEY en código
- Subir .env a GitHub
- Compartir DATABASE_URL públicamente
- Guardar credenciales en comentarios

---

## ⚠️ Problemas Comunes

### "Cannot connect to Supabase"
```
1. Verifica que SUPABASE_URL comienza con https://
2. Verifica que las claves no están truncadas
3. Verifica en Supabase que el proyecto está activo
```

### "Invalid JWT"
```
1. Las claves JWT deben tener 200+ caracteres
2. Copia de nuevo desde Supabase (no truncadas)
3. Verifica que no hay espacios al inicio/final
```

### "Database connection refused"
```
1. Verifica DATABASE_URL en Settings → Database
2. Verifica que la contraseña es correcta
3. Verifica que el host es correcto
```

---

## 📊 Estado Actual de Supabase

✅ **Habilitado en tu proyecto:**
- Email Provider
- Google OAuth (con GCP configurado)

❌ **Aún no configurado:**
- Row Level Security (RLS) - opcional
- Webhooks - opcional si usas sincronización directa

---

## 🔗 Próximos Pasos

### 1. Seguir el Flujo de Autenticación
Una vez que Supabase está configurado:

- Lee: `docs/auth/INDEX.md` (análisis general)
- Decide: `docs/auth/DECISION-POINTS.md` (10 decisiones)
- Implementa: `docs/auth/architecture/05-COMPONENTS.md`

### 2. Entender el Modelo de Roles
- Lee: `docs/auth/design/02-PRIVILEGE-HIERARCHY.md`
- Matriz: `docs/auth/design/06-PERMISSION-MATRIX.md`

### 3. Flujos de Autenticación
- Lee: `docs/auth/design/04-AUTHENTICATION-FLOW.md`
- Datos: `docs/auth/design/03-DATA-ARCHITECTURE.md`

---

## 📞 Soporte

### Si tienes problemas con Supabase:

1. **Lee:** `docs/auth/guides/SUPABASE_STEP_BY_STEP.md`
2. **Verifica:** `bash verify-supabase.sh`
3. **Consulta:** [supabase.com/docs](https://supabase.com/docs)

### Si tienes problemas con autenticación:

1. **Lee:** `docs/auth/guides/SUPABASE_SETUP.md`
2. **Sección:** "Problemas Comunes"
3. **Contacta:** al equipo de desarrollo

---

## 📋 Checklist

```
CONFIGURACIÓN DE SUPABASE:

[ ] Proyecto creado en supabase.com
[ ] Email Provider habilitado
[ ] Google OAuth configurado (GCP)

OBTENER VARIABLES:

[ ] SUPABASE_URL obtenida
[ ] SUPABASE_ANON_KEY obtenida
[ ] SUPABASE_SERVICE_ROLE_KEY obtenida
[ ] DATABASE_URL obtenida

ACTUALIZAR PROYECTO:

[ ] .env actualizado con las 3 claves
[ ] .env está en .gitignore
[ ] npm install ejecutado
[ ] verify-supabase.sh pasó todas las verificaciones

VERIFICAR FUNCIONAMIENTO:

[ ] npm run start:dev inicia sin errores
[ ] Logs muestran "✓ Supabase initialized successfully"
[ ] curl test a /auth/signup funciona
[ ] Usuario creado correctamente

SIGUIENTE FASE:

[ ] Revisar docs/auth/DECISION-POINTS.md
[ ] Tomar decisiones de arquitectura
[ ] Comenzar implementación de RBAC
```

---

## 🌟 Quick Links

- [Supabase Dashboard](https://app.supabase.com)
- [Documentación de Supabase](https://supabase.com/docs)
- [Guías de Autenticación](./docs/auth/guides/INDEX.md)
- [Análisis de Privilegios](./docs/auth/INDEX.md)

---

**Documento:** SUPABASE_CONFIGURATION.md
**Actualizado:** 2025-01-12
**Estado:** ✅ Listo para configuración

¿Preguntas? Consulta los documentos en `docs/auth/guides/`
