# JWT Cookie-Based Authentication System

## Summary

This document describes the production authentication system implementation that uses a hybrid approach: Supabase handles OAuth provider authentication, while the backend generates and validates its own JWT tokens. Access tokens are stored in httpOnly cookies for XSS protection, while refresh tokens are stored in localStorage for client-side session persistence. The system includes authorization guards that leverage JWT-embedded house IDs for fast permission checks without database queries.

## Responsibilities

- **OAuth Integration**: Supabase handles OAuth flows (Google, Facebook, GitHub, Twitter, Discord)
- **Token Generation**: Backend generates stateless JWT access tokens (15min) and refresh tokens (7 days)
- **Token Storage**: Access tokens in httpOnly cookies (secure), refresh tokens in localStorage (client-side)
- **Authentication Validation**: JWT signature verification without external API calls
- **Authorization**: House-level access control using JWT-embedded `houseIds` array
- **Session Refresh**: Automatic token refresh on 401 responses
- **User Synchronization**: Auto-creates PostgreSQL user records from OAuth authentication
- **CSRF Protection**: `sameSite='lax'` cookie attribute prevents cross-site attacks

## Architecture Overview

### Token Flow Diagram

```
┌─────────────┐                    ┌──────────────┐                    ┌─────────────┐
│   Frontend  │                    │   Backend    │                    │  Supabase   │
│   (React)   │                    │  (NestJS)    │                    │   OAuth     │
└──────┬──────┘                    └──────┬───────┘                    └──────┬──────┘
       │                                  │                                   │
       │  1. POST /auth/oauth/signin      │                                   │
       │  { provider: "google" }          │                                   │
       ├─────────────────────────────────>│                                   │
       │                                  │                                   │
       │  2. Return OAuth URL             │  3. Generate OAuth URL            │
       │<─────────────────────────────────┤───────────────────────────────────>
       │                                  │                                   │
       │  4. Redirect to OAuth provider   │                                   │
       ├──────────────────────────────────┼───────────────────────────────────>
       │                                  │                                   │
       │  5. User authenticates           │                                   │
       │<──────────────────────────────────────────────────────────────────────┤
       │                                  │                                   │
       │  6. Redirect to /auth/callback   │                                   │
       │     #access_token=xxx&...        │                                   │
       │<──────────────────────────────────────────────────────────────────────┘
       │                                  │
       │  7. POST /auth/oauth/callback    │
       │  { accessToken: "supabase_jwt" } │
       ├─────────────────────────────────>│
       │                                  │  8. Verify with Supabase
       │                                  │     getUser(accessToken)
       │                                  │
       │                                  │  9. Get/Create user in PostgreSQL
       │                                  │     Query Houses for houseIds
       │                                  │
       │                                  │  10. Generate backend JWT
       │                                  │      - Access token (15min)
       │                                  │      - Refresh token (7d)
       │                                  │
       │  11. Set httpOnly cookie         │
       │      Response Headers:           │
       │      Set-Cookie: access_token=...│
       │      Return: { refreshToken }    │
       │<─────────────────────────────────┤
       │                                  │
       │  12. Store in localStorage:      │
       │      - refreshToken              │
       │      - user data                 │
       │                                  │
       │  13. Authenticated requests      │
       │      Cookie: access_token=...    │
       ├─────────────────────────────────>│
       │                                  │  14. AuthGuard validates JWT
       │                                  │      - Verify signature
       │                                  │      - Extract payload
       │                                  │      - Attach to request.user
       │                                  │
       │  15. Response data               │
       │<─────────────────────────────────┤
```

### Security Model

**Access Token (httpOnly Cookie)**
- **Storage**: Browser cookie with `httpOnly=true`, `sameSite='lax'`
- **Contents**: Full user payload (userId, email, role, houseIds, firstName, lastName, avatar)
- **Lifetime**: 15 minutes
- **Protection**: XSS-immune (JavaScript cannot access), CSRF-resistant (sameSite)
- **Transmission**: Automatically sent with every request to the same origin

**Refresh Token (localStorage)**
- **Storage**: Client-side localStorage
- **Contents**: Minimal payload (userId only)
- **Lifetime**: 7 days
- **Protection**: Vulnerable to XSS, but limited scope (can only refresh tokens)
- **Usage**: Only sent to `/auth/refresh` endpoint when access token expires

## Components

### Backend Components

#### 1. JwtAuthService (`src/shared/auth/services/jwt-auth.service.ts`)

Core JWT operations service.

**Methods:**

- `generateAccessToken(user: User): Promise<string>`
  - Queries `House` table for user's `number_house` values
  - Constructs `JwtAccessPayload` with: sub (userId), email, role, houseIds, firstName, lastName, avatar
  - Signs JWT with `JWT_SECRET` and 15-minute expiration
  - Returns signed JWT string

- `generateRefreshToken(userId: string): Promise<string>`
  - Constructs minimal `JwtRefreshPayload` with only sub (userId)
  - Signs JWT with `JWT_SECRET` and 7-day expiration
  - Returns signed JWT string

- `verifyAccessToken(token: string): Promise<JwtAccessPayload>`
  - Verifies JWT signature using `JWT_SECRET`
  - Throws if token is expired or signature is invalid
  - Returns decoded payload as `JwtAccessPayload`

- `verifyRefreshToken(token: string): Promise<JwtRefreshPayload>`
  - Verifies JWT signature using `JWT_SECRET`
  - Throws if token is expired or signature is invalid
  - Returns decoded payload as `JwtRefreshPayload`

- `getUserHouseIds(userId: string): Promise<number[]>`
  - Queries `House` table: `SELECT number_house WHERE user_id = ?`
  - Returns array of `number_house` values (not database primary keys)
  - Used during access token generation

**Payload Interfaces:**

```typescript
interface JwtAccessPayload {
  sub: string;           // userId (UUID)
  email: string;
  role: string;          // Role enum as string
  houseIds: number[];    // array of number_house values
  firstName?: string;
  lastName?: string;
  avatar?: string;
  iat?: number;          // issued at (set by JWT library)
  exp?: number;          // expiration (set by JWT library)
}

interface JwtRefreshPayload {
  sub: string;           // userId (UUID)
  iat?: number;
  exp?: number;
}
```

#### 2. AuthService (`src/shared/auth/auth.service.ts`)

Main authentication business logic service.

**OAuth Flow Methods:**

- `signInWithOAuth(oAuthDto: OAuthSignInDto): Promise<{ url: string }>`
  - Calls Supabase `auth.signInWithOAuth()` with provider (google, facebook, etc.)
  - Sets `redirectTo` to `{FRONTEND_URL}/auth/callback`
  - Returns OAuth provider URL for frontend redirect
  - No database operations or token generation occurs here

