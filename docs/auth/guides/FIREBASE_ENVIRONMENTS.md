# Firebase Authentication - Environment Configuration

> **Related to:** Firebase Auth Migration (FASE 5.1 - Staging Deployment)
> **Updated:** 27 de Enero, 2026
> **Status:** ✅ Implementation Ready

---

## 📋 Overview

This document describes how `NODE_ENV` affects Firebase authentication behavior across different environments (Development, Staging, Production). It addresses critical configuration issues that can cause authentication failures.

---

## 🎯 The Problem

Prior to these changes, environment configuration was inconsistent:

- **Staging** used `NODE_ENV=development` settings (5 database connections, query logging)
- **Cookie security** fell back to `NODE_ENV` when `FRONTEND_URL` was missing
- **Result:** 401 authentication loops in Staging due to cookies not being saved in HTTPS

---

## ✅ Solution: Three-Tier Environment Configuration

### Database Pool Sizing by NODE_ENV

| NODE_ENV | Connections | Use Case | Pool Queue | Idle Timeout | Connection Timeout |
|----------|------------|----------|-----------|--------------|-------------------|
| `development` | 5 | Local development | 50 | 10s | 3s |
| `staging` | 10 | Pre-production testing | 75 | 20s | 4s |
| `production` | 20 | Real users, high load | 100 | 30s | 5s |

**Where configured:** `src/shared/config/database.config.ts`

```typescript
// Example: How pool is selected
if (isProduction) {
  poolConfig = this.getProductionPoolConfig();    // 20 connections
} else if (isStaging) {
  poolConfig = this.getStagingPoolConfig();       // 10 connections ← NEW
} else if (isDevelopment) {
  poolConfig = this.getDevelopmentPoolConfig();   // 5 connections
} else {
  poolConfig = this.getDefaultPoolConfig();       // 10 connections
}
```

---

## 🔐 Cookie Security Configuration

### Critical Rule: FRONTEND_URL is Mandatory

**Location:** `src/shared/auth/auth.service.ts` - `getCookieSecureFlag()` method

```typescript
private getCookieSecureFlag(): boolean {
  const frontendUrl = this.configService.get<string>('FRONTEND_URL');

  // ❌ CRITICAL: FRONTEND_URL is REQUIRED
  if (!frontendUrl || frontendUrl.trim() === '') {
    throw new Error(
      'FRONTEND_URL environment variable is required for cookie security configuration'
    );
  }

  // ✅ Cookie security is ONLY based on protocol, not NODE_ENV
  return frontendUrl.startsWith('https://');
}
```

**Key Points:**
- 🚫 Never rely on `NODE_ENV` for cookie security decisions
- ✅ Always use the actual `FRONTEND_URL` protocol to determine security
- 🔒 `secure: true` if HTTPS, `secure: false` if HTTP (local development)

---

## 🌍 Environment-Specific Configurations

### 🔵 Development (Local Machine)

**Environment Variables:**
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://user:password@localhost:5432/agave_db
JWT_SECRET=development-secret-key-change-this

# GCP (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-project
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id
```

**Database Behavior:**
- Pool: **5 connections**
- Query Logging: **ON** (visible in console for debugging)
- Auto-Sync: **ON** (schema changes auto-apply)
- TypeORM Logging: **ON**

**Security:**
- Cookie `secure: false` (HTTP local protocol)
- No CORS restrictions (localhost)

**Use Cases:**
- Local feature development
- Database schema experimentation
- Query debugging

**⚠️ Caveats:**
- Not representative of production
- Small pool causes false performance positives
- Verbose logging can affect local performance

---

### 🟡 Staging (Railway)

**Environment Variables:**
```env
NODE_ENV=staging
FRONTEND_URL=https://your-frontend-domain.com
DATABASE_URL=postgresql://... (Railway staging database)
JWT_SECRET=staging-secret-key-different-from-prod

# GCP (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-project
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id
BUCKET_NAME_DOCUMENTS=your-bucket-name
BUCKET_NAME_VOUCHERS=your-vouchers-bucket-development
```

**Database Behavior:**
- Pool: **10 connections** ← NEW: Intermediate sizing
- Query Logging: **OFF** (no performance overhead)
- Auto-Sync: **OFF** (manual migrations only)
- TypeORM Logging: **OFF**

**Security:**
- Cookie `secure: true` (HTTPS protocol)
- CORS validates origin matches FRONTEND_URL
- All security checks enabled

**Use Cases:**
- Pre-production validation
- Load testing with realistic throughput
- Smoke testing with multiple concurrent users (10-50)
- Performance baseline establishment

**✅ Advantages:**
- Realistic pool sizing (not too small like dev, not too big like prod)
- No logging overhead → real performance metrics
- Mirrors production configuration closely
- Safe for stress testing

---

### 🔴 Production (Railway)

**Environment Variables:**
```env
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
DATABASE_URL=postgresql://... (Railway production database)
JWT_SECRET=production-secret-key-very-secure-random-32-chars

# GCP (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-project
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id
BUCKET_NAME_DOCUMENTS=your-bucket-name
BUCKET_NAME_VOUCHERS=your-vouchers-bucket-production
```

**Database Behavior:**
- Pool: **20 connections** (maximum throughput)
- Query Logging: **OFF**
- Auto-Sync: **OFF** (all schema changes via migrations)
- TypeORM Logging: **OFF**

**Security:**
- Cookie `secure: true` (HTTPS required)
- All security checks enabled
- Strict error handling
- Monitoring active

**Use Cases:**
- Real user traffic
- Production deployment
- High-concurrency scenarios

**⚠️ Critical Considerations:**
- No query logging → debugging in production is difficult
- Manual migrations required for schema changes
- Requires database backups and disaster recovery plan
- Monitoring and alerting must be active

---

## ✅ Validation on Bootstrap

When the backend starts, it validates environment configuration:

### Success (Development)
```
🔐 Validando configuración de variables de entorno...
📋 Environment: development
✅ FRONTEND_URL: http://localhost:5173
✅ All environment variables validated successfully!
```

### Success (Staging)
```
🔐 Validando configuración de variables de entorno...
📋 Environment: staging
✅ FRONTEND_URL: https://your-frontend-domain.com
✅ All environment variables validated successfully!
```

### Failure (Missing FRONTEND_URL)
```
❌ FATAL ERROR: FRONTEND_URL environment variable is missing!

   This is REQUIRED in all environments for cookie security configuration.

   Configure FRONTEND_URL in your environment:
   - Development: FRONTEND_URL=http://localhost:5173
   - Staging: FRONTEND_URL=https://your-frontend-domain.com
   - Production: FRONTEND_URL=https://your-domain.com

   And ensure GCP credentials are configured: PROJECT_ID_GCP, PRIVATE_KEY_ID, PRIVATE_KEY_GCP, CLIENT_EMAIL_GCP, CLIENT_ID_GCP

Process exit(1)
```

### Failure (Incompatible NODE_ENV + FRONTEND_URL)
```
❌ FATAL ERROR: NODE_ENV="staging" requires HTTPS but FRONTEND_URL is HTTP!

   Current: http://localhost:5173

   For staging environment, FRONTEND_URL must be HTTPS.
   This is required for cookie security (secure flag).

Process exit(1)
```

---

## 📊 Behavior Comparison

### Query Logging Impact

| Scenario | NODE_ENV | Query Logging | Impact |
|----------|----------|---------------|--------|
| Local development | development | ON | ~5MB logs per hour |
| Smoke test (50 users, 1h) | staging | OFF | 0MB overhead |
| Smoke test (50 users, 1h) | development ❌ | ON | ~50MB logs (DON'T DO) |
| Production monitoring | production | OFF | 0MB overhead |

---

## 🔍 Common Configuration Errors

### Error 1: Missing FRONTEND_URL

**Symptom:**
```
❌ FATAL ERROR: FRONTEND_URL environment variable is missing!
```

**Cause:** Variable not set in `.env` or Railway

**Solution:**
```bash
# In Railway Dashboard → Backend → Variables
FRONTEND_URL=https://your-frontend-domain.com

# Then redeploy
```

---

### Error 2: Wrong FRONTEND_URL Format

**Symptom:**
```
❌ FATAL ERROR: FRONTEND_URL must start with http:// or https://
```

**Cause:** Missing protocol in URL

**Solution:**
```bash
# ❌ WRONG:
FRONTEND_URL=localhost:5173
FRONTEND_URL=your-frontend-domain.com

# ✅ CORRECT:
FRONTEND_URL=http://localhost:5173
FRONTEND_URL=https://your-frontend-domain.com
```

---

### Error 3: Incompatible NODE_ENV + FRONTEND_URL

**Symptom:**
```
❌ FATAL ERROR: NODE_ENV="staging" requires HTTPS but FRONTEND_URL is HTTP!
```

**Cause:** Staging/Production with HTTP URL (insecure)

**Solution:**
```bash
# For staging/production, ALWAYS use HTTPS
FRONTEND_URL=https://your-domain.com

# HTTP is only valid for development
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

### Error 4: 401 Authentication Loops

**Symptom:** Endless 401 responses, authentication fails silently

**Possible Causes:**
1. `FRONTEND_URL` not configured
2. `FRONTEND_URL` has wrong protocol
3. Firebase credentials invalid
4. Cookies not being saved

**Solution:**
```bash
# 1. Verify FRONTEND_URL is set
echo $FRONTEND_URL

# 2. Verify protocol matches environment
# If using HTTPS, must be NODE_ENV=staging or production

# 3. Check browser: F12 → Application → Cookies
# access_token cookie should be present after login

# 4. Verify GCP credentials (used for Firebase Auth)
PROJECT_ID_GCP=your-project
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="..."  # Must have \n for line breaks
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id
```

---

## 🚀 Deployment Checklist

### Before Staging Deployment

- [ ] `NODE_ENV=staging` configured in Railway
- [ ] `FRONTEND_URL=https://your-frontend-domain.com` exact match
- [ ] DATABASE_URL points to staging database
- [ ] GCP credentials configured (PROJECT_ID_GCP, PRIVATE_KEY_GCP, CLIENT_EMAIL_GCP, CLIENT_ID_GCP)
- [ ] Backups configured (though staging data isn't critical)

### Before Production Deployment

- [ ] `NODE_ENV=production` configured in Railway
- [ ] `FRONTEND_URL=https://your-domain.com` exact match
- [ ] DATABASE_URL points to production database
- [ ] GCP credentials configured (PROJECT_ID_GCP, PRIVATE_KEY_GCP, CLIENT_EMAIL_GCP, CLIENT_ID_GCP)
- [ ] JWT_SECRET is different from staging
- [ ] Database backups tested and working
- [ ] Automatic backups configured
- [ ] Monitoring/alerting active
- [ ] Rollback plan documented

---

## 📈 Performance Implications

### Local Development (NODE_ENV=development)
- Response time: 200-500ms (with logging overhead)
- Concurrent users: ~5 (limited by 5 connections)
- Suitable for: Single developer local testing

### Staging (NODE_ENV=staging)
- Response time: 100-300ms (no logging overhead)
- Concurrent users: ~10-50 (10 connection pool)
- Suitable for: Team testing, performance baseline, load testing

### Production (NODE_ENV=production)
- Response time: 50-200ms (optimized)
- Concurrent users: >100 (20 connection pool)
- Suitable for: Real users, high throughput

---

## 📚 Related Documentation

- **[Firebase Auth Implementation](../implementation/)** - Technical implementation details
- **[Railway Deployment Guide](../../guides/RAILWAY_DEPLOYMENT.md)** - How to configure Railway
- **[Quick Reference](../../guides/QUICK_REFERENCE.md)** - Copy-paste configurations

---

## 🔑 Key Takeaways

1. **NODE_ENV controls pool sizing** - Critical for environment-appropriate resources
2. **FRONTEND_URL is mandatory** - Never fallback to NODE_ENV for security decisions
3. **Cookie security is protocol-based** - HTTPS → secure=true, HTTP → secure=false
4. **Staging pool (10) is intentional** - Not development-sized, not production-sized
5. **Bootstrap validates everything** - Catches configuration errors immediately

---

**Questions?** See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for copy-paste configurations or troubleshooting.
