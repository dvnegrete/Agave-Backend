# Guías de Autenticación - Índice

## 📚 Guías Disponibles

### 1. **FIREBASE_ENVIRONMENTS.md** ⭐ PARA FIREBASE AUTH DEPLOYMENT

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

### 2. **HYBRID_TOKEN_STRATEGY.md** ⭐ IMPLEMENTACIÓN TÉCNICA

**Para:** Entender la estrategia híbrida de tokens (cookies + Authorization header)

**Contenido:**
- Problema resuelto: autenticación multi-ambiente
- Flujo de autenticación completo
- Implementación en backend y frontend
- AuthGuard dual-mode
- Fallback con localStorage

**Tiempo:** 15-20 minutos

**Mejor para:** Desarrolladores que necesitan entender la implementación técnica

**Lee esto si:**
- Necesitas entender cómo funciona el sistema internamente
- Estás modificando el código de autenticación
- Quieres conocer el flujo completo de tokens

---

### 3. **ENV_VARIABLES_QUICK_REFERENCE.md**

**Para:** Referencia rápida de variables de entorno

**Contenido:**
- Variables necesarias para Firebase Auth
- Variables para cross-domain auth
- Archivo .env minimal
- Verificación rápida
- Soluciones a problemas comunes

**Tiempo:** 2-3 minutos

**Mejor para:** Recordar qué variable va dónde, troubleshooting rápido

---

### 4. **VERIFICATION_SCRIPT.md**

**Para:** Usar el script de verificación automática

**Contenido:**
- Cómo ejecutar verify-supabase.sh (actualizar a verify-firebase.sh)
- Qué verifica el script
- Interpretación de resultados
- Soluciones automáticas

**Tiempo:** 1 minuto para ejecutar

**Mejor para:** Verificación rápida después de configurar, debugging

**Nota:** Este script necesita actualización para Firebase (actualmente valida Supabase)

---

## 🎯 ¿Cuál Guía Necesitas?

### Caso 1: "Necesito configurar Firebase Auth"
→ Lee **FIREBASE_ENVIRONMENTS.md** ⭐
→ Luego ve al documento principal: `../CROSS_DOMAIN_AUTH_SETUP.md`

### Caso 2: "¿Cómo funciona la autenticación internamente?"
→ Lee **HYBRID_TOKEN_STRATEGY.md**
→ Explica la implementación técnica completa

### Caso 3: "¿Dónde pongo la variable X?"
→ Consulta **ENV_VARIABLES_QUICK_REFERENCE.md**

### Caso 4: "Tengo error de autenticación (401 loops)"
→ Lee `../CROSS_DOMAIN_AUTH_SETUP.md` sección "Troubleshooting"
→ Verifica configuración de FRONTEND_URL y BACKEND_URL

### Caso 5: "Necesito deployar a staging/producción"
→ Lee **FIREBASE_ENVIRONMENTS.md** para configurar ambientes
→ Lee `../CROSS_DOMAIN_AUTH_SETUP.md` para configuración cross-domain

---

## 📋 Variables de Entorno Necesarias

### Para Firebase Authentication

```env
# OBLIGATORIO (Firebase)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# OBLIGATORIO (Cross-Domain Auth)
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# OPCIONAL (Subdominios)
COOKIE_DOMAIN=.tu-dominio.com
```

### Configuración por Ambiente

#### Desarrollo Local
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

#### Staging Railway
```env
NODE_ENV=staging
FRONTEND_URL=https://agave-frontend-staging.up.railway.app
BACKEND_URL=https://agave-backend-staging.up.railway.app
```

#### Producción
```env
NODE_ENV=production
FRONTEND_URL=https://condominioelagave.com.mx
BACKEND_URL=https://agave-backend-production.up.railway.app
```

---

## ⚠️ Seguridad

### ✅ SEGURO COMPARTIR
- FIREBASE_PROJECT_ID (público)

### 🔐 MANTENER EN SECRETO
- FIREBASE_PRIVATE_KEY (solo backend)
- FIREBASE_CLIENT_EMAIL (solo backend)

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

3. **Verifica autenticación:**
   - El backend debe iniciar sin errores
   - Logs deben mostrar configuración de cookies correcta
   - Prueba login con Google OAuth

4. **Revisa logs de inicio:**
   ```
   ✅ FRONTEND_URL: http://localhost:5173
   🔐 Cookie Security Config: secure=false (FRONTEND_URL=http://localhost:5173)
   🍪 Cookie sameSite: lax (Frontend: localhost:5173, Backend: localhost:3000)
   ```

---

## 🔗 Enlaces Relacionados

- **Análisis de Auth**: `../INDEX.md`
- **Cross-Domain Setup**: `../CROSS_DOMAIN_AUTH_SETUP.md` ⭐ IMPORTANTE
- **Decisiones de Diseño**: `../DECISION-POINTS.md`
- **Componentes Técnicos**: `../architecture/05-COMPONENTS.md`

---

## 💡 Tips

1. **FRONTEND_URL es obligatorio**: Sin él, el sistema no puede determinar sameSite policy
2. **BACKEND_URL para detectar cross-domain**: Si no está configurado, asume cross-domain
3. **NODE_ENV afecta configuración**: development vs staging vs production
4. **Revisa logs al iniciar**: El backend imprime configuración de cookies
5. **Usa HTTPS en staging/producción**: sameSite: 'none' requiere HTTPS

---

## 📞 Necesito Ayuda

**Si tienes problemas:**

1. Lee **FIREBASE_ENVIRONMENTS.md** para configuración básica
2. Lee `../CROSS_DOMAIN_AUTH_SETUP.md` para troubleshooting
3. Mira la sección "Troubleshooting" en CROSS_DOMAIN_AUTH_SETUP.md
4. Revisa los logs del backend al iniciar
5. Verifica variables en Railway (si aplica)

---

## 📝 Notas Importantes

- **Firebase vs Supabase**: El proyecto ahora usa Firebase Authentication, no Supabase Auth
- **Database**: Supabase sigue siendo usado para la base de datos PostgreSQL, solo Auth cambió a Firebase
- **Cross-Domain**: La solución funciona en todos los ambientes (dev, staging, producción)
- **Cookies + Headers**: El sistema usa ambos para máxima compatibilidad

---

**Archivo**: `docs/auth/guides/INDEX.md`
**Actualizado**: 2026-01-27
**Estado**: ✅ Actualizado para Firebase Authentication