- `handleOAuthCallback(accessToken: string, res: Response): Promise<{ refreshToken: string }>`
  - Receives Supabase `access_token` from frontend (extracted from URL hash)
  - Verifies token with Supabase: `auth.getUser(accessToken)`
  - Queries PostgreSQL for existing user by email
  - If user doesn't exist, creates new user with:
    - `id`: Supabase user ID
    - `email`: from Supabase user object
    - `name`: from `user_metadata.full_name` or email
    - `status`: `Status.ACTIVE`
    - `role`: `Role.TENANT` (default)
  - Calls `jwtAuthService.generateAccessToken(dbUser)` to create backend JWT
  - Calls `jwtAuthService.generateRefreshToken(dbUser.id)` to create refresh token
  - Sets access token in httpOnly cookie:
    - `httpOnly: true` (prevents JavaScript access)
    - `secure: true` (HTTPS only in production)
    - `sameSite: 'lax'` (CSRF protection)
    - `maxAge: 15 * 60 * 1000` (15 minutes)
  - Returns `{ refreshToken }` in response body for localStorage storage

**Password-Based Flow Methods:**

- `signIn(signInDto: SignInDto, res: Response): Promise<AuthResponseDto>`
  - Authenticates with Supabase: `auth.signInWithPassword({ email, password })`
  - Queries PostgreSQL for user by email
  - Throws `BadRequestException` if user not found in database
  - Generates backend JWT access token and refresh token
  - Sets access token in httpOnly cookie (same settings as OAuth)
  - Returns `{ accessToken: refreshToken, refreshToken, user }` (note: `accessToken` field contains refresh token for backward compatibility)

**Token Refresh:**

- `refreshTokens(refreshTokenValue: string, res: Response): Promise<{ success: boolean }>`
  - Verifies refresh token using `jwtAuthService.verifyRefreshToken()`
  - Queries database for user by `payload.sub` (userId)
  - Throws `UnauthorizedException` if user not found
  - Generates new access token with fresh `houseIds`
  - Sets new access token in httpOnly cookie
  - Returns `{ success: true }`
  - **Important**: Does not issue new refresh token; client reuses existing one

**Other Methods:**

- `signUp(signUpDto: SignUpDto): Promise<AuthResponseDto>` - Creates Supabase account (legacy, not used in OAuth flow)
- `getCurrentUser(accessToken: string): Promise<User | null>` - Validates token with Supabase (legacy)
- `signOut(): Promise<void>` - Calls Supabase signOut (minimal usage)

#### 3. AuthController (`src/shared/auth/auth.controller.ts`)

HTTP endpoint handlers.

**Endpoints:**

- `POST /auth/oauth/signin`
  - Body: `{ provider: "google" | "facebook" | ... }`
  - Returns: `{ url: string }` - OAuth provider redirect URL
  - No authentication required

- `POST /auth/oauth/callback`
  - Body: `{ accessToken: string }` - Supabase access_token from URL hash
  - Response: Sets `access_token` cookie, returns `{ refreshToken: string }`
  - Frontend stores refresh token in localStorage
  - No authentication required

- `POST /auth/signin`
  - Body: `{ email: string, password: string }`
  - Response: Sets `access_token` cookie, returns `{ refreshToken, user }`
  - No authentication required

- `POST /auth/refresh`
  - Body: `{ refreshToken: string }` - From localStorage
  - Response: Sets new `access_token` cookie, returns `{ success: boolean }`
  - No authentication required (refresh token validated in service)

- `POST /auth/signout`
  - Requires: AuthGuard (must be authenticated)
  - Response: Clears `access_token` cookie
  - Status: 204 No Content
  - **Important**: Does not invalidate refresh token (stateless JWT limitation)

- `GET /auth/me`
  - Requires: AuthGuard
  - Returns: Current user object from `request.user`

- `GET /auth/providers`
  - Returns: `{ providers: ["google", "facebook", "github", "twitter", "discord"] }`
  - No authentication required

#### 4. AuthGuard (`src/shared/auth/guards/auth.guard.ts`)

Request authentication guard using JWT validation.

**Execution Flow:**

1. Extract token from `request.cookies.access_token`
2. If no token, throw `UnauthorizedException('Token de acceso requerido')`
3. Verify token using `jwtAuthService.verifyAccessToken(token)`
4. Query database for user by `payload.sub`: `SELECT * FROM user WHERE id = ?`
5. If user not found, throw `UnauthorizedException('Usuario no encontrado')`
6. If user status is not `ACTIVE`, throw `UnauthorizedException('Usuario inactivo')`
7. Attach user data to request:
   ```typescript
   request.user = {
     id: payload.sub,
     email: payload.email,
     role: payload.role,
     houseIds: payload.houseIds,  // From JWT, not database
     firstName: payload.firstName,
     lastName: payload.lastName,
     avatar: payload.avatar,
     status: dbUser.status,        // From database
   }
   ```
8. Return `true` to allow request

**Key Behaviors:**

- Does NOT query database for `houseIds` - uses JWT payload
- Does query database to verify user still exists and is active
- JWT verification happens before database query (fail-fast)
- Single database query per request (user lookup only)

#### 5. HouseOwnershipGuard (`src/shared/auth/guards/house-ownership.guard.ts`)

Route-level authorization guard for house-specific endpoints.

**Execution Flow:**

1. Extract `request.user` (must be set by AuthGuard first)
2. If no user, throw `ForbiddenException('User not found')`
3. If user role is `ADMIN`, return `true` (admin bypass)
4. Extract `houseId` from route parameters: `parseInt(request.params.houseId, 10)`
5. If no `houseId`, throw `ForbiddenException('House ID not provided')`
6. Check if `user.houseIds` includes `houseId`
7. If not found, throw `ForbiddenException('You do not have access to this house')`
8. Return `true` to allow request

**Key Behaviors:**

- **Zero database queries**: Uses `houseIds` from JWT payload
- Expects `houseId` route parameter (e.g., `/houses/:houseId/transactions`)
- Route parameter `houseId` represents `number_house`, not database primary key
- Admin users bypass all house ownership checks
- Must be used in conjunction with `AuthGuard`:
  ```typescript
  @UseGuards(AuthGuard, HouseOwnershipGuard)
  ```

### Frontend Components

#### 1. httpClient (`src/utils/httpClient.ts`)

HTTP request wrapper with automatic cookie handling and token refresh.

**Configuration:**

- Sets `credentials: 'include'` on all fetch requests to send cookies
- Automatically handles 401 responses by triggering token refresh
- Prevents infinite retry loops with `MAX_RETRIES_PER_ENDPOINT = 3`

**Token Refresh Logic:**

1. Request receives 401 response (except for auth endpoints)
2. Check retry count; if exceeded, clear tokens and redirect to login
3. Call `handleTokenRefresh()`:
   - Set `isRefreshing = true` to prevent concurrent refreshes
   - Get refresh token from localStorage
   - POST to `/auth/refresh` with `{ refreshToken }`
   - Backend sets new `access_token` cookie automatically
   - Notify all waiting requests that refresh completed
   - Retry original request with new cookie
4. If refresh fails, clear localStorage and redirect to `/login`

**Request Flow:**

```typescript
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // Sends access_token cookie
  body: JSON.stringify(data)
})
```

**Error Handling:**

- 401 on auth endpoints: Immediate failure, no retry
- 401 on other endpoints: Trigger refresh, then retry
- Max 3 retries per endpoint
- Clears retry count on successful response

#### 2. tokenManager (`src/utils/tokenManager.ts`)

localStorage abstraction for refresh tokens and user data.

**Methods:**

- `getRefreshToken(): string | null` - Reads from `agave_refresh_token` key
- `setRefreshToken(token: string): void` - Writes to `agave_refresh_token` key
- `getUser(): User | null` - Reads and parses from `agave_user` key
- `setUser(user: User): void` - Stringifies and writes to `agave_user` key
- `clearAll(): void` - Removes both keys from localStorage

**Data Stored:**

- `agave_refresh_token`: JWT string (7-day expiration)
- `agave_user`: JSON object with `{ id, email, firstName, lastName }`

**Not Stored:**

- Access tokens (stored in httpOnly cookie by backend)

#### 3. AuthContext (`src/context/AuthContext.tsx`)

React context for global authentication state.

**State:**

- `user: User | null` - Current user object
- `isLoading: boolean` - Initial load state
- `isAuthenticated: boolean` - Computed from `!!user`

**Initialization:**

```typescript
useEffect(() => {
  const refreshToken = tokenManager.getRefreshToken();
  const storedUser = tokenManager.getUser();

  if (refreshToken && storedUser) {
    setUser(storedUser);  // Restore session
  }
  setIsLoading(false);
}, []);
```

**Methods:**

- `login(email, password)`:
  - Calls `authService.signIn({ email, password })`
  - Response automatically sets `access_token` cookie
  - Stores `refreshToken` and `user` in localStorage
  - Updates context state
  - Navigates to `/`

- `loginWithOAuth(provider)`:
  - Calls `authService.initOAuthFlow(provider)`
  - Redirects to OAuth provider URL: `window.location.href = response.url`
  - User completes authentication on provider site
  - Provider redirects to `/auth/callback`

- `logout()`:
  - Calls `authService.signOut()` (clears cookie on backend)
  - Clears localStorage
  - Sets `user = null`
  - Navigates to `/login`

- `updateUser(newUser)`:
  - Updates context state and localStorage
  - Used after profile updates or OAuth callback

#### 4. AuthCallback (`src/pages/AuthCallback.tsx`)

OAuth callback handler page.

**Execution Flow:**

1. Extract `access_token` from URL hash fragment:
   ```typescript
   const hashParams = new URLSearchParams(window.location.hash.substring(1));
   const accessToken = hashParams.get('access_token');
   ```
2. If no token, show error and redirect to login
3. Send Supabase token to backend:
   ```typescript
   const response = await authService.handleOAuthCallback(accessToken);
   // Backend verifies token, creates user, sets cookie, returns refreshToken
   ```
4. Backend automatically sets `access_token` cookie in response
5. Parse refresh token JWT to extract user info:
   ```typescript
   const payload = JSON.parse(atob(response.refreshToken.split('.')[1]));
   const user = {
     id: payload.sub,
     email: payload.email,
     firstName: payload.firstName,
     lastName: payload.lastName,
   };
   ```
6. Store in localStorage:
   ```typescript
   tokenManager.setRefreshToken(response.refreshToken);
   tokenManager.setUser(user);
   ```
7. Update AuthContext: `updateUser(user)`
8. Navigate to home: `navigate('/')`

**Error Handling:**

- Missing access token: Show error, redirect to login after 3 seconds
- Backend validation failure: Show error message, redirect to login
- JWT parsing error: Show error, redirect to login

#### 5. authService (`src/services/authService.ts`)

API client for authentication endpoints.

**Methods:**

- `signIn(credentials: { email, password }): Promise<AuthResponse>`
  - POST `/auth/signin`
  - Backend sets `access_token` cookie
  - Returns `{ refreshToken, user }`

- `initOAuthFlow(provider: 'google' | 'facebook'): Promise<{ url: string }>`
  - POST `/auth/oauth/signin`
  - Returns OAuth provider redirect URL

- `handleOAuthCallback(supabaseAccessToken: string): Promise<{ refreshToken: string }>`
  - POST `/auth/oauth/callback`
  - Sends Supabase token for backend validation
  - Backend sets `access_token` cookie
  - Returns `{ refreshToken }`

- `refreshToken(refreshTokenValue: string): Promise<{ success: boolean }>`
  - POST `/auth/refresh`
  - Backend sets new `access_token` cookie
  - Returns `{ success: true }`

- `signOut(): Promise<void>`
  - POST `/auth/signout`
  - Backend clears `access_token` cookie

- `getCurrentUser(): Promise<User>`
  - GET `/auth/me`
  - Returns user object from JWT payload

## Main Flows

### 1. OAuth Authentication Flow

**Step 1: Initiate OAuth**

```typescript
// Frontend: User clicks "Sign in with Google"
await authContext.loginWithOAuth('google');

// Frontend authService calls:
POST /auth/oauth/signin
Body: { provider: "google" }

// Backend AuthService:
const { data } = await supabaseClient.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'http://localhost:5173/auth/callback' }
});
return { url: data.url };

// Frontend receives OAuth URL and redirects:
window.location.href = response.url;
// User leaves app, goes to accounts.google.com
```

**Step 2: User Authenticates**

```
User completes authentication on Google
Google redirects to Supabase
Supabase validates and redirects to frontend callback:
http://localhost:5173/auth/callback#access_token=eyJh...&refresh_token=...
```

**Step 3: Exchange Supabase Token**

```typescript
// Frontend AuthCallback page:
const hashParams = new URLSearchParams(window.location.hash.substring(1));
const supabaseAccessToken = hashParams.get('access_token');

// Send to backend:
POST /auth/oauth/callback
Body: { accessToken: "eyJh..." }

// Backend AuthService.handleOAuthCallback():
// 1. Verify Supabase token
const { data: { user } } = await supabaseClient.auth.getUser(accessToken);

// 2. Get or create user in PostgreSQL
let dbUser = await userRepository.findOne({ where: { email: user.email } });
if (!dbUser) {
  dbUser = userRepository.create({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email,
    status: Status.ACTIVE,
    role: Role.TENANT
  });
  await userRepository.save(dbUser);
}

// 3. Generate backend JWT tokens
const jwtAccessToken = await jwtAuthService.generateAccessToken(dbUser);
// Inside generateAccessToken:
//   - Query houses: SELECT number_house WHERE user_id = dbUser.id
//   - Build payload: { sub, email, role, houseIds, firstName, lastName, avatar }
//   - Sign JWT with 15min expiration

const refreshToken = await jwtAuthService.generateRefreshToken(dbUser.id);
// Inside generateRefreshToken:
//   - Build minimal payload: { sub: dbUser.id }
//   - Sign JWT with 7d expiration

// 4. Set httpOnly cookie
res.cookie('access_token', jwtAccessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000  // 15 minutes
});

// 5. Return refresh token in response body
return { refreshToken };
```

