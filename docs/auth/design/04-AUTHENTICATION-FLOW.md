# Flujos de Autenticación y Sincronización

## 🔄 Flujos de Registro y Login

### Caso 1: Registro de Inquilino (Self-Signup)

```
Usuario anónimo
    ↓
    POST /auth/signup
    Body: { email, password, firstName, lastName }
    ↓
[1] AuthService.signUp()
    - Crear usuario en Supabase Auth
    - Genera JWT access_token + refresh_token
    ↓
[2] Opción A: Webhook de Supabase
    - Supabase dispara evento 'user.created'
    - Backend recibe webhook
    - Crea registro en tabla 'users' con role 'inquilino'
    ↓
[3] Opción B: Sincronización Directa en AuthService
    - AuthService crea directamente en tabla 'users'
    - Establece status = 'ACTIVE'
    ↓
[4] AuthGuard valida en requests posteriores
    - Valida JWT
    - Inyecta user en request
    ↓
Respuesta HTTP 201
    { accessToken, refreshToken, user: { id, email, ... } }
```

**Ventajas Opción A (Webhook)**:
- Desacoplamiento: Supabase no depende de BD local
- Escalable: Supabase maneja parte de la lógica
- Redundancia: Si backend falla, el webhook lo reintenta

**Ventajas Opción B (Directo)**:
- Más rápido: Sin latencia de webhook
- Más simple: Todo en un solo servicio
- Transacciones atómicas: Si falla, se revierte todo

---

### Caso 2: Propietario Invita Empleado

```
Propietario (role=propietario)
    ↓
    POST /contractors/invite
    Body: { email, role: 'empleado', description: 'Jardinero' }
    ↓
[1] ContractorService.createInvitation()
    - Genera código único (UUID o string random)
    - Crea registro en 'user_invitations'
    - status = 'pending'
    - expires_at = NOW() + 7 days
    ↓
[2] Envía email a empleado
    - Link: https://frontend/auth/signup?code=xxx
    - Instrucciones de registro
    ↓
Empleado potencial recibe email
    ↓
    Hace clic en link
    ↓
    Rellena formulario en frontend
    ↓
    POST /auth/signup?invitationCode=xxx
    Body: { email, password, firstName, lastName }
    ↓
[3] AuthService.signUpWithInvitation(invitationCode)
    - Valida que invitationCode existe y es válido
    - Valida que invitation.expires_at > NOW()
    - Valida que invitation.status == 'pending'
    - Valida que email coincida
    ↓
[4] Crea usuario en Supabase Auth
    - Email verificado automáticamente
    - (Ya fue validado en invitación)
    ↓
[5] Crea usuario en tabla 'users'
    - role = 'empleado'
    - status = 'ACTIVE'
    ↓
[6] Crea contractor_assignment
    - contractor_id = nuevo usuario
    - owner_id = propietario que invitó
    - role_id = 'empleado'
    ↓
[7] Actualiza invitación
    - status = 'accepted'
    - accepted_at = NOW()
    - accepted_by_user_id = nuevo usuario
    ↓
Respuesta: { accessToken, refreshToken, user: {...} }
```

**Flujo de seguridad**:
1. ✅ Invitación válida (código, fecha, estado)
2. ✅ Email verificado previamente
3. ✅ Usuario auto-vinculado a propietario
4. ✅ Rol asignado automáticamente
5. ✅ No requiere aprobación de admin

---

### Caso 3: Admin Crea Usuario Directamente

```
Admin (role=admin)
    ↓
    POST /auth/admin/create-user
    Body: {
      email: 'user@example.com',
      role: 'propietario',
      firstName: 'Juan',
      lastName: 'Pérez'
    }
    ↓
[1] AdminAuthService.createUser()
    - Genera password temporal (random)
    - Valida que rol es válido
    - Valida permisos del admin (siempre válido)
    ↓
[2] Crea usuario en Supabase Auth
    - email: user@example.com
    - password: temp_random_password
    - email_confirm: true (Admin la verifica)
    - user_metadata: { role, status }
    ↓
[3] Crea registro en tabla 'users'
    - supabase_id = id del usuario Supabase
    - role = propietario
    - status = 'ACTIVE'
    - email_verified = true
    ↓
[4] Envía email al usuario
    - Email: Bienvenido a Agave
    - Contraseña temporal: xxx
    - Link para cambiar contraseña
    - Instrucciones de seguridad
    ↓
[5] Usuario recibe email
    ↓
    POST /auth/signin
    Body: { email, password: 'temp_password' }
    ↓
[6] Backend detecta que es primer login
    - req.query.firstLogin = true
    ↓
[7] Usuario debe cambiar contraseña
    - POST /auth/change-password
    - Body: { oldPassword, newPassword }
    ↓
[8] Contraseña actualizada
    ↓
Usuario completamente configurado
```

