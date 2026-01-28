# Guías de Autenticación - Índice

## 📚 Guías Disponibles

### 0. **FIREBASE_ENVIRONMENTS.md** ⭐ PARA FIREBASE AUTH DEPLOYMENT

**Para:** Configurar NODE_ENV y FRONTEND_URL para cada ambiente (Desarrollo, Staging, Producción)

**Contenido:**
- NODE_ENV configuration (development, staging, production)
- Database pool sizing by environment
- Cookie security configuration
- FRONTEND_URL requirements
- Environment validation on bootstrap
- Common configuration errors

**Tiempo:** 10-15 minutos

**Mejor para:** Deployment a Railway, configuración de ambientes

**Lee esto si:**
- Necesitas deployar a Staging o Producción
- Tienes problemas de autenticación (401 loops)
- Necesitas entender NODE_ENV impact

---

### 1. **SUPABASE_STEP_BY_STEP.md** ⭐ EMPIEZA AQUÍ

**Para:** Usuarios que necesitan instrucciones visuales paso a paso

**Contenido:**
- Dónde hacer clic en supabase.com
- Cómo obtener SUPABASE_URL
- Cómo obtener SUPABASE_ANON_KEY
- Cómo obtener SUPABASE_SERVICE_ROLE_KEY
- Verificación final

**Tiempo:** 5-10 minutos

**Mejor para:** Primera configuración, usuarios visuales

---

### 2. **ENV_VARIABLES_QUICK_REFERENCE.md**

**Para:** Referencia rápida de variables de entorno

**Contenido:**
- TL;DR de las 3 variables necesarias
- Dónde obtener cada una
- Archivo .env minimal
- Verificación rápida
- Soluciones a problemas comunes

**Tiempo:** 2-3 minutos

**Mejor para:** Recordar qué variable va dónde, troubleshooting rápido

---

### 3. **SUPABASE_SETUP.md**

**Para:** Guía completa y detallada

**Contenido:**
- Instrucciones paso a paso completas
- Verificación de configuración
- Seguridad (RLS, webhooks)
- Troubleshooting exhaustivo
- Checklist de configuración

**Tiempo:** 15-20 minutos

**Mejor para:** Entender todo en detalle, problemas complejos

---

### 4. **SUPABASE_AUTH_ONLY.md** ⭐ SI NO USAS BD DE SUPABASE

**Para:** Usar SOLO Supabase Auth sin su BD

**Contenido:**
- Confirmación: No necesitas BD de Supabase
- Variables mínimas necesarias (solo 3)
- Arquitectura sin BD de Supabase
- Cómo sincronizar usuarios con tu BD
- Flujo completo de autenticación
- Ejemplos de código

**Tiempo:** 5-10 minutos

**Mejor para:** Si usas tu propia BD PostgreSQL

---

### 5. **VERIFICATION_SCRIPT.md**

**Para:** Usar el script de verificación automática

**Contenido:**
- Cómo ejecutar verify-supabase.sh
- Qué verifica el script
- Interpretación de resultados
- Soluciones automáticas

**Tiempo:** 1 minuto para ejecutar

**Mejor para:** Verificación rápida después de configurar, debugging

---

## 🎯 ¿Cuál Guía Necesitas?

### Caso 1: "Uso SOLO Supabase Auth (sin su BD)"
→ Lee **SUPABASE_AUTH_ONLY.md** ⭐
→ (Necesitas SOLO 3 variables, no DATABASE_URL)

### Caso 2: "Quiero usar Supabase para Auth + BD"
→ Lee **SUPABASE_STEP_BY_STEP.md**
→ (Necesitas 5 variables: URL + 2 keys + 2 DB URLs)

### Caso 3: "¿Dónde pongo la clave X?"
→ Consulta **ENV_VARIABLES_QUICK_REFERENCE.md**

### Caso 4: "Tengo error de conexión"
→ Ejecuta: `bash verify-supabase.sh`
→ Lee **VERIFICATION_SCRIPT.md** para interpretar resultados

### Caso 5: "Quiero entender todo en detalle"
→ Lee **SUPABASE_SETUP.md**

---

## 📋 Variables de Entorno Necesarias

### OPCIÓN A: Solo Supabase Auth (Sin su BD) ⭐
```env
# OBLIGATORIO (3 variables)
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi...

# APP CONFIG
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### OPCIÓN B: Supabase Auth + Supabase BD
```env
# OBLIGATORIO (5 variables)
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=eyJ0eXAi...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi...
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# APP CONFIG
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## ⚠️ Seguridad

### ✅ SEGURO COMPARTIR
- SUPABASE_URL (pública)
- SUPABASE_ANON_KEY (para frontend)

### 🔐 MANTENER EN SECRETO
- SUPABASE_SERVICE_ROLE_KEY (solo backend)
- DATABASE_URL (solo backend)
- DIRECT_URL (solo backend)

### 🚫 NUNCA EN GITHUB
```
.env
.env.local
.env.*.local
```

Verifica que `.gitignore` contiene:
```
.env
.env.local
```

---

## 🧪 Después de Configurar

1. **Instala dependencias:**
   ```bash
   npm install
   ```

2. **Inicia el backend:**
   ```bash
   npm run start:dev
   ```

3. **Verifica conexión:**
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

4. **Deberías recibir:**
   ```json
   {
     "accessToken": "...",
     "refreshToken": "...",
     "user": { "id": "...", "email": "..." }
   }
   ```

---

## 🔗 Enlaces Relacionados

- **Análisis de Auth**: `../INDEX.md`
- **Decisiones de Diseño**: `../DECISION-POINTS.md`
- **Componentes Técnicos**: `../architecture/05-COMPONENTS.md`

---

## 💡 Tips

1. **Claves largas**: Las claves JWT deben tener 200+ caracteres
2. **No truncar**: Si la clave aparece truncada, cópiala completa
3. **Sin espacios**: Las claves no deben tener espacios al principio/final
4. **Verificar formato**: DATABASE_URL debe empezar con `postgresql://`

---

## 📞 Necesito Ayuda

**Si tienes problemas:**

1. Verifica que seguiste **SUPABASE_STEP_BY_STEP.md** exactamente
2. Mira la sección de **Problemas Comunes** en **SUPABASE_SETUP.md**
3. Revisa que las claves no están truncadas
4. Consulta [supabase.com/docs](https://supabase.com/docs)

---

**Archivo**: `docs/auth/guides/INDEX.md`
**Actualizado**: 2025-01-12
**Estado**: ✅ Índice de guías