**Step 4: Store Tokens on Frontend**

```typescript
// Frontend AuthCallback receives response:
const response = { refreshToken: "eyJhbG..." };

// Parse refresh token to get user info
const payload = JSON.parse(atob(response.refreshToken.split('.')[1]));
const user = {
  id: payload.sub,
  email: payload.email,
  firstName: payload.firstName,
  lastName: payload.lastName
};

// Store in localStorage
tokenManager.setRefreshToken(response.refreshToken);
tokenManager.setUser(user);

// Update context
updateUser(user);

// Navigate to home
navigate('/');
```

### 2. Password Authentication Flow

```typescript
// Frontend: User submits login form
await authContext.login(email, password);

// Frontend authService:
POST /auth/signin
Body: { email: "user@example.com", password: "secret123" }

// Backend AuthService.signIn():
// 1. Validate with Supabase
const { data } = await supabaseClient.auth.signInWithPassword({
  email: signInDto.email,
  password: signInDto.password
});

// 2. Query PostgreSQL for user
const dbUser = await userRepository.findOne({ where: { email } });

// 3. Generate JWT tokens (same as OAuth)
const accessToken = await jwtAuthService.generateAccessToken(dbUser);
const refreshToken = await jwtAuthService.generateRefreshToken(dbUser.id);

// 4. Set cookie
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000
});

// 5. Return refresh token
return { refreshToken, user: { id, email, firstName, lastName } };

// Frontend stores in localStorage and updates context (same as OAuth)
```

### 3. Authenticated Request Flow

```typescript
// Frontend makes API call
const transactions = await httpClient.get('/houses/123/transactions');

// httpClient automatically includes cookie:
GET /houses/123/transactions
Cookie: access_token=eyJhbGc...
Headers: { credentials: 'include' }

// Backend: AuthGuard intercepts request
// 1. Extract token from cookie
const token = request.cookies?.access_token;

// 2. Verify JWT signature
const payload = await jwtAuthService.verifyAccessToken(token);
// Returns: { sub, email, role, houseIds: [123, 456], firstName, ... }

// 3. Verify user exists and is active
const dbUser = await userRepository.findOne({ where: { id: payload.sub } });
if (!dbUser || dbUser.status !== Status.ACTIVE) {
  throw UnauthorizedException();
}

// 4. Attach user to request
request.user = {
  id: payload.sub,
  email: payload.email,
  role: payload.role,
  houseIds: payload.houseIds,  // From JWT, not DB
  firstName: payload.firstName,
  lastName: payload.lastName,
  avatar: payload.avatar,
  status: dbUser.status
};

// Backend: HouseOwnershipGuard runs next
// 1. Check if user is admin
if (request.user.role === Role.ADMIN) return true;

// 2. Extract house ID from route parameter
const houseId = parseInt(request.params.houseId, 10);  // 123

// 3. Check if houseIds includes this house
if (!request.user.houseIds.includes(houseId)) {
  throw ForbiddenException('You do not have access to this house');
}

// Controller executes and returns data
```

### 4. Token Refresh Flow

```typescript
// Frontend: Access token expired, receives 401
Response: 401 Unauthorized

// httpClient detects 401 (not on auth endpoints)
if (response.status === 401 && endpoint !== '/auth/refresh') {
  await this.handleTokenRefresh();
}

// handleTokenRefresh():
// 1. Get refresh token from localStorage
const refreshToken = tokenManager.getRefreshToken();

// 2. Call backend refresh endpoint
POST /auth/refresh
Body: { refreshToken: "eyJhbGc..." }
Headers: { credentials: 'include' }

// Backend AuthService.refreshTokens():
// 1. Verify refresh token
const payload = await jwtAuthService.verifyRefreshToken(refreshTokenValue);
// Returns: { sub: "user-uuid-123" }

// 2. Query database for user
const dbUser = await userRepository.findOne({ where: { id: payload.sub } });

// 3. Generate NEW access token with FRESH houseIds
const newAccessToken = await jwtAuthService.generateAccessToken(dbUser);
// This re-queries houses to get current houseIds
// Important: If user's house access changed, new token reflects it

// 4. Set new cookie
res.cookie('access_token', newAccessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000
});

// 5. Return success
return { success: true };

// Frontend: Cookie now contains fresh access token
// httpClient retries original request with new cookie
return this.request(endpoint, method, options, retryCount + 1);
```

### 5. Logout Flow

```typescript
// Frontend: User clicks logout
await authContext.logout();

// Frontend calls backend
POST /auth/signout
Cookie: access_token=eyJhbGc...

// Backend AuthController.signOut():
res.clearCookie('access_token');
return Promise.resolve();

// Frontend: Clear localStorage
tokenManager.clearAll();
// Removes: agave_refresh_token, agave_user

// Update context
setUser(null);

// Navigate to login
navigate('/login');
```

## Edge Cases

### 1. Concurrent 401 Responses

**Scenario**: Multiple API calls happen simultaneously, all receive 401 due to expired token.

**Handling**:

```typescript
// httpClient.ts
private isRefreshing: boolean = false;
private refreshSubscribers: ((token: string) => void)[] = [];

private async handleTokenRefresh(): Promise<string | null> {
  if (this.isRefreshing) {
    // Wait for ongoing refresh
    return new Promise((resolve) => {
      this.refreshSubscribers.push(() => resolve('refreshed'));
    });
  }

  this.isRefreshing = true;

  // Perform refresh
  const response = await fetch('/auth/refresh', { ... });

  // Notify all waiting requests
  this.refreshSubscribers.forEach(cb => cb());
  this.refreshSubscribers = [];
  this.isRefreshing = false;
}
```

**Behavior**: Only one refresh request is made; other requests wait for completion then retry.

### 2. Infinite Refresh Loops

**Scenario**: Refresh endpoint itself returns 401 (corrupted refresh token).

**Handling**:

```typescript
// httpClient.ts
if (response.status === 401 &&
    endpoint !== '/auth/refresh' &&
    endpoint !== '/auth/signin' &&
    endpoint !== '/auth/oauth/callback') {
  // Trigger refresh
}
```

**Behavior**: Auth endpoints never trigger refresh; 401 on refresh causes immediate logout.

### 3. Max Retry Prevention

**Scenario**: Backend repeatedly returns 401 even after refresh succeeds.

**Handling**:

```typescript
private requestCount: Map<string, number> = new Map();
private readonly MAX_RETRIES_PER_ENDPOINT = 3;

const requestKey = `${method}:${endpoint}`;
const currentRetries = this.requestCount.get(requestKey) || 0;

if (currentRetries >= this.MAX_RETRIES_PER_ENDPOINT) {
  tokenManager.clearAll();
  window.location.href = '/login';
  throw new Error('Session expired');
}

this.requestCount.set(requestKey, currentRetries + 1);
```

**Behavior**: Each unique endpoint has its own retry counter; after 3 retries, force logout.

### 4. User Deleted While Authenticated

**Scenario**: User is deleted from database but JWT is still valid.

**Handling**:

```typescript
// AuthGuard
const dbUser = await userRepository.findOne({ where: { id: payload.sub } });

if (!dbUser) {
  throw new UnauthorizedException('Usuario no encontrado');
}
```

**Behavior**: Even with valid JWT, request fails if user doesn't exist in database. User must login again.

### 5. User Status Changed to Inactive

**Scenario**: Admin deactivates user account while user is logged in.

**Handling**:

```typescript
// AuthGuard
if (dbUser.status !== Status.ACTIVE) {
  throw new UnauthorizedException('Usuario inactivo');
}
```

**Behavior**: Next request after status change returns 401. User is logged out on frontend.

### 6. House Access Revoked

**Scenario**: User's house is deleted or ownership removed while user has valid access token.

**Problem**: Access token contains cached `houseIds` from 15 minutes ago.

**Handling**:

- Access token remains valid for up to 15 minutes with old `houseIds`
- When token expires, refresh flow re-queries houses:
  ```typescript
  // In generateAccessToken during refresh
  const houseIds = await this.getUserHouseIds(user.id);
  // Fresh query: SELECT number_house WHERE user_id = ?
  ```
- New access token contains updated `houseIds`
- Maximum exposure window: 15 minutes

**Mitigation**: For critical access revocations, implement token invalidation (requires database table tracking issued tokens).

### 7. Missing Refresh Token on Frontend

**Scenario**: localStorage cleared manually or programmatically.

**Handling**:

```typescript
// httpClient.handleTokenRefresh()
const refreshToken = tokenManager.getRefreshToken();

if (!refreshToken) {
  throw new Error('No refresh token available');
}

// Catch block:
catch (error) {
  tokenManager.clearAll();
  window.location.href = '/login';
  return null;
}
```

**Behavior**: Immediate logout and redirect to login page.

### 8. Clock Skew Between Client and Server

**Scenario**: Client clock is ahead of server; JWT appears expired to client but valid to server.

**Handling**: JWT expiration (`exp`) is validated by backend only. Frontend doesn't check expiration, relies on 401 responses.

**Behavior**: No client-side expiration checks prevent premature refresh attempts. Server is source of truth.

### 9. OAuth Provider Returns Error

**Scenario**: User denies permissions or OAuth provider fails.

**Handling**:

```typescript
// AuthCallback.tsx
if (!accessToken) {
  setError('No access token received from OAuth provider');
  setTimeout(() => navigate('/login'), 3000);
  return;
}
```

**Behavior**: Show error message for 3 seconds, then redirect to login.

### 10. Duplicate User Creation (Race Condition)

**Scenario**: User completes OAuth callback twice in rapid succession (e.g., multiple browser tabs).

**Handling**: PostgreSQL unique constraint on `user.email` prevents duplicates. Second request fails database insert.

**Backend Behavior**:

```typescript
// First request
let dbUser = await userRepository.findOne({ where: { email } });
if (!dbUser) {
  dbUser = userRepository.create({ ... });
  await userRepository.save(dbUser);  // Success
}

// Second request (race condition)
let dbUser = await userRepository.findOne({ where: { email } });
if (!dbUser) {
  dbUser = userRepository.create({ ... });
  await userRepository.save(dbUser);  // Throws unique constraint error
}
```

**Mitigation**: Frontend should prevent multiple concurrent callback requests. Backend should handle unique constraint errors gracefully.

## Error Handling

### Backend Errors

**JWT Verification Failures**:

```typescript
// JwtAuthService.verifyAccessToken()
try {
  return this.jwtService.verify(token);
} catch (error) {
  // Throws: TokenExpiredError, JsonWebTokenError
}

// AuthGuard catches and wraps:
throw new UnauthorizedException('Token inválido');
```

**User Not Found**:

```typescript
// AuthService.signIn()
const dbUser = await userRepository.findOne({ where: { email } });
if (!dbUser) {
  throw new BadRequestException('Usuario no encontrado en la base de datos');
}
```

**Inactive User**:

```typescript
// AuthGuard
if (dbUser.status !== Status.ACTIVE) {
  throw new UnauthorizedException('Usuario inactivo');
}
```

**Invalid OAuth Token**:

```typescript
// AuthService.handleOAuthCallback()
const { data: { user }, error } = await supabaseClient.auth.getUser(accessToken);
if (error || !user) {
  throw new UnauthorizedException('Invalid Supabase access token');
}
```

**House Access Denied**:

```typescript
// HouseOwnershipGuard
if (!user.houseIds.includes(houseId)) {
  throw new ForbiddenException('You do not have access to this house');
}
```

### Frontend Errors

**401 Unauthorized**:

```typescript
// httpClient.ts
if (response.status === 401) {
  // Attempt token refresh
  const newToken = await this.handleTokenRefresh();
  if (newToken) {
    // Retry request
    return this.request(endpoint, method, options, retryCount + 1);
  } else {
    // Redirect to login
    window.location.href = '/login';
  }
}
```

**Network Errors**:

```typescript
// httpClient.ts
catch (error) {
  console.error('🚨 [HTTP] Request Failed:', error);
  if (error instanceof Error) {
    throw error;
  }
  throw new Error('An unexpected error occurred');
}
```

**OAuth Callback Errors**:

```typescript
// AuthCallback.tsx
try {
  const response = await authService.handleOAuthCallback(accessToken);
  // Success flow
} catch (err) {
  console.error('❌ [AuthCallback] OAuth callback error:', err);
  setError(err instanceof Error ? err.message : 'Authentication failed');
  setTimeout(() => navigate('/login'), 3000);
}
```

## Dependencies

### Backend Dependencies

**NPM Packages**:

- `@nestjs/jwt` (^10.x) - JWT signing and verification
- `@supabase/supabase-js` (^2.x) - Supabase client for OAuth
- `cookie-parser` (^1.x) - Express middleware for cookie parsing
- `typeorm` (^0.3.x) - Database queries for users and houses

**NestJS Modules**:

- `JwtModule` - Configured with `JWT_SECRET` from environment
- `TypeOrmModule` - Provides `User` and `House` repositories
- `ConfigModule` - Access to environment variables

**Database Entities**:

- `User` - `src/shared/database/entities/user.entity.ts`
  - Fields: `id`, `email`, `name`, `status`, `role`, `avatar`
  - Used for: User lookup, status verification
- `House` - `src/shared/database/entities/house.entity.ts`
  - Fields: `number_house`, `user_id`
  - Used for: Querying user's house IDs for JWT

**Environment Variables**:

```bash
# Supabase Configuration
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# JWT Configuration
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Application
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend Dependencies

**NPM Packages**:

- `react` (^18.x) - UI framework
- `react-router-dom` (^6.x) - Routing and navigation

**Utilities**:

- `httpClient` - `src/utils/httpClient.ts` - HTTP request wrapper
- `tokenManager` - `src/utils/tokenManager.ts` - localStorage abstraction

**Context**:

- `AuthContext` - `src/context/AuthContext.tsx` - Global auth state

**Services**:

- `authService` - `src/services/authService.ts` - Authentication API client

**Environment Variables**:

```bash
VITE_API_URL=http://localhost:3000
```

### Database Schema Requirements

**Users Table**:

```sql
CREATE TABLE user (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR,
  status VARCHAR NOT NULL,  -- ACTIVE, INACTIVE, SUSPENDED
  role VARCHAR NOT NULL,    -- ADMIN, TENANT, OWNER
  avatar VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Houses Table**:

```sql
CREATE TABLE house (
  id SERIAL PRIMARY KEY,
  number_house INTEGER UNIQUE NOT NULL,
  user_id UUID REFERENCES user(id),
  -- other fields...
);
```

**Indexes**:

- `user.email` - Unique index for user lookup
- `house.user_id` - Index for fast house queries by user
- `house.number_house` - Unique index for house identification

## Security Considerations

### XSS Protection

**Access Token in httpOnly Cookie**:

```typescript
res.cookie('access_token', jwtAccessToken, {
  httpOnly: true,  // JavaScript cannot access
  secure: true,    // HTTPS only in production
  sameSite: 'lax', // CSRF protection
});
```

**Impact**: Even if attacker injects malicious JavaScript, they cannot read the access token. Token is only sent by browser with requests.

### CSRF Protection

**SameSite Cookie Attribute**:

```typescript
sameSite: 'lax'  // Blocks cross-site POST requests
```

**Behavior**:

- Cookie sent on same-site requests (frontend to backend)
- Cookie sent on top-level navigation (OAuth redirects)
- Cookie NOT sent on cross-site POST from attacker.com

**Limitation**: `lax` allows GET requests from other sites. Use `strict` for maximum protection (breaks OAuth).

### Refresh Token Exposure

**Risk**: Refresh tokens in localStorage are vulnerable to XSS attacks.

**Mitigation**:

- Refresh token has minimal payload (only `sub`)
- Cannot be used for API requests (only for `/auth/refresh`)
- Short 7-day expiration
- No sensitive data in payload

**Alternative**: Store refresh token in httpOnly cookie. Requires server-side session tracking.

### JWT Payload Tampering

**Protection**: JWT signature prevents tampering.

```typescript
// If attacker modifies payload:
const tampered = { ...payload, role: 'ADMIN' };

// Signature verification fails:
this.jwtService.verify(tamperedToken);  // Throws JsonWebTokenError
```

**Backend Validation**: Always verify JWT signature before trusting payload.

### Token Revocation Limitation

**Issue**: Stateless JWTs cannot be revoked before expiration.

**Scenarios**:

- User changes password: Old tokens remain valid for 15 minutes
- User deleted: Tokens valid until database check in AuthGuard
- Logout: Refresh token remains usable for 7 days

**Current Behavior**:

- Access tokens: 15-minute maximum exposure
- Database check on each request catches deleted users
- Logout clears cookie but doesn't invalidate refresh token

**Production Enhancement**: Implement token blacklist table:

```sql
CREATE TABLE revoked_tokens (
  jti UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
```

Add `jti` (JWT ID) to payload and check blacklist in AuthGuard.

### Man-in-the-Middle (MITM) Attacks

**Protection**: HTTPS in production.

```typescript
secure: process.env.NODE_ENV === 'production'
```

**Development**: Cookies sent over HTTP (insecure). Use HTTPS locally for testing.

### Timing Attacks on Token Validation

**Risk**: Attackers measure response time to determine if token is valid.

**Current Implementation**: No specific timing attack protection. JWT verification time varies based on validity.

**Mitigation**: Use constant-time comparison for sensitive operations (not implemented).

### SQL Injection

**Protection**: TypeORM parameterized queries.

```typescript
// Safe: TypeORM parameterizes automatically
await userRepository.findOne({ where: { email: userInput } });

// TypeORM generates:
SELECT * FROM user WHERE email = $1  -- Parameterized
```

**No raw SQL**: All queries use TypeORM query builder or repository methods.

### Session Fixation

**Not Applicable**: Stateless JWT architecture. No server-side sessions to fix.

### Brute Force Protection

**Not Implemented**: No rate limiting on login attempts.

**Risk**: Attackers can attempt unlimited password guesses.

**Recommendation**: Implement rate limiting on `/auth/signin` endpoint:

```typescript
@UseGuards(ThrottlerGuard)  // NestJS throttler
@Post('signin')
```

### Token Lifetime Balance

**Access Token (15 minutes)**:

- Short lifetime limits exposure if compromised
- Requires frequent refresh (good for catching access revocations)
- Minimal user friction (automatic refresh)

**Refresh Token (7 days)**:

- Long lifetime reduces login frequency
- Stored in localStorage (vulnerable to XSS)
- Compromise allows 7 days of unauthorized access

**Recommendation**: For high-security applications, reduce refresh token lifetime to 24 hours.

## Configuration

### Backend Configuration

**Module Registration** (`src/shared/auth/auth.module.ts`):

```typescript
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, House]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RoleGuard, HouseOwnershipGuard, JwtAuthService],
  exports: [AuthService, AuthGuard, RoleGuard, HouseOwnershipGuard, JwtAuthService],
})
export class AuthModule {}
```

**Middleware Setup** (`src/main.ts`):

```typescript
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with credentials
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,  // Required for cookies
  });

  // Enable cookie parsing
  app.use(cookieParser());

  await app.listen(3000);
}
```

**Environment Variables**:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for signing JWTs (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token expiration (not used, hardcoded) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiration (not used, hardcoded) |
| `SUPABASE_URL` | Yes | - | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | - | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | - | Supabase admin key (optional) |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Frontend URL for CORS and OAuth redirects |
| `NODE_ENV` | No | `development` | Controls cookie `secure` flag |

**JWT Expiration Configuration**:

Note: `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` are defined but not actually used. Expiration is hardcoded:

```typescript
// JwtAuthService.generateAccessToken()
return this.jwtService.sign(payload, {
  expiresIn: '15m',  // Hardcoded, should use config
});

// JwtAuthService.generateRefreshToken()
return this.jwtService.sign(payload, {
  expiresIn: '7d',  // Hardcoded, should use config
});
```

### Frontend Configuration

**API Base URL** (`src/config/api.ts`):

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  authSignIn: '/auth/signin',
  authOAuthSignIn: '/auth/oauth/signin',
  authOAuthCallback: '/auth/oauth/callback',
  authRefresh: '/auth/refresh',
  authSignOut: '/auth/signout',
  authMe: '/auth/me',
};
```

**Environment Variables**:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:3000` | Backend API base URL |

**httpClient Configuration**:

```typescript
const httpClient = new HttpClient(API_BASE_URL);

// Request defaults:
credentials: 'include',       // Send cookies
MAX_RETRIES_PER_ENDPOINT: 3,  // Retry limit
```

**localStorage Keys**:

```typescript
const STORAGE_KEYS = {
  REFRESH_TOKEN: 'agave_refresh_token',
  USER: 'agave_user',
};
```

### Deployment Considerations

**Production Checklist**:

- [ ] Set `NODE_ENV=production` to enable `secure` cookie flag
- [ ] Use strong `JWT_SECRET` (min 32 random characters)
- [ ] Configure `FRONTEND_URL` to production domain for CORS
- [ ] Enable HTTPS on both frontend and backend
- [ ] Set up rate limiting on authentication endpoints
- [ ] Monitor JWT expiration metrics
- [ ] Consider implementing token revocation for critical operations
- [ ] Review and adjust token lifetimes based on security requirements

**CORS Configuration**:

```typescript
// Must allow credentials for cookies
app.enableCors({
  origin: process.env.FRONTEND_URL,  // Specific origin, not '*'
  credentials: true,                  // Required for cookies
});
```

**Cookie Security in Production**:

```typescript
res.cookie('access_token', jwtAccessToken, {
  httpOnly: true,
  secure: true,        // HTTPS only
  sameSite: 'strict',  // Maximum CSRF protection (may break OAuth)
  domain: '.yourdomain.com',  // Share cookie across subdomains
});
```

## Known Limitations

### 1. No Token Revocation

**Issue**: Stateless JWTs cannot be invalidated before expiration.

**Impact**:

- Logout doesn't invalidate refresh token (remains valid for 7 days)
- Password change doesn't invalidate existing tokens
- Deleted users' tokens work until expiration

**Workaround**: AuthGuard queries database on each request to verify user exists and is active.

**Production Fix**: Implement token blacklist table or switch to server-side sessions.

### 2. House Access Propagation Delay

**Issue**: Access token caches `houseIds` for 15 minutes.

**Impact**: If user's house access is revoked, they can still access the house for up to 15 minutes until token expires.

**Workaround**: Critical revocations require token invalidation (see #1).

**Mitigation**: Reduce access token lifetime or implement real-time access checks.

### 3. Hardcoded Token Expiration

**Issue**: Token expiration times are hardcoded in `JwtAuthService`, not read from environment variables.

**Code**:

```typescript
expiresIn: '15m'  // Should be configService.get('JWT_ACCESS_EXPIRES_IN')
```

**Impact**: Cannot adjust token lifetimes without code changes.

**Fix**: Update `generateAccessToken()` and `generateRefreshToken()` to use ConfigService.

### 4. Refresh Token in localStorage

**Issue**: Refresh tokens are vulnerable to XSS attacks when stored in localStorage.

**Impact**: If attacker injects JavaScript, they can steal refresh token and maintain access for 7 days.

**Alternative**: Store refresh token in httpOnly cookie (requires server-side session tracking).

**Recommendation**: For high-security applications, use httpOnly cookie for refresh token.

### 5. No Rate Limiting

**Issue**: No rate limiting on authentication endpoints.

**Impact**: Attackers can brute force passwords or spam OAuth endpoints.

**Recommendation**: Implement `@nestjs/throttler`:

```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60000 } })  // 5 requests per minute
@Post('signin')
```

### 6. OAuth Provider Errors Not Detailed

**Issue**: Frontend shows generic error message on OAuth failures.

**Code**:

```typescript
catch (err) {
  setError(err instanceof Error ? err.message : 'Authentication failed');
}
```

**Impact**: Users don't know if error is due to denied permissions, provider outage, or configuration issue.

**Improvement**: Parse error types and show specific messages.

### 7. No Multi-Device Session Management

**Issue**: Users cannot view or revoke sessions on other devices.

**Impact**: Stolen refresh token cannot be revoked by user.

**Recommendation**: Implement session table with device info:

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  refresh_token_jti UUID NOT NULL,
  device_info VARCHAR,
  created_at TIMESTAMP,
  last_used_at TIMESTAMP
);
```

### 8. Supabase Dependency for Password Auth

**Issue**: Password-based authentication still validates with Supabase.

**Code**:

```typescript
// AuthService.signIn()
await this.supabaseClient.auth.signInWithPassword({ email, password });
```

**Impact**:

- Additional network latency
- External dependency for core functionality
- Supabase outage breaks password login

**Recommendation**: Store password hashes in PostgreSQL and validate locally:

```typescript
const passwordMatch = await bcrypt.compare(password, dbUser.passwordHash);
```

### 9. No Email Verification

**Issue**: OAuth creates users without email verification.

**Code**:

```typescript
dbUser = userRepository.create({
  email: user.email,  // Trusts OAuth provider
  status: Status.ACTIVE,
});
```

**Impact**: Users can immediately access system after OAuth without confirming email.

**Note**: OAuth providers (Google, Facebook) verify emails, so this may be acceptable.

### 10. User Info Extracted from Refresh Token on Frontend

**Issue**: `AuthCallback.tsx` parses refresh token JWT to extract user info.

**Code**:

```typescript
const payload = JSON.parse(atob(response.refreshToken.split('.')[1]));
const user = { id: payload.sub, email: payload.email, ... };
```

**Problem**: Refresh token payload only contains `{ sub: userId }`. No email or name.

**Bug**: This code will fail with `email: undefined`.

**Fix**: Backend should return user object in response body:

```typescript
// AuthService.handleOAuthCallback()
return {
  refreshToken,
  user: {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.name?.split(' ')[0],
    lastName: dbUser.name?.split(' ')[1],
  },
};
```

## Examples

### Example 1: Protecting a Route

**Backend Controller**:

```typescript
@Controller('houses')
export class HousesController {

  @Get(':houseId/transactions')
  @UseGuards(AuthGuard, HouseOwnershipGuard)
  async getTransactions(
    @Param('houseId') houseId: string,
    @CurrentUser() user: any,
  ) {
    // user.houseIds already verified to include houseId
    return this.transactionsService.findByHouse(parseInt(houseId));
  }
}
```

**Execution Flow**:

1. Client sends request: `GET /houses/123/transactions` with cookie
2. `AuthGuard` validates JWT, attaches `user` to request
3. `HouseOwnershipGuard` checks `user.houseIds.includes(123)`
4. If authorized, controller executes

### Example 2: Manual Token Refresh

**Frontend Component**:

```typescript
import { tokenManager } from '../utils/tokenManager';
import { refreshToken } from '../services/authService';

async function manualRefresh() {
  const refreshTokenValue = tokenManager.getRefreshToken();

  if (!refreshTokenValue) {
    console.error('No refresh token available');
    return;
  }

  try {
    await refreshToken(refreshTokenValue);
    // Backend sets new access_token cookie automatically
    console.log('Token refreshed successfully');
  } catch (error) {
    console.error('Refresh failed:', error);
    tokenManager.clearAll();
    window.location.href = '/login';
  }
}
```

### Example 3: Admin Bypass for House Access

**Backend Guard**:

```typescript
@Injectable()
export class HouseOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Admin bypass
    if (user.role === Role.ADMIN) {
      console.log('Admin user, bypassing house ownership check');
      return true;
    }

    // Regular user check
    const houseId = parseInt(request.params.houseId, 10);
    return user.houseIds.includes(houseId);
  }
}
```

**Usage**:

- Admin user can access `/houses/999/transactions` even if they don't own house 999
- Regular user can only access houses in their `houseIds` array

### Example 4: Custom Decorator for User Info

**Backend Decorator** (`src/shared/auth/decorators/current-user.decorator.ts`):

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;  // Set by AuthGuard
  },
);
```

**Usage in Controller**:

```typescript
@Get('profile')
@UseGuards(AuthGuard)
async getProfile(@CurrentUser() user: any) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    houseIds: user.houseIds,
  };
}
```

### Example 5: Conditional Authorization

**Backend Service**:

```typescript
@Injectable()
export class TransactionsService {
  async findByHouse(houseId: number, user: any) {
    // AuthGuard already validated user
    // HouseOwnershipGuard already checked access

    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.houseId = :houseId', { houseId });

    // Admin sees all transactions
    if (user.role === Role.ADMIN) {
      return query.getMany();
    }

    // Regular user sees only their transactions
    query.andWhere('transaction.userId = :userId', { userId: user.id });
    return query.getMany();
  }
}
```

### Example 6: Frontend Auth Check

**React Component**:

```typescript
import { useAuth } from '../hooks/useAuth';

function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <h1>Welcome, {user.firstName}</h1>
      <p>Your houses: {user.houseIds?.join(', ')}</p>
    </div>
  );
}
```

**Note**: `user.houseIds` is not available on frontend user object. This information is only in JWT payload (backend only).

### Example 7: Logout with Cookie Cleanup

**Frontend Logout Function**:

```typescript
async function logout() {
  try {
    // Call backend to clear cookie
    await httpClient.post('/auth/signout');
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with cleanup even if backend fails
  }

  // Clear localStorage
  tokenManager.clearAll();

  // Clear context
  setUser(null);

  // Redirect to login
  navigate('/login');
}
```

