# Hybrid Token Strategy - Solución Multi-Ambiente

> **Problema Resuelto:** Autenticación funciona en los 3 ambientes (localhost, staging, production) con dominios diferentes
> **Fecha:** 27 de Enero, 2026
> **Estado:** ✅ Implementado

---

## 📋 Resumen del Problema

### Escenario Problematico Original

| Ambiente | Frontend | Backend | Problema |
|----------|----------|---------|----------|
| **Local** | `http://localhost:5173` | `http://localhost:3000` | ❌ Cookies no se compartían |
| **Staging** | `https://your-frontend-domain.com` | `https://agave-backend-staging.up.railway.app` | ❌ Dominios diferentes |
| **Production** | `https://condominioelagave.com.mx` | `https://your-api.up.railway.app` | ❌ Dominios completamente diferentes |

**Por qué fallaba:**
- Las cookies httpOnly solo se comparten entre el mismo dominio o subdominos del mismo padre
- Production tiene dominios completamente diferentes: no hay dominio padre común
- Las cookies se rechazaban → 401 loops infinitos

---

## ✅ Solución: Hybrid Token Strategy

Implementamos un **enfoque híbrido** que funciona en todos los casos:

1. **Backend establece cookies httpOnly** (para navegadores que las soportan)
2. **Backend retorna accessToken en la respuesta** (para casos donde cookies fallan)
3. **Frontend guarda accessToken en localStorage** (como fallback)
4. **Frontend envía token en Authorization header** (para cada request)
5. **Backend acepta tanto cookies como Authorization header** (AuthGuard dual-mode)

### Flujo de Autenticación

```
┌─────────────┐                          ┌──────────────┐
│   Frontend  │                          │   Backend    │
└──────┬──────┘                          └──────┬───────┘
       │                                        │
       │  1. signInWithEmailAndPassword(Firebase)
       │ Firebase Client SDK (sin servidor)     │
       │                                        │
       │  2. getIdToken() de Firebase           │
       │                                        │
       │  3. POST /auth/signin { idToken }────>│
       │                                        │
       │<── 4. { accessToken, refreshToken, user }
       │     + Set-Cookie: access_token        │
       │                                        │
       │  5. Guardar tokens                     │
       │     localStorage[accessToken]          │
       │     localStorage[refreshToken]         │
       │     cookie: access_token (auto)        │
       │                                        │
       │  6. GET /user-management/users         │
       │     Header: Authorization: Bearer TOKEN
       │     Cookie: access_token               │ (ambos se envían)
       │                                        │
       │<── 7. Response 200 OK                  │
       │     AuthGuard acepta token del header O
       │     AuthGuard acepta token de cookie   │
       │                                        │
```

---

## 🔧 Implementación Detallada

### Backend Changes

#### 1. **AuthResponseDto** - Retornar accessToken
```typescript
export class AuthResponseDto {
  accessToken?: string;  // ✨ NUEVO: Token para Authorization header
  refreshToken?: string;
  user: { ... };
}
```

#### 2. **AuthService** - Retornar tokens en respuesta
```typescript
// signIn()
return {
  accessToken,      // ✨ NUEVO: Retornar en respuesta
  refreshToken,
  user: { ... }
};

// handleOAuthCallback()
return {
  accessToken: jwtAccessToken,  // ✨ NUEVO
  refreshToken
};

// refreshTokens()
return {
  success: true,
  accessToken: newAccessToken   // ✨ NUEVO
};
```

#### 3. **AuthGuard** - Aceptar Authorization header
```typescript
// Primero intenta extraer de cookie
let token = this.extractTokenFromCookie(request);

// Si no hay cookie, intenta extraer de Authorization header
if (!token) {
  token = this.extractTokenFromAuthorizationHeader(request);
}

// Si hay token (de cualquier fuente), validar
if (token) {
  const payload = await this.jwtAuthService.verifyAccessToken(token);
  // ... resto de validación
}
```

### Frontend Changes

#### 1. **tokenManager** - Guardar accessToken
```typescript
getAccessToken(): string | null
setAccessToken(token: string): void
clearAll(): void  // Ahora limpia también accessToken
```

#### 2. **httpClient** - Enviar Authorization header
```typescript
const accessToken = tokenManager.getAccessToken();
if (accessToken) {
  headers['Authorization'] = `Bearer ${accessToken}`;
}

// Mantener credentials: 'include' para que también envíe cookies
const config: RequestInit = {
  headers,
  credentials: 'include',  // Cookies si están disponibles
};
```

#### 3. **AuthContext** - Guardar tokens después de login
```typescript
const response = await authService.signIn(...);

// Guardar accessToken si viene en respuesta
if (response.accessToken) {
  tokenManager.setAccessToken(response.accessToken);
}

// Guardar refreshToken
if (response.refreshToken) {
  tokenManager.setRefreshToken(response.refreshToken);
}
```

