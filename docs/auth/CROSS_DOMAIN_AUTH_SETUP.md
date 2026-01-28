# Configuración de Autenticación Cross-Domain

## Problema Solucionado

Este documento explica la solución al problema de **loop infinito de peticiones con respuestas 401** que ocurre en ambientes de staging (Railway) donde el frontend y backend están en dominios diferentes.

### Causa del Problema

1. **Cookies con `sameSite: 'lax'`** no se envían en peticiones cross-site (diferentes dominios)
2. En **staging Railway**:
   - Frontend: `agave-frontend.up.railway.app`
   - Backend: `agave-backend.up.railway.app`
   - Son dominios **diferentes**, por lo que las cookies no se comparten
3. Después del login exitoso, el frontend no puede enviar la cookie `access_token` al backend
4. El backend responde con **401 Unauthorized**
5. El frontend intenta refrescar el token, pero también falla con 401
6. **Loop infinito** hasta alcanzar el límite de reintentos

### Solución Implementada

La solución detecta automáticamente si frontend y backend comparten dominio:

- **Cross-domain** (staging Railway): `sameSite: 'none'` (permite cookies cross-site)
- **Same-domain** (localhost, producción): `sameSite: 'lax'` (más seguro)
- **Fallback**: El frontend siempre envía `Authorization: Bearer <token>` como respaldo

---

## Configuración por Ambiente

### 🏠 Desarrollo Local (localhost)

**Backend (.env):**
```bash
NODE_ENV=development
FRONTEND_URL=http://localhost:5173  # Puerto del frontend Vite
BACKEND_URL=http://localhost:3000   # Puerto del backend NestJS
```

**Frontend (.env):**
```bash
VITE_API_BASE_URL=http://localhost:3000
```

**Resultado:**
- ✅ Cookies: `sameSite: 'lax'`, `secure: false`
- ✅ Mismo dominio (localhost)
- ✅ Funciona con cookies y Authorization header

---

### 🚀 Staging (Railway - Dominios Diferentes)

**Backend (Variables de Entorno Railway):**
```bash
NODE_ENV=staging
FRONTEND_URL=https://agave-frontend-staging.up.railway.app
BACKEND_URL=https://agave-backend-staging.up.railway.app
```

**Frontend (Variables de Entorno Railway):**
```bash
VITE_API_BASE_URL=https://agave-backend-staging.up.railway.app
```

**Resultado:**
- ✅ Cookies: `sameSite: 'none'`, `secure: true` (HTTPS requerido)
- ✅ Cross-domain detectado
- ✅ Funciona con `Authorization: Bearer <token>` header
- ⚠️ Las cookies pueden no funcionar, pero el fallback con header SÍ funciona

---

### 🏭 Producción (Backend en Railway)

#### Configuración Real: Cross-Domain (Frontend propio + Backend Railway)

**Arquitectura del Proyecto:**
```bash
# Frontend en dominio propio
Frontend: https://condominioelagave.com.mx

# Backend sigue en Railway
Backend: https://agave-backend-production.up.railway.app
```

**Backend (Variables de Entorno Railway):**
```bash
NODE_ENV=production
FRONTEND_URL=https://condominioelagave.com.mx
BACKEND_URL=https://agave-backend-production.up.railway.app
```

**Frontend (Variables de Entorno):**
```bash
VITE_API_BASE_URL=https://agave-backend-production.up.railway.app
```

**Resultado:**
- ✅ Cookies: `sameSite: 'none'`, `secure: true` (cross-domain detectado)
- ✅ CORS configurado automáticamente para condominioelagave.com.mx
- ✅ Funciona con `Authorization: Bearer <token>` header como fallback
- ✅ Misma configuración que staging, solo cambian las URLs

**Ventajas de esta arquitectura:**
- ✅ Backend en Railway (fácil de mantener y escalar)
- ✅ Frontend en dominio de producción (SEO, branding)
- ✅ Solución implementada maneja cross-domain automáticamente
- ✅ No requiere configuración adicional de infraestructura

---

#### Alternativa: Frontend y Backend en mismo dominio

**Si decides migrar el backend al mismo dominio en el futuro:**

**Configuración:**
```bash
# Frontend en: https://condominioelagave.com.mx
# Backend en: https://condominioelagave.com.mx/api (proxy/reverse proxy)
```

**Backend (.env):**
```bash
NODE_ENV=production
FRONTEND_URL=https://condominioelagave.com.mx
BACKEND_URL=https://condominioelagave.com.mx
```

**Frontend (.env):**
```bash
VITE_API_BASE_URL=https://condominioelagave.com.mx/api
```

**Resultado:**
- ✅ Cookies: `sameSite: 'lax'`, `secure: true` (mismo dominio)
- ✅ Mayor seguridad (cookies httpOnly con sameSite: 'lax')
- ✅ Mejor rendimiento (menos preflight CORS)

**Nota:** Requeriría configurar reverse proxy (nginx, Cloudflare, etc.) para enrutar `/api` al backend en Railway.

---

#### Alternativa: Frontend y Backend en subdominios del mismo dominio

**Si tienes control del dominio y quieres separar servicios:**

**Configuración:**
```bash
# Frontend en: https://app.condominioelagave.com.mx
# Backend en: https://api.condominioelagave.com.mx
```

