# Documentación de Autenticación y Sistema de Privilegios

## 📌 Resumen General

Este directorio contiene la documentación completa de autenticación con Firebase Authentication y el sistema de privilegios jerárquico para Agave.

**Estado Actual:** Autenticación implementada con Firebase - Sistema de privilegios pendiente de implementación.

---

## 🔑 Sistema de Autenticación Actual

### Firebase Authentication

El proyecto utiliza **Firebase Authentication** para la gestión de usuarios y autenticación.

**Características implementadas:**
- Autenticación con email y password
- OAuth con Google y Facebook
- JWT tokens (access + refresh)
- Cookies httpOnly para seguridad
- Cross-domain authentication (staging/producción)

**Documentación relacionada:**
- [Cross-Domain Auth Setup](./CROSS_DOMAIN_AUTH_SETUP.md) - Configuración de autenticación cross-domain
- [Firebase Environments](./guides/FIREBASE_ENVIRONMENTS.md) - Configuración de ambientes
- [Hybrid Token Strategy](./guides/HYBRID_TOKEN_STRATEGY.md) - Estrategia híbrida de tokens

---

## 🔐 Sistema de Tokens JWT

### Access Token y Refresh Token

El sistema implementa un flujo dual de tokens:

1. **Access Token**: Token de corta duración para acceso a recursos protegidos
   - Almacenado en: Cookie httpOnly + localStorage (fallback)
   - Enviado en: Authorization header + Cookie
   - Validado por: AuthGuard (dual-mode)

2. **Refresh Token**: Token de larga duración para renovar access tokens
   - Almacenado en: Cookie httpOnly + localStorage (fallback)
   - Usado para: Renovar access token cuando expira

### Seguridad

- **Cookies httpOnly**: Previene acceso desde JavaScript (XSS protection)
- **sameSite policy**:
  - `lax` en same-domain (localhost, producción con dominio compartido)
  - `none` en cross-domain (staging Railway, producción con dominios diferentes)
- **Authorization header fallback**: Funciona incluso si cookies fallan

---

## 🌐 Cross-Domain Authentication

El sistema detecta automáticamente si frontend y backend comparten dominio y ajusta la configuración de cookies:

### Ambientes Soportados

| Ambiente | Frontend | Backend | Cookie Config |
|----------|----------|---------|---------------|
| **Development** | localhost:5173 | localhost:3000 | sameSite: lax |
| **Staging** | agave-frontend.up.railway.app | agave-backend.up.railway.app | sameSite: none |
| **Production** | condominioelagave.com.mx | agave-backend.up.railway.app | sameSite: none |

**Ver:** [CROSS_DOMAIN_AUTH_SETUP.md](./CROSS_DOMAIN_AUTH_SETUP.md) para detalles completos.

---

## 📚 Documentos Disponibles

### Autenticación y Cross-Domain
1. **[CROSS_DOMAIN_AUTH_SETUP.md](./CROSS_DOMAIN_AUTH_SETUP.md)** ⭐ IMPORTANTE
   - Solución completa al problema de cross-domain
   - Configuración por ambiente (dev, staging, producción)
   - Variables de entorno requeridas
   - Troubleshooting y checklist de deployment

2. **[guides/FIREBASE_ENVIRONMENTS.md](./guides/FIREBASE_ENVIRONMENTS.md)**
   - Configuración de NODE_ENV por ambiente
   - Database pool sizing
   - Cookie security configuration
   - Environment validation

3. **[guides/HYBRID_TOKEN_STRATEGY.md](./guides/HYBRID_TOKEN_STRATEGY.md)**
   - Detalles de implementación de la estrategia híbrida
   - Flujo de autenticación completo
   - Cambios en backend y frontend

### Análisis y Diseño (Privilegios - Pendiente Implementación)
4. **[analysis/01-CURRENT-STATE.md](./analysis/01-CURRENT-STATE.md)**
   - Estado actual del sistema de autenticación
   - Fortalezas identificadas
   - Carencias y gaps de funcionalidad

5. **[design/02-PRIVILEGE-HIERARCHY.md](./design/02-PRIVILEGE-HIERARCHY.md)**
   - Propuesta completa de roles jerárquicos
   - Descripción de cada rol
   - Sugerencias de roles adicionales
   - Relaciones entre roles