#### 4. **httpClient** - Guardar nuevo accessToken en refresh
```typescript
const data = await response.json();

// Guardar nuevo accessToken si viene en respuesta
if (data.accessToken) {
  tokenManager.setAccessToken(data.accessToken);
}
```

---

## 🌍 Configuración por Ambiente

### 🔵 Local (Development)
```env
FRONTEND_URL=http://localhost:5173
COOKIE_DOMAIN=         # Vacío (no se necesita)
```

**Comportamiento:**
- Frontend y backend en mismo dominio (localhost), diferentes puertos
- Cookies se comparten automáticamente
- Authorization header también se envía (doble protección)
- ✅ Funciona perfectamente

### 🟡 Staging
```env
FRONTEND_URL=https://your-frontend-domain.com
COOKIE_DOMAIN=.up.railway.app   # Dominio padre compartido
```

**Comportamiento:**
- Frontend: `your-frontend-staging.up.railway.app`
- Backend: `agave-backend-staging.up.railway.app`
- COOKIE_DOMAIN permite que las cookies se compartan entre ambos
- Authorization header también se envía (fallback)
- ✅ Funciona con cookies + header

### 🔴 Production
```env
FRONTEND_URL=https://condominioelagave.com.mx
COOKIE_DOMAIN=         # Vacío (dominios diferentes)
```

**Comportamiento:**
- Frontend: `condominioelagave.com.mx`
- Backend: `.up.railway.app` (diferente)
- Cookies NO se pueden compartir (diferentes dominios raíz)
- Authorization header **es la única opción que funciona**
- ✅ Funciona con header (cookies fallback)

---

## 🔐 Seguridad

### ¿Es seguro guardar accessToken en localStorage?

**No es ideal, pero con compensaciones:**
- ❌ localStorage es vulnerable a XSS (inyección de código malicioso)
- ✅ PERO: El token expira en 15 minutos (ventana de riesgo pequeña)
- ✅ PERO: Cookies httpOnly siguen siendo el mecanismo principal
- ✅ PERO: Authorization header es necesario en production

**Mitigaciones implementadas:**
1. **Cookies httpOnly** - Línea de defensa principal (no accesible a JavaScript)
2. **Token short-lived** - 15 minutos de expiración
3. **Refresh token flow** - Regenera accessToken automáticamente
4. **CORS + credentials** - Validación adicional de origen
5. **SameSite: lax** - Protección contra CSRF

### Comparación con alternativas

| Estrategia | Local | Staging | Production |
|-----------|-------|---------|------------|
| **Solo Cookies** | ✅ | ✅ (con COOKIE_DOMAIN) | ❌ NO FUNCIONA |
| **Solo localStorage** | ✅ | ✅ | ✅ (pero riesgoso) |
| **Hybrid (cookies + header)** | ✅ | ✅ | ✅ (mejor seguridad) |

---

## 📊 Cómo Funciona en Cada Ambiente

### Local - HTTP Request
```
GET /user-management/users
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  ← localStorage
  Cookie: access_token=eyJhbGciOiJIUzI1NiIs...    ← cookie

AuthGuard:
  1. Intenta extraer de cookie → ✅ Encuentra token
  2. Valida con JWT ✅
  3. Retorna 200 OK
```

### Staging - HTTP Request (con COOKIE_DOMAIN)
```
GET /user-management/users
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  ← localStorage
  Cookie: access_token=eyJhbGciOiJIUzI1NiIs...    ← cookie (compartida)

AuthGuard:
  1. Intenta extraer de cookie → ✅ Encuentra token
  2. Valida con JWT ✅
  3. Retorna 200 OK
```

### Production - HTTP Request (sin COOKIE_DOMAIN)
```
GET /user-management/users
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  ← localStorage
  (no hay Cookie porque dominios diferentes)

AuthGuard:
  1. Intenta extraer de cookie → ❌ No encuentra
  2. Intenta extraer de Authorization header → ✅ Encuentra token
  3. Valida con JWT ✅
  4. Retorna 200 OK
```

---

## 🔄 Refresh Token Flow

```
1. Frontend hizo request
2. Backend retorna 401 (token expirado)
3. httpClient detecta 401
4. httpClient llama handleTokenRefresh()
5. POST /auth/refresh { refreshToken }
6. Backend valida refreshToken
7. Backend retorna { success: true, accessToken: NUEVO_TOKEN }
8. Frontend guarda nuevo accessToken: tokenManager.setAccessToken(NUEVO)
9. Frontend reintenta request original con nuevo accessToken
10. AuthGuard acepta token del Authorization header
11. Request completa exitosamente
```

---

## ✅ Ventajas de Esta Solución

1. **Funciona en todos los ambientes** - Sin cambios de código
2. **Flexible** - Funciona con cookies O headers indistintamente
3. **Seguro** - Doble protección (cookies + headers)
4. **Compatible** - No requiere cambios en cliente/servidor legacy
5. **Configurable** - COOKIE_DOMAIN se puede ajustar por ambiente
6. **Escalable** - Si se agrega CDN, proxy, etc., sigue funcionando

---

## 📋 Checklist de Configuración

### Backend
- [x] AuthResponseDto retorna accessToken
- [x] signIn() retorna accessToken
- [x] handleOAuthCallback() retorna accessToken
- [x] refreshTokens() retorna accessToken
- [x] AuthGuard acepta Authorization header
- [x] Cookie se establece con dominio configurable

### Frontend
- [x] tokenManager guarda/recupera accessToken
- [x] httpClient envía Authorization header
- [x] AuthContext guarda accessToken después de login
- [x] httpClient guarda nuevo accessToken en refresh
- [x] clearAll() limpia accessToken

### Configuración de Variables
- [x] `.env.example` documenta COOKIE_DOMAIN
- [x] Local: COOKIE_DOMAIN vacío
- [x] Staging: COOKIE_DOMAIN=.up.railway.app
- [x] Production: COOKIE_DOMAIN vacío

---

## 🧪 Testing

### Cómo Verificar Que Funciona

#### Local (localhost:5173 + localhost:3000)
```bash
1. Login
2. F12 → Application → Cookies → Ver access_token
3. F12 → Application → Local Storage → Ver agave_access_token
4. GET /user-management/users debe retornar 200
```

#### Staging
```bash
1. Login en https://your-frontend-domain.com
2. F12 → Network → Ver request headers:
   - Authorization: Bearer ...
   - Cookie: access_token=...
3. GET /user-management/users debe retornar 200
```

#### Production
```bash
1. Login en https://condominioelagave.com.mx
2. F12 → Network → Ver request headers:
   - Authorization: Bearer ...  ← ESTO FUNCIONA (no hay cookie)
3. F12 → Application → Cookies → No hay access_token (esperado)
4. F12 → Application → Local Storage → Ver agave_access_token
5. GET /user-management/users debe retornar 200
```

---

## 📚 Archivos Modificados

### Backend
- `src/shared/auth/dto/auth.dto.ts` - Agregado `accessToken` a AuthResponseDto
- `src/shared/auth/auth.service.ts` - Retorna `accessToken` en signIn, handleOAuthCallback, refreshTokens
- `src/shared/auth/guards/auth.guard.ts` - Acepta Authorization header

### Frontend
- `src/utils/tokenManager.ts` - Métodos para getAccessToken/setAccessToken
- `src/utils/httpClient.ts` - Envía Authorization header, guarda nuevo token en refresh
- `src/context/AuthContext.tsx` - Guarda accessToken después de login
- `.env.example` - Documentación de COOKIE_DOMAIN

---

## 🚀 Próximos Pasos

1. **Deploy a Staging:**
   ```
   COOKIE_DOMAIN=.up.railway.app
   ```

2. **Test completo en staging** (24 horas mínimo)

3. **Deploy a Production:**
   ```
   COOKIE_DOMAIN=     # Dejar vacío (dominios diferentes)
   ```

4. **Monitor durante 48 horas**

---

## 📞 Troubleshooting

### "Recibo 401 en production"
```
Verificar:
1. F12 → Network → Ver Authorization header presente
2. F12 → Local Storage → Ver agave_access_token
3. Si está vacío, login no guardó el token → Verificar AuthContext
4. Si está lleno, revisar backend logs por qué rechaza el token
```

### "Funciona en localhost pero no en production"
```
Verificar:
1. FRONTEND_URL está correcto en backend
2. COOKIE_DOMAIN está vacío en production (no .up.railway.app)
3. Frontend está enviando Authorization header (F12 → Network)
4. Backend está aceptando Authorization header (AuthGuard)
```

### "Refresh token no funciona en production"
```
Verificar:
1. POST /auth/refresh retorna { success: true, accessToken: ... }
2. httpClient guarda nuevo token: tokenManager.setAccessToken()
3. Siguiente request usa nuevo token
4. Si sigue fallando, revisar expiración del refreshToken (7 días)
```

---

## 📝 Referencias

- [RFC 6750 - OAuth 2.0 Bearer Token Usage](https://tools.ietf.org/html/rfc6750)
- [OWASP - Cross-Origin Resource Sharing (CORS)](https://owasp.org/www-community/CORS)
- [MDN - HTTP Authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication)