**Seguridad**:
1. ✅ Solo admin puede hacer esto
2. ✅ Password temporal obligatorio cambiar
3. ✅ Email enviado con instrucciones
4. ✅ Cambio de contraseña obligatorio al primer login

---

### Caso 4: Login Estándar

```
Usuario
    ↓
    POST /auth/signin
    Body: { email, password }
    ↓
[1] AuthService.signIn()
    - Valida credenciales en Supabase Auth
    ↓
[2] Genera tokens
    - access_token (corta duración: 1 hora)
    - refresh_token (larga duración: 30 días)
    ↓
[3] Actualiza usuario local (opcional)
    - SET last_login = NOW()
    - SET login_count = login_count + 1
    - SET last_login_ip = request.ip
    ↓
[4] Crea audit log
    - action = 'login'
    - status = 'success'
    ↓
Respuesta: { accessToken, refreshToken, user: {...} }
```

---

### Caso 5: Refresh Token

```
Cliente con refresh_token expirado
    ↓
    POST /auth/refresh
    Body: { refreshToken: 'xxx' }
    ↓
[1] AuthService.refreshToken()
    - Valida refresh_token en Supabase
    - Genera nuevo access_token
    ↓
[2] Genera nuevo refresh_token también
    (Rotación de tokens por seguridad)
    ↓
Respuesta: { accessToken, refreshToken }
```

---

### Caso 6: OAuth (Google, Facebook, etc.)

```
Usuario anónimo
    ↓
    GET /auth/oauth/signin?provider=google
    ↓
[1] AuthService.signInWithOAuth()
    - Genera authorization URL de Supabase
    ↓
Respuesta: { url: 'https://accounts.google.com/oauth/authorize...' }
    ↓
Frontend redirige a Google
    ↓
Usuario autoriza
    ↓
Google redirige a:
    https://app.example.com/auth/callback?code=xxx
    ↓
[2] Frontend captura código
    ↓
    GET /auth/oauth/callback?code=xxx
    ↓
[3] AuthService.handleOAuthCallback()
    - Canjea código por sesión
    - Supabase crea usuario si no existe
    ↓
[4] Sincronización igual a Caso 1 o 2
    ↓
Respuesta: { accessToken, refreshToken, user: {...} }
```

---

## 🔗 Sincronización Supabase ↔ PostgreSQL

### Opción A: Webhook de Supabase (Recomendado para producción)

```
┌──────────────────────────────────────────────┐
│ Supabase Auth (auth.users)                   │
│ [evento: user.created]                       │
└─────────────┬────────────────────────────────┘
              │
              │ HTTP POST (webhook)
              │ Body: { type: 'user.created', data: { user: {...} } }
              ↓
┌──────────────────────────────────────────────┐
│ Backend: POST /webhooks/supabase/auth        │
│ (Verificar signature de Supabase)            │
└─────────────┬────────────────────────────────┘
              │
              │ AuthWebhookService.handleUserCreated()
              │
              ├→ Crear en tabla 'users'
              ├→ role = 'inquilino' (por defecto)
              ├→ status = 'ACTIVE'
              └→ Crear audit log
              │
              ↓
┌──────────────────────────────────────────────┐
│ PostgreSQL: users table (nuevo registro)     │
└──────────────────────────────────────────────┘
```

**Ventajas**:
- ✅ No-blocking: Webhook es async
- ✅ Confiable: Supabase reintenta si falla
- ✅ Escalable: Desacoplado
- ✅ Auditable: Timestamp de Supabase

**Desventajas**:
- ❌ Más complejo
- ❌ Latencia inherente (webhook async)
- ❌ Requiere manejar reintentos

**Implementación**:

