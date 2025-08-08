# Configuración de Autenticación - El Agave

## Configuración de Supabase

### 1. Crear proyecto en Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crea una nueva cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Anota la URL del proyecto y las claves API

### 2. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# App Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 3. Configurar proveedores OAuth en Supabase

#### Google OAuth
1. Ve a Google Cloud Console
2. Crea un proyecto o selecciona uno existente
3. Habilita la API de Google+ 
4. Crea credenciales OAuth 2.0
5. En Supabase: Authentication > Providers > Google
6. Agrega el Client ID y Client Secret

#### Facebook OAuth
1. Ve a Facebook Developers
2. Crea una nueva aplicación
3. Obtén el App ID y App Secret
4. En Supabase: Authentication > Providers > Facebook
5. Agrega las credenciales

#### GitHub OAuth
1. Ve a GitHub Settings > Developer settings > OAuth Apps
2. Crea una nueva aplicación OAuth
3. En Supabase: Authentication > Providers > GitHub
4. Agrega el Client ID y Client Secret

## Endpoints de Autenticación

### Registro
```http
POST /auth/signup
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123",
  "firstName": "Juan",
  "lastName": "Pérez"
}
```

### Inicio de sesión
```http
POST /auth/signin
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

### OAuth (Google, Facebook, etc.)
```http
POST /auth/oauth/signin
Content-Type: application/json

{
  "provider": "google"
}
```

### Refrescar token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "tu_refresh_token"
}
```

### Obtener usuario actual
```http
GET /auth/me
Authorization: Bearer tu_access_token
```

### Cerrar sesión
```http
POST /auth/signout
Authorization: Bearer tu_access_token
```

### Proveedores disponibles
```http
GET /auth/providers
```

## Uso del Guard de Autenticación

Para proteger rutas, usa el decorador `@UseGuards(AuthGuard)`:

```typescript
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth/guards/auth.guard';
import { CurrentUser } from './auth/decorators/current-user.decorator';

@Controller('protected')
@UseGuards(AuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return user;
  }
}
```

## Flujo de OAuth

1. Cliente llama a `/auth/oauth/signin` con el proveedor
2. Servidor retorna URL de redirección
3. Cliente redirige al usuario a la URL
4. Usuario se autentica con el proveedor
5. Proveedor redirige de vuelta a `/auth/oauth/callback`
6. Servidor intercambia el código por tokens
7. Servidor retorna tokens de acceso y refresco

## Estructura de Respuesta

Todas las respuestas de autenticación siguen este formato:

```json
{
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_uuid",
    "email": "usuario@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
``` 