# Gmail API Setup Guide

Guía completa para configurar Gmail API y recibir comprobantes por correo electrónico.

## 📋 Tabla de Contenidos

1. [Prerequisitos](#prerequisitos)
2. [Crear Cuenta Gmail Dedicada](#1-crear-cuenta-gmail-dedicada)
3. [Habilitar Gmail API en GCP](#2-habilitar-gmail-api-en-gcp)
4. [Crear OAuth 2.0 Credentials](#3-crear-oauth-20-credentials)
5. [Obtener Refresh Token](#4-obtener-refresh-token)
6. [Configurar Variables de Entorno](#5-configurar-variables-de-entorno)
7. [Verificar Configuración](#6-verificar-configuración)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisitos

- ✅ Proyecto de Google Cloud Platform (GCP)
- ✅ Acceso a GCP Console
- ✅ Cuenta Gmail (puedes crear una nueva)

---

## 1. Crear Cuenta Gmail Dedicada

### Opción A: Usar cuenta Gmail existente

Si ya tienes una cuenta Gmail que quieres usar:
```
✅ Puedes usar: tumail@gmail.com
```

### Opción B: Crear nueva cuenta Gmail (RECOMENDADO)

1. Ir a: https://mail.google.com
2. Click en **"Crear cuenta"**
3. Llenar datos:
   ```
   Nombre: Agave Vouchers
   Usuario: vouchers.agave@gmail.com
   Contraseña: [crear contraseña segura]
   ```
4. **Verificación de teléfono** (opcional):
   - Puedes omitir si Gmail lo permite
   - Si es requerido, usar tu número personal temporalmente

5. ✅ Listo: Tienes buzón de correo real

**Email configurado:** `vouchers.agave@gmail.com` ✉️

---

## 2. Habilitar Gmail API en GCP

### Desde la Consola Web:

1. Ir a: https://console.cloud.google.com
2. Seleccionar tu proyecto existente (el que ya tienes)
3. Ir a: **APIs & Services > Library**
4. Buscar: `Gmail API`
5. Click en **"Gmail API"**
6. Click en **"Enable"** (Habilitar)

### Desde gcloud CLI:

```bash
# Configurar proyecto
gcloud config set project TU_PROYECTO_ID

# Habilitar Gmail API
gcloud services enable gmail.googleapis.com

# Verificar
gcloud services list | grep gmail
# Debería mostrar: gmail.googleapis.com
```

✅ Gmail API habilitada en tu proyecto

---

## 3. Crear OAuth 2.0 Credentials

### Paso 1: Ir a Credentials

1. GCP Console → **APIs & Services** → **Credentials**
2. Click en **"+ CREATE CREDENTIALS"**
3. Seleccionar: **"OAuth client ID"**

### Paso 2: Configurar OAuth consent screen (si es primera vez)

Si te pide configurar consent screen:

```
1. User Type: External
2. App name: Agave Vouchers
3. User support email: tu-email@gmail.com
4. Developer contact: tu-email@gmail.com
5. Scopes: (dejar vacío por ahora)
6. Test users: Agregar vouchers.agave@gmail.com
7. Save and Continue
```

### Paso 3: Crear OAuth Client ID

```
Application type: Web application
Name: Vouchers Gmail Integration

Authorized JavaScript origins:
(dejar vacío)

Authorized redirect URIs:
https://developers.google.com/oauthplayground
```

Click **"CREATE"**

### Paso 4: Copiar Credenciales

Te mostrará un modal con:

```
Client ID: 123456789-xxxxxxxxxxxxxxx.apps.googleusercontent.com
Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx
```

📝 **IMPORTANTE**: Copiar estos valores, los necesitarás en el siguiente paso.

---

## 4. Obtener Refresh Token

Usaremos **OAuth 2.0 Playground** de Google para obtener el refresh token.

### Paso 1: Ir a OAuth Playground

URL: https://developers.google.com/oauthplayground

### Paso 2: Configurar OAuth Playground

1. Click en el ⚙️ (gear icon) arriba a la derecha
2. Marcar ☑️ **"Use your own OAuth credentials"**
3. Llenar:
   ```
   OAuth Client ID: [pegar tu Client ID]
   OAuth Client secret: [pegar tu Client Secret]
   ```
4. Click **"Close"**

### Paso 3: Seleccionar Scopes

En el panel izquierdo:

```
Buscar "Gmail API v1"
Expandir la sección

Marcar:
☑ https://www.googleapis.com/auth/gmail.readonly
☑ https://www.googleapis.com/auth/gmail.modify
```

### Paso 4: Autorizar

1. Click en **"Authorize APIs"** (botón azul)
2. Se abrirá ventana de Google Sign-In
3. **IMPORTANTE**: Login con `vouchers.agave@gmail.com` (la cuenta que creaste)
4. Google te mostrará permisos solicitados:
   ```
   Agave Vouchers wants to:
   - Read, compose, and send emails from your Gmail account
   - View and modify but not delete your email
   ```
5. Click **"Continue"** o **"Allow"**

### Paso 5: Obtener Tokens

1. Serás redirigido al Playground
2. Click en **"Exchange authorization code for tokens"**
3. Verás un JSON con los tokens:

```json
{
  "access_token": "ya29.xxxxxxxxxxxxxxxxx",
  "refresh_token": "1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expires_in": 3599,
  "token_type": "Bearer"
}
```

4. **COPIAR** el `refresh_token` (el que empieza con `1//0...`)

📝 **MUY IMPORTANTE**:
- El `access_token` expira en 1 hora
- El `refresh_token` NO expira (úsalo en tu .env)
- Solo se genera UNA VEZ, guárdalo bien

---

## 5. Configurar Variables de Entorno

### Editar archivo .env

```bash
# Abrir archivo .env
nano .env

# O con tu editor preferido
code .env
```

### Agregar variables Gmail

```env
# ==========================================
# Gmail API Configuration
# ==========================================
GMAIL_CLIENT_ID=123456789-xxxxxxxxxxxxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_VOUCHERS_EMAIL=vouchers.agave@gmail.com
```

### Valores a reemplazar:

| Variable | Valor | Dónde lo obtuviste |
|----------|-------|-------------------|
| `GMAIL_CLIENT_ID` | Client ID completo | Paso 3 - GCP Credentials |
| `GMAIL_CLIENT_SECRET` | Client Secret | Paso 3 - GCP Credentials |
| `GMAIL_REFRESH_TOKEN` | Refresh token (1//0...) | Paso 4 - OAuth Playground |
| `GMAIL_VOUCHERS_EMAIL` | Email de la cuenta | Paso 1 - Gmail |

### Guardar archivo

```bash
# Guardar y cerrar (nano)
Ctrl + O → Enter → Ctrl + X

# VSCode
Ctrl + S
```

---

## 6. Verificar Configuración

### Opción 1: Verificar en logs al iniciar app

```bash
# Iniciar aplicación
npm run start:dev

# Buscar en logs:
[GmailApiService] Gmail API client initialized successfully ✅

# Si ves esto, está configurado correctamente
```

### Opción 2: Enviar email de prueba

```bash
1. Enviar email a: vouchers.agave@gmail.com
2. Asunto: Test Voucher
3. Adjunto: Cualquier imagen o PDF
4. Esperar 5 minutos (polling cada 5 min)
5. Revisar logs de la app:
   [GmailPollingService] 🔍 Checking for new voucher emails...
   [GmailPollingService] 📧 Found 1 unread emails
   [GmailPollingService] Processing email xxx from...
```

### Opción 3: Verificar manualmente con script

Crear archivo temporal `test-gmail.ts`:

```typescript
import { google } from 'googleapis';

async function testGmail() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
    });

    console.log('✅ Gmail API working!');
    console.log('Messages:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGmail();
```

Ejecutar:
```bash
npx ts-node test-gmail.ts
```

---

## Troubleshooting

### ❌ Error: "Gmail API not configured"

**Causa**: Variables de entorno no están configuradas

**Solución**:
```bash
# Verificar que las variables existan
echo $GMAIL_CLIENT_ID
echo $GMAIL_CLIENT_SECRET
echo $GMAIL_REFRESH_TOKEN

# Si están vacías, revisar archivo .env
cat .env | grep GMAIL
```

---

### ❌ Error: "invalid_grant" al obtener access token

**Causa**: Refresh token inválido o expirado

**Solución**:
1. Ir nuevamente a OAuth Playground
2. Revocar acceso en: https://myaccount.google.com/permissions
3. Repetir proceso desde Paso 4 (Obtener nuevo refresh token)

---

### ❌ Error: "Access blocked: This app hasn't been verified"

**Causa**: OAuth consent screen no está en modo Testing con usuarios de prueba

**Solución**:
```
1. GCP Console → APIs & Services → OAuth consent screen
2. Publishing status: Testing
3. Test users: Agregar vouchers.agave@gmail.com
4. Save
5. Repetir autorización
```

---

### ❌ No se reciben emails en el polling

**Causa 1**: Emails ya están marcados como leídos

**Solución**: Enviar nuevo email

**Causa 2**: Polling está deshabilitado

**Solución**:
```bash
# Verificar logs cada 5 minutos
[GmailPollingService] 🔍 Checking for new voucher emails...

# Si no aparece, verificar que ScheduleModule esté habilitado
# en app.module.ts
```

---

### ❌ Error: "Daily limit exceeded"

**Causa**: Excediste cuota diaria de Gmail API (1 billón de requests/día - casi imposible)

**Solución**: Esperar 24 horas o contactar a Google

---

### ❌ Refresh token no se genera

**Causa**: Ya generaste un token antes para esta app

**Solución**:
```
1. Ir a: https://myaccount.google.com/permissions
2. Login con vouchers.agave@gmail.com
3. Buscar "Agave Vouchers"
4. Click "Remove access"
5. Repetir proceso de autorización (Paso 4)
```

---

## 📊 Cuotas y Límites

Gmail API tiene cuotas generosas:

| Operación | Límite Diario | Límite por Usuario |
|-----------|---------------|-------------------|
| Leer emails | 1,000,000,000 | Ilimitado |
| Enviar emails | 100 | 500 |
| Adjuntos | 35MB | - |

**Para tu caso (vouchers):**
- Recibir 10,000 emails/día: ✅ Sin problema
- Procesar 1,000 vouchers/día: ✅ Sin problema

---

## 🔐 Seguridad

### Proteger tus credenciales:

```bash
# NUNCA commitear .env
echo ".env" >> .gitignore

# Verificar que no esté en git
git status

# Si aparece .env, removerlo:
git rm --cached .env
git commit -m "Remove .env from git"
```

### Rotar credenciales:

Si crees que tus credenciales fueron comprometidas:

```
1. GCP Console → Credentials
2. Encontrar "Vouchers Gmail Integration"
3. Click en ⋮ (tres puntos) → Delete
4. Crear nuevas credenciales (repetir desde Paso 3)
```

---

## 📝 Checklist de Configuración

Marca cada paso completado:

- [ ] Cuenta Gmail creada: `vouchers.agave@gmail.com`
- [ ] Gmail API habilitada en proyecto GCP
- [ ] OAuth consent screen configurado
- [ ] OAuth Client ID creado
- [ ] Client ID y Client Secret copiados
- [ ] Refresh token obtenido desde OAuth Playground
- [ ] Variables agregadas a `.env`
- [ ] App iniciada sin errores
- [ ] Email de prueba enviado y procesado

---

## 🎯 Próximos Pasos

Una vez configurado Gmail API:

1. **Enviar email de prueba**:
   ```
   A: vouchers.agave@gmail.com
   Asunto: Comprobante de Pago
   Adjunto: [imagen de comprobante]
   ```

2. **Esperar 5 minutos** (polling automático)

3. **Revisar email de respuesta** con datos extraídos

4. **Ver logs** de procesamiento

---

## 📞 Soporte

Si tienes problemas:

1. Revisar sección [Troubleshooting](#troubleshooting)
2. Verificar logs de la aplicación
3. Verificar cuotas en: https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas

---

**Última actualización**: 2025-11-03
**Versión**: 1.0.0
