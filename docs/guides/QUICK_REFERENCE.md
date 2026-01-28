# Quick Reference - Environment Variables

> **Purpose:** Copy-paste configurations for each environment
> **Updated:** 27 de Enero, 2026

---

## ⚡ Copy-Paste Configurations

### 🔵 Development (Local)

```bash
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://user:password@localhost:5432/agave_db
PORT=3000
JWT_SECRET=development-secret-key-change-this

# GCP (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-gcp-project-id
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id
BUCKET_NAME_GCP=your-bucket-name
BUCKET_NAME_VOUCHERS=your-vouchers-bucket-development
```

---

### 🟡 Staging (Railway)

```bash
NODE_ENV=staging
FRONTEND_URL=https://your-frontend-domain.com
DATABASE_URL=<copy-from-railway-postgres>
DIRECT_URL=<copy-from-railway-postgres>
PORT=3000
JWT_SECRET=staging-secret-key-change-this-to-random

# GCP (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-gcp-project-id
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id
BUCKET_NAME_GCP=your-bucket-name
BUCKET_NAME_VOUCHERS=your-vouchers-bucket-development
```

---

### 🔴 Production (Railway)

```bash
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
DATABASE_URL=<copy-from-railway-postgres-prod>
DIRECT_URL=<copy-from-railway-postgres-prod>
PORT=3000
JWT_SECRET=production-very-secure-random-32-chars

# GCP (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-gcp-project-id
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id
BUCKET_NAME_GCP=your-bucket-name
BUCKET_NAME_VOUCHERS=your-vouchers-bucket-production
```

---

## 📊 Configuration Matrix

| Variable | Development | Staging | Production |
|----------|------------|---------|-----------|
| `NODE_ENV` | development | staging | production |
| `FRONTEND_URL` | http://localhost:5173 | https://your-frontend-domain.com | https://your-domain.com |
| Database Pool | 5 | 10 | 20 |
| Query Logging | ON | OFF | OFF |
| Cookie Secure | false | true | true |
| Auto-Sync | ON | OFF | OFF |

---

## ❓ Quick Decision Tree

### Where are you running?
```
Laptop/PC?              → NODE_ENV=development
                           FRONTEND_URL=http://localhost:5173

Railway Testing?        → NODE_ENV=staging
                           FRONTEND_URL=https://your-frontend-domain.com

Railway Real Users?     → NODE_ENV=production
                           FRONTEND_URL=https://your-domain.com
```

---

## 🔑 Critical Rules

1. **FRONTEND_URL is mandatory** - Without it, cookies won't work
2. **NODE_ENV + FRONTEND_URL must match:**
   - `development` + `http://` ✅
   - `staging` + `https://` ✅
   - `production` + `https://` ✅
   - Other combinations ❌

3. **JWT_SECRET must be different** in production vs staging

---

## ✅ Quick Validation

When you start the app:

```
✅ Success:
🔐 Validando configuración de variables de entorno...
✅ All environment variables validated successfully!

❌ Missing FRONTEND_URL:
❌ FATAL ERROR: FRONTEND_URL environment variable is missing!

❌ Wrong NODE_ENV + Protocol:
❌ FATAL ERROR: NODE_ENV="staging" requires HTTPS
```

---

## 🚀 Deploy Commands

### Staging (Railway)
```bash
git push origin development
# Railway auto-deploys on push to development branch
```

### Production (Railway)
```bash
git push origin main
# Railway auto-deploys on push to main branch
```

---

## 🔍 Common Issues

| Error | Solution |
|-------|----------|
| FRONTEND_URL missing | Add to Railway Variables → Variables |
| Wrong FRONTEND_URL | Must start with http:// or https:// |
| NODE_ENV=production + http:// | Use https:// for production |
| 401 authentication loops | Verify FRONTEND_URL is correct |
| DATABASE_URL invalid | Copy exact URL from Railway PostgreSQL |

---

## 📚 Full Documentation

- **[Firebase Environments](../auth/guides/FIREBASE_ENVIRONMENTS.md)** - Detailed environment config
- **[Railway Deployment](./RAILWAY_DEPLOYMENT.md)** - Step-by-step deployment guide

---

**Need details?** See the full guides above.
