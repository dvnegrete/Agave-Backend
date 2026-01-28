# 📚 Guías de Configuración de Firebase - Bienvenido

Bienvenido al centro de documentación de Firebase Authentication para Agave Backend.

---

## 🎯 ¿Qué Necesitas Hacer?

### Opción 1: Necesito configurar Firebase Auth YA

**Tiempo:** 10 minutos

Sigue esta ruta:

```
📖 FIREBASE_ENVIRONMENTS.md
   ↓
   (Configurar NODE_ENV y FRONTEND_URL)
   ↓
📖 ../CROSS_DOMAIN_AUTH_SETUP.md
   ↓
   (Configurar variables de entorno por ambiente)
   ↓
✅ Firebase Auth configurado
```

---

### Opción 2: Necesito entender cómo funciona

**Tiempo:** 15-20 minutos

Lee estos documentos en orden:

```bash
# 1. Entender el problema y la solución
../CROSS_DOMAIN_AUTH_SETUP.md

# 2. Entender la implementación técnica
HYBRID_TOKEN_STRATEGY.md

# 3. Configurar ambientes correctamente
FIREBASE_ENVIRONMENTS.md
```

---

### Opción 3: Necesito una referencia rápida

**Para:** Recordar qué variable va dónde

Lee: **ENV_VARIABLES_QUICK_REFERENCE.md**

Tiempo: 2 minutos

---

### Opción 4: Tengo un problema

**Primero:** Revisa la sección "Troubleshooting" en:
- **../CROSS_DOMAIN_AUTH_SETUP.md**

**Luego:** Verifica los logs del backend al iniciar:
```bash
npm run start:dev
```

Busca mensajes como:
```
✅ FRONTEND_URL: http://localhost:5173
🔐 Cookie Security Config: secure=false
🍪 Cookie sameSite: lax
```

---

## 📖 Estructura de Documentos

```
docs/auth/
│
├── CROSS_DOMAIN_AUTH_SETUP.md ⭐ EMPIEZA AQUÍ
│   ↓ Solución completa a cross-domain auth
│   ↓ Configuración por ambiente
│   ↓ Troubleshooting
│
├── guides/
│   ├── 00-README.md (este archivo)
│   │   ↓ Orientación y navegación
│   │
│   ├── FIREBASE_ENVIRONMENTS.md ⭐
│   │   ↓ Configurar NODE_ENV y ambientes (10-15 min)
│   │
│   ├── HYBRID_TOKEN_STRATEGY.md
│   │   ↓ Implementación técnica completa (15-20 min)
│   │
│   ├── ENV_VARIABLES_QUICK_REFERENCE.md
│   │   ↓ Referencia rápida de variables (2-3 min)
│   │
│   └── VERIFICATION_SCRIPT.md
│       ↓ Verificar configuración (1 min)
```

---

## 🚀 Flujo Rápido (10-15 Minutos)

### Si es tu primera vez:

```
1. Lee FIREBASE_ENVIRONMENTS.md
2. Configura NODE_ENV según tu ambiente
3. Configura FRONTEND_URL y BACKEND_URL
4. Lee ../CROSS_DOMAIN_AUTH_SETUP.md
5. Configura variables de Firebase
6. Actualiza .env
7. Inicia backend: npm run start:dev
8. Verifica logs de configuración
9. ¡Listo! Firebase Auth configurado
```

### Si ya lo has hecho antes:

```
1. Verifica variables en .env
2. Asegúrate que FRONTEND_URL y BACKEND_URL estén correctos
3. npm run start:dev
4. Verifica logs de cookies
5. ✅ Listo
```

---

## 📋 Variables Principales de Firebase

Necesitas configurar estas variables en `.env`:

### 1. Firebase Configuration
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
```

### 2. Cross-Domain Auth Configuration
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### 3. Optional (para subdominios)
```env
COOKIE_DOMAIN=.tu-dominio.com
```

---

## ✅ Verificación

Después de configurar, inicia el backend:

```bash
npm run start:dev
```

Debe mostrar en los logs:
```
✅ FRONTEND_URL: http://localhost:5173
🔐 Cookie Security Config: secure=false (FRONTEND_URL=http://localhost:5173)
🍪 Cookie sameSite: lax (Frontend: localhost:5173, Backend: localhost:3000)
```

Si ves estos mensajes, ¡la configuración es correcta!

---

## 🔗 Después de Configurar

Una vez que Firebase Auth esté listo:

1. **Lee el análisis general**: `../INDEX.md`
2. **Entiende cross-domain auth**: `../CROSS_DOMAIN_AUTH_SETUP.md`
3. **Revisa implementación técnica**: `HYBRID_TOKEN_STRATEGY.md`
4. **Toma decisiones de arquitectura**: `../DECISION-POINTS.md` (para sistema de privilegios)

---

## 💡 Tips Importantes

### ✅ Hacer
```
✓ Configurar FRONTEND_URL (obligatorio)
✓ Configurar BACKEND_URL (para detectar cross-domain)
✓ Usar NODE_ENV correcto (development, staging, production)
✓ Proteger .env con .gitignore
✓ Revisar logs al iniciar el backend
```

### ❌ NO Hacer
```
✗ No omitir FRONTEND_URL (causa errores de cookies)
✗ No usar URLs con trailing slash
✗ No subir .env a GitHub
✗ No compartir FIREBASE_PRIVATE_KEY
✗ No hardcodear variables en código
```

---

## 📞 ¿Ayuda?

### Si necesitas referencia rápida
→ **ENV_VARIABLES_QUICK_REFERENCE.md**

### Si necesitas configurar ambientes
→ **FIREBASE_ENVIRONMENTS.md**

### Si tienes problemas de autenticación
1. Lee `../CROSS_DOMAIN_AUTH_SETUP.md` sección "Troubleshooting"
2. Verifica logs del backend
3. Verifica FRONTEND_URL y BACKEND_URL

### Si necesitas entender todo
→ Lee documentos en este orden:
1. `../CROSS_DOMAIN_AUTH_SETUP.md`
2. `HYBRID_TOKEN_STRATEGY.md`
3. `FIREBASE_ENVIRONMENTS.md`

---

## ⏱️ Tiempo Total

- **Configuración básica:** 10-15 minutos
- **Entender implementación:** 20-30 minutos
- **Primeras pruebas:** 5 minutos
- **Total:** ~30-45 minutos

---

## 🎯 Próximo Paso

```
👉 Abre: ../CROSS_DOMAIN_AUTH_SETUP.md
   y lee la configuración de tu ambiente (dev, staging, production)
```

---

**Guía:** docs/auth/guides/00-README.md
**Versión:** 2.0
**Estado:** ✅ Actualizado para Firebase Authentication
**Última actualización:** 2026-01-27

¡Bienvenido a la configuración de Firebase Authentication!