```typescript
// webhook.controller.ts
@Post('webhooks/supabase/auth')
handleSupabaseAuthEvent(@Body() event: AuthWebhookEvent) {
  // 1. Verificar firma del webhook
  this.verifySupabaseSignature(event);

  // 2. Procesar según tipo
  if (event.type === 'user.created') {
    return this.authWebhookService.handleUserCreated(event.data.user);
  }
  if (event.type === 'user.updated') {
    return this.authWebhookService.handleUserUpdated(event.data.user);
  }
  if (event.type === 'user.deleted') {
    return this.authWebhookService.handleUserDeleted(event.data.user.id);
  }
}

// auth-webhook.service.ts
async handleUserCreated(supabaseUser: User) {
  // Verificar que no existe ya
  const existing = await this.userRepository.findOne({
    where: { supabase_id: supabaseUser.id }
  });

  if (existing) {
    return existing; // Ya sincronizado
  }

  // Crear usuario
  return this.userRepository.create({
    id: v4(), // UUID local
    supabase_id: supabaseUser.id,
    email: supabaseUser.email,
    name: `${supabaseUser.user_metadata?.first_name || ''} ${supabaseUser.user_metadata?.last_name || ''}`,
    role: Role.INQUILINO, // Role por defecto
    status: Status.ACTIVE,
    email_verified: supabaseUser.email_confirmed_at ? true : false,
  });
}
```

---

### Opción B: Sincronización Directa en AuthService

```
┌─────────────────────────────────────────────────────────┐
│ Usuario hace POST /auth/signup                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
        ┌──────────────────────────┐
        │ AuthService.signUp()     │
        └────────────┬─────────────┘
                     │
         ┌───────────┴───────────┐
         ↓                       ↓
    Supabase               PostgreSQL
    (async)                (immediate)
    - signUp()             - create user
    - return tokens        - create assignment
                          - create audit log
         │                       │
         └───────────┬───────────┘
                     ↓
            Transacción atómica
            (si falla, rollback)
```

**Ventajas**:
- ✅ Más rápido: Síncrono
- ✅ Más simple: Un solo lugar
- ✅ Transacciones atómicas: Todo o nada

**Desventajas**:
- ❌ Acoplamiento: AuthService depende de BD
- ❌ Si BD falla, usuario creado en Supabase sin registro local
- ❌ Requiere manejo manual de reconciliación

**Implementación**:

```typescript
// auth.service.ts
async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
  this.ensureEnabled();

  try {
    // 1. Crear en Supabase
    const { data, error } = await this.supabaseClient.auth.signUp({
      email: signUpDto.email,
      password: signUpDto.password,
      options: {
        data: {
          first_name: signUpDto.firstName,
          last_name: signUpDto.lastName,
        },
      },
    });

    if (error || !data.user) {
      throw new BadRequestException(error?.message || 'Signup failed');
    }

    // 2. Crear en PostgreSQL
    const user = await this.userRepository.create({
      id: v4(),
      supabase_id: data.user.id,
      email: data.user.email!,
      name: `${signUpDto.firstName} ${signUpDto.lastName}`,
      role: Role.INQUILINO,
      status: Status.ACTIVE,
    });

    await this.userRepository.save(user);

    // 3. Crear audit log
    await this.auditLogService.log({
      userId: user.id,
      action: 'user_created',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
    });

    return {
      accessToken: data.session?.access_token || '',
      refreshToken: data.session?.refresh_token || '',
      user: {
        id: user.id,
        email: user.email,
      },
    };
  } catch (error) {
    // Log error
    this.logger.error('Signup error', error);
    throw error;
  }
}
```

---

## 🔄 Job de Reconciliación (Ambas Opciones)

Para mantener sincronización, ejecutar periódicamente:

```typescript
// reconciliation.service.ts
@Cron('0 0 * * *') // Cada día a medianoche
async reconcileSupabaseUsers() {
  const supabaseUsers = await this.supabaseAdminClient
    .auth.admin.listUsers();

  for (const supabaseUser of supabaseUsers) {
    const localUser = await this.userRepository.findOne({
      where: { supabase_id: supabaseUser.id }
    });

    if (!localUser) {
      // Usuario en Supabase pero no en BD local
      this.logger.warn(`Orphaned Supabase user: ${supabaseUser.id}`);
      // Crear registro local
      await this.createUserFromSupabase(supabaseUser);
    }
  }
}
```

---

## 📝 Próximos Pasos

1. Elegir entre Webhook o Sincronización Directa
2. Revisar [05-COMPONENTS.md](../architecture/05-COMPONENTS.md)
3. Revisar [06-PERMISSION-MATRIX.md](./06-PERMISSION-MATRIX.md)
4. Implementar flujos en orden de prioridad

---

**Archivo**: `docs/auth/design/04-AUTHENTICATION-FLOW.md`
**Actualizado**: 2025-01-11
**Estado**: Propuesta - Pendiente selección de estrategia
