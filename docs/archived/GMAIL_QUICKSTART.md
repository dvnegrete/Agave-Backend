# Gmail API Quick Start - 5 Minutos ⚡

Guía rápida para poner en funcionamiento Gmail API en 5 minutos.

## 🎯 Objetivo

Configurar Gmail API para recibir comprobantes en: `vouchers.agave@gmail.com`

---

## ✅ Checklist Rápido

### 1️⃣ Crear Cuenta Gmail (2 min)

```bash
1. Ir a: gmail.com
2. Crear cuenta → vouchers.agave@gmail.com
3. Configurar contraseña
4. (Opcional) Omitir verificación de teléfono
```

**✅ Resultado**: Tienes buzón de correo funcional

---

### 2️⃣ Habilitar Gmail API en GCP (30 seg)

```bash
# Opción A: CLI
gcloud services enable gmail.googleapis.com

# Opción B: Consola
GCP Console → APIs & Services → Library → "Gmail API" → Enable
```

**✅ Resultado**: Gmail API habilitada en tu proyecto

---

### 3️⃣ Crear OAuth Credentials (1 min)

```bash
GCP Console → APIs & Services → Credentials
→ CREATE CREDENTIALS → OAuth client ID
→ Application type: Web application
→ Name: Vouchers Gmail
→ Authorized redirect URIs: https://developers.google.com/oauthplayground
→ CREATE
```

**📝 Copiar**:
- Client ID
- Client Secret

**✅ Resultado**: Tienes credenciales OAuth

---

### 4️⃣ Obtener Refresh Token (1 min)

```bash
1. Ir a: https://developers.google.com/oauthplayground
2. ⚙️ (gear) → Use your own OAuth credentials
3. Pegar Client ID y Client Secret
4. Scope: https://www.googleapis.com/auth/gmail.readonly
         https://www.googleapis.com/auth/gmail.modify
5. Authorize APIs → Login con vouchers.agave@gmail.com
6. Exchange authorization code for tokens
7. COPIAR "refresh_token"
```

**✅ Resultado**: Tienes refresh token

---

### 5️⃣ Configurar .env (30 seg)

```env
# Agregar a .env
GMAIL_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxx
GMAIL_VOUCHERS_EMAIL=vouchers.agave@gmail.com
```

**✅ Resultado**: App configurada

---

### 6️⃣ Probar (30 seg)

```bash
# Iniciar app
npm run start:dev

# Buscar en logs:
[GmailApiService] Gmail API client initialized successfully ✅

# Enviar email de prueba a: vouchers.agave@gmail.com
# Esperar 5 minutos
# Ver logs: Email procesado ✅
```

---

## 🎉 ¡Listo!

Tu app ahora recibe comprobantes por email automáticamente cada 5 minutos.

---

## 📚 Documentación Completa

Para configuración detallada, troubleshooting y más: [GMAIL_SETUP.md](GMAIL_SETUP.md)

---

## ⚠️ Problemas Comunes

### "Gmail API not configured"
```bash
# Verificar variables
cat .env | grep GMAIL
```

### "invalid_grant"
```bash
# Refresh token inválido, generar nuevo (paso 4)
```

### No se procesan emails
```bash
# Verificar logs cada 5 minutos:
[GmailPollingService] 🔍 Checking for new voucher emails...
```

---

**Tiempo total**: ~5 minutos
**Costo**: $0
**Complejidad**: ⭐⭐ Media