6. **[design/03-DATA-ARCHITECTURE.md](./design/03-DATA-ARCHITECTURE.md)**
   - Estructura de datos para soportar autenticación
   - Tablas propuestas en PostgreSQL
   - Relaciones de usuarios con casas y contratistas

7. **[design/04-AUTHENTICATION-FLOW.md](./design/04-AUTHENTICATION-FLOW.md)**
   - Flujos de autenticación para cada caso de uso
   - Sincronización Firebase ↔ PostgreSQL
   - Manejo de invitaciones

8. **[architecture/05-COMPONENTS.md](./architecture/05-COMPONENTS.md)**
   - Componentes técnicos necesarios
   - Guards basados en roles
   - Decoradores personalizados
   - Servicios auxiliares

9. **[design/06-PERMISSION-MATRIX.md](./design/06-PERMISSION-MATRIX.md)**
   - Matriz de permisos por rol
   - Desglose de capacidades
   - Validación de acceso

10. **[DECISION-POINTS.md](./DECISION-POINTS.md)** ⚠️ IMPORTANTE
    - Decisiones críticas que necesita tomar
    - Opciones disponibles para cada decisión
    - Impacto de cada opción

---

## 🎯 Plan de Implementación (Sistema de Privilegios - Pendiente)

### Fase 1: Modelo de Datos (Base)
- Crear tablas de roles y permisos
- Extender tabla users con firebase_uid
- Crear relaciones usuario-casa-rol
- Migraciones TypeORM

### Fase 2: Autenticación Mejorada
- Actualizar AuthService para sincronizar usuarios
- Implementar guards y decoradores
- Actualizar enums con nuevos roles

### Fase 3: Servicios de Negocio
- PermissionService: verificar permisos
- UserService: gestión de usuarios
- ContractorService: gestión de contratistas
- InvitationService: sistema de invitaciones

### Fase 4: Endpoints de Control de Acceso
- Crear usuarios como admin
- Invitar empleados/proveedores
- Obtener perfil con permisos
- Cambiar roles

### Fase 5: Testing y Documentación
- Tests de guards y permisos
- Documentación de API
- Ejemplos de uso

---

## 🚀 Quick Start - Autenticación Firebase

### Variables de Entorno Requeridas

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# Application Configuration
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Optional (para subdominios)
COOKIE_DOMAIN=.tu-dominio.com
```

### Flujo de Autenticación

1. Usuario se autentica en el frontend con Firebase Client SDK
2. Frontend obtiene idToken de Firebase
3. Frontend envía idToken al backend
4. Backend verifica idToken con Firebase Admin SDK
5. Backend genera JWT access y refresh tokens
6. Backend establece cookies httpOnly y retorna tokens
7. Frontend guarda tokens en localStorage como fallback
8. Frontend envía tokens en Authorization header en cada request

---

## 📁 Estructura de Directorios

```
docs/auth/
├── INDEX.md (este archivo)
├── CROSS_DOMAIN_AUTH_SETUP.md (configuración cross-domain)
├── DECISION-POINTS.md (decisiones pendientes de privilegios)
├── analysis/
│   └── 01-CURRENT-STATE.md
├── design/
│   ├── 02-PRIVILEGE-HIERARCHY.md
│   ├── 03-DATA-ARCHITECTURE.md
│   ├── 04-AUTHENTICATION-FLOW.md
│   └── 06-PERMISSION-MATRIX.md
├── architecture/
│   └── 05-COMPONENTS.md
└── guides/
    ├── FIREBASE_ENVIRONMENTS.md
    ├── HYBRID_TOKEN_STRATEGY.md
    ├── ENV_VARIABLES_QUICK_REFERENCE.md
    └── VERIFICATION_SCRIPT.md
```

---

## 🔗 Enlaces Relacionados

- **Modules Auth**: `docs/modules/auth/README.md`
- **Current Implementation**: `src/shared/auth/`
- **Database Entities**: `src/shared/database/entities/`
- **Firebase Admin Setup**: `src/shared/libs/firebase/`

---

## 📝 Notas

- Autenticación Firebase está completamente implementada
- Cross-domain authentication funciona en todos los ambientes
- Sistema de privilegios está en fase de análisis y diseño
- Se recomienda usar un enfoque iterativo para implementación
- Los componentes pueden implementarse gradualmente

---

**Última actualización**: 2026-01-27
**Estado Autenticación**: ✅ Implementado con Firebase
**Estado Privilegios**: 🔄 Pendiente decisiones de implementación