**Backend (.env):**
```bash
NODE_ENV=production
FRONTEND_URL=https://app.condominioelagave.com.mx
BACKEND_URL=https://api.condominioelagave.com.mx
COOKIE_DOMAIN=.condominioelagave.com.mx  # ← Compartir cookies entre subdominios
```

**Frontend (.env):**
```bash
VITE_API_BASE_URL=https://api.condominioelagave.com.mx
```

**Resultado:**
- ✅ Cookies: `sameSite: 'lax'`, `secure: true` (dominio base compartido)
- ✅ Cookies compartidas con `COOKIE_DOMAIN`
- ✅ Separación clara entre servicios

**Nota:** Requeriría configurar DNS para apuntar `api.condominioelagave.com.mx` al backend en Railway.

---

## Variables de Entorno Requeridas

### Backend (agave-backend)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `FRONTEND_URL` | URL completa del frontend | `https://app.condominioelagave.com.mx` |
| `BACKEND_URL` | URL completa del backend | `https://api.condominioelagave.com.mx` |
| `COOKIE_DOMAIN` | (Opcional) Dominio compartido para cookies | `.condominioelagave.com.mx` |
| `NODE_ENV` | Ambiente de ejecución | `development`, `staging`, `production` |

**IMPORTANTE:**
- `FRONTEND_URL` es **OBLIGATORIO** en todos los ambientes
- `BACKEND_URL` se usa para detectar cross-domain
- Si no se configura `BACKEND_URL`, el sistema asume cross-domain (staging)

### Frontend (agave-front)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL base del backend | `https://api.condominioelagave.com.mx` |

---

## Validación

### ✅ Verificar Configuración Correcta

1. **Revisar logs del backend** al iniciar:
   ```
   ✅ FRONTEND_URL: https://agave-frontend-staging.up.railway.app
   🔐 Cookie Security Config: secure=true (FRONTEND_URL=https://agave-frontend-staging.up.railway.app)
   🍪 Cookie sameSite: none (Frontend: agave-frontend-staging.up.railway.app, Backend: agave-backend-staging.up.railway.app)
   ```

2. **Verificar en DevTools del navegador** (después del login):
   - Application → Cookies → Verificar cookie `access_token`
   - Network → Headers → Verificar `Authorization: Bearer <token>`

3. **Probar peticiones protegidas**:
   ```bash
   # Debe responder 200 OK, NO 401
   GET /user-management/users
   GET /bank-reconciliation/manual-validation/pending
   ```

### ❌ Síntomas de Configuración Incorrecta

- Loop infinito de peticiones con 401
- Cookie `access_token` no se envía en peticiones al backend
- Error: "Session expired. Please login again." después de login exitoso
- Logs del backend: "❌ CORS rejected origin"

---

## Notas Técnicas

### sameSite Explicado

- **`lax`**: Cookie se envía solo en peticiones al mismo dominio (más seguro)
- **`none`**: Cookie se envía en todas las peticiones (requiere `secure: true` y HTTPS)

### Fallback con Authorization Header

El sistema siempre envía el token en el header `Authorization: Bearer <token>`:
- **Ventaja**: Funciona siempre, incluso si las cookies fallan
- **Desventaja**: Menos seguro que httpOnly cookies (vulnerable a XSS)
- **Implementación**: `httpClient.ts` líneas 45-48

### CORS

El backend valida dinámicamente el origen:
```typescript
// main.ts líneas 119-145
app.enableCors({
  origin: (origin, callback) => {
    // Valida que el origin coincida con FRONTEND_URL
  },
  credentials: true,
});
```

---

## Troubleshooting

### Problema: Loop infinito de 401 en staging

**Solución:**
1. Verificar que `BACKEND_URL` esté configurado correctamente
2. Verificar que `FRONTEND_URL` apunte al dominio correcto del frontend
3. Verificar que ambos usen HTTPS en staging
4. Revisar logs del backend para confirmar `sameSite: none`

### Problema: Cookies no se envían en producción

**Solución:**
1. Si usan subdominios, configurar `COOKIE_DOMAIN=.tu-dominio.com`
2. Verificar que `FRONTEND_URL` y `BACKEND_URL` estén configurados
3. Verificar que ambos usen HTTPS

### Problema: CORS rechaza peticiones

**Solución:**
1. Verificar que `FRONTEND_URL` en el backend coincida exactamente con el dominio del frontend
2. No incluir trailing slash en las URLs
3. Revisar logs: "❌ CORS rejected origin"

---

## Checklist de Deployment

### Antes de Desplegar a Staging/Producción

- [ ] Configurar `FRONTEND_URL` en el backend
- [ ] Configurar `BACKEND_URL` en el backend
- [ ] Configurar `VITE_API_BASE_URL` en el frontend
- [ ] Ambos servicios usan HTTPS
- [ ] Verificar variables en Railway/plataforma de deployment
- [ ] Probar login y peticiones protegidas
- [ ] Verificar logs del backend al iniciar

### Después del Deployment

- [ ] Probar login con Google
- [ ] Verificar que no hay loop de 401
- [ ] Verificar que peticiones a `/user-management/users` funcionan
- [ ] Verificar que peticiones a `/bank-reconciliation/*` funcionan
- [ ] Verificar cookies en DevTools
- [ ] Verificar Authorization header en DevTools

---

## Contacto

Si tienes problemas con la configuración, revisa:
1. Logs del backend (buscar mensajes con 🍪 y 🔐)
2. DevTools del navegador (Network y Application tabs)
3. Variables de entorno en Railway/plataforma de deployment