**Backend Handler**:

```typescript
@Post('signout')
@UseGuards(AuthGuard)
@HttpCode(HttpStatus.NO_CONTENT)
async signOut(@Res({ passthrough: true }) res: Response): Promise<void> {
  res.clearCookie('access_token');
  return Promise.resolve();
}
```

## Migration Notes

This section is not applicable as this is the initial implementation of the authentication system. No migration from a previous system was performed.

## Performance Characteristics

### Request Latency

**Authenticated Request**:

1. Extract cookie from request: ~0.1ms
2. Verify JWT signature: ~1-2ms (cryptographic operation)
3. Database query for user: ~5-20ms (depends on database load)
4. Attach user to request: ~0.1ms

**Total overhead per authenticated request**: ~6-25ms

**Token Refresh**:

1. Verify refresh token: ~1-2ms
2. Query database for user: ~5-20ms
3. Query database for houses: ~5-20ms (depends on house count)
4. Generate new access token: ~1-2ms
5. Set cookie: ~0.1ms

**Total refresh time**: ~12-45ms

### Database Queries

**Per Authenticated Request**:

- 1 query: `SELECT * FROM user WHERE id = ?`

**Per Token Generation**:

- 1 query: `SELECT * FROM user WHERE email = ?`
- 1 query: `SELECT number_house FROM house WHERE user_id = ?`

**Per Token Refresh**:

- 1 query: `SELECT * FROM user WHERE id = ?`
- 1 query: `SELECT number_house FROM house WHERE user_id = ?`

**Optimization**: AuthGuard queries user on every request. Could cache user for 1-2 minutes in memory (Redis) to reduce database load.

### Cookie Size

**Access Token Cookie**:

```
Cookie: access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwicm9sZSI6IlRFTkFOVCIsImhvdXNlSWRzIjpbMTIzLDQ1Niw3ODldLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJEb2UiLCJpYXQiOjE3MTg5OTk5OTksImV4cCI6MTcxOTAwMDg5OX0.signature_here
```

**Typical size**: ~350-500 bytes (depends on user data and house count)

**Maximum size**: Browsers limit cookies to 4KB. With 100 houses in `houseIds`, JWT is ~600 bytes.

### localStorage Usage

**Stored Data**:

- `agave_refresh_token`: ~200-300 bytes (JWT)
- `agave_user`: ~150-200 bytes (JSON)

**Total**: ~350-500 bytes (negligible for localStorage 5-10MB limit)

### Network Bandwidth

**Per Request**:

- Request cookie overhead: ~400 bytes
- Response Set-Cookie header (on refresh): ~450 bytes

**OAuth Flow**:

- 1 request: POST /auth/oauth/signin (~200 bytes)
- 1 redirect to provider (external)
- 1 redirect back to callback (external)
- 1 request: POST /auth/oauth/callback (~500 bytes)

**Total for OAuth login**: ~700 bytes backend bandwidth + external redirects

### Scalability Considerations

**Stateless Architecture**:

- No server-side session storage required
- Horizontally scalable (any backend instance can validate JWT)
- No session synchronization across instances

**Database Load**:

- 1 query per authenticated request (user lookup)
- Could become bottleneck at high request rates
- Mitigation: Cache user objects in Redis for 1-2 minutes

**JWT Verification**:

- CPU-intensive cryptographic operations
- Scales linearly with request count
- Minimal impact compared to database queries

**Recommendation**: For >10,000 requests/second, implement user caching to reduce database queries.
