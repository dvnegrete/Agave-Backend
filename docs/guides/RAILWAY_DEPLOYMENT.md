# Railway Deployment Guide

> **Context:** Deploying Agave Backend to Railway (Staging and Production)
> **Updated:** 27 de Enero, 2026
> **Status:** ✅ Ready to Implement

---

## 📋 Overview

This guide provides step-by-step instructions for deploying Agave Backend to Railway across environments.

---

## 🎯 Environment Configuration Matrix

| Environment | NODE_ENV | FRONTEND_URL | Branch | Database |
|-------------|----------|--------------|--------|----------|
| **Staging** | `staging` | `https://your-frontend-domain.com` | `development` | Staging DB |
| **Production** | `production` | `https://your-domain.com` | `main` | Production DB |

---

## 🟡 STAGING: Step-by-Step Setup

### Step 1: Access Railway Dashboard

1. Go to https://railway.app
2. Sign in with your account
3. Select or create project "Your Backend Staging"
4. Click **Variables** tab

### Step 2: Configure Environment Variables

**Copy these exact values:**

```env
# Environment
NODE_ENV=staging

# Frontend (MUST match your frontend URL)
FRONTEND_URL=https://your-frontend-domain.com

# Database (Copy from your Railway PostgreSQL instance)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway?pgbouncer=true
DIRECT_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

# JWT
JWT_SECRET=staging-secret-key-change-this-to-random-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# GCP Configuration (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-gcp-project-id
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id

# Storage
BUCKET_NAME_GCP=your-bucket-name
BUCKET_NAME_VOUCHERS=your-vouchers-bucket-development

# Optional: External Services
OPENAI_API_KEY=sk-proj-YOUR_KEY
PORT=3000
```

### Step 3: Verify Database Connection

1. In Railway, go to **Services** → **PostgreSQL**
2. Note the **DATABASE_URL** from the environment
3. Copy it exactly to your backend configuration
4. Ensure database is running (green status)

### Step 4: Deploy from GitHub

**Option A: Automatic Deployment**
1. Railway → Backend Service → **Settings** → **Deploy on Push**
2. Enable if not already enabled
3. Push to `development` branch: `git push origin development`
4. Railway automatically builds and deploys

**Option B: Manual Deployment**
```bash
cd agave-backend

# Link to Railway
railway link

# Deploy
railway deploy

# View logs
railway logs
```

### Step 5: Validate Deployment

**Check logs in Railway:**

```bash
railway logs

# Look for:
🔐 Validando configuración de variables de entorno...
📋 Environment: staging
✅ FRONTEND_URL: https://your-frontend-domain.com
✅ All environment variables validated successfully!

# Then:
🔍 Verificando conectividad con la Base de Datos...
✅ Database connected successfully
✅ Server started on port 3000
```

**If you see errors:**
- ❌ `FRONTEND_URL is missing` → Add it to Variables
- ❌ `DATABASE_URL invalid` → Copy exact URL from PostgreSQL service
- ❌ `GCP config unavailable` → Verify PRIVATE_KEY_GCP has `\n` for line breaks and all variables are configured

### Step 6: Smoke Testing

```
1. Frontend test:
   → Visit https://your-frontend-domain.com
   → Should load without CORS errors

2. Login test:
   → Click login
   → Try email/password signup or OAuth
   → Should succeed (no 401 loops)

3. Multi-user test:
   → Open 3 browser windows
   → Login in each simultaneously
   → All should work without conflicts

4. Performance test:
   → Check response times
   → Should be < 500ms
   → No hanging requests

5. Cookie validation:
   → F12 → Application → Cookies
   → Should see 'access_token' after login
   → Should be marked as Secure, HttpOnly
```

---

## 🔴 PRODUCTION: Step-by-Step Setup

### ⚠️ CRITICAL: Understand the Implications

**Production means:**
- ✅ Real users will access this
- ✅ Database contains important data
- ✅ Changes can cause downtime
- ✅ Backups are CRITICAL
- ✅ Monitoring is CRITICAL

### Step 1: Create Separate Project (Recommended)

1. In Railway, click **+ New Project**
2. Name it: "Your Backend Production"
3. Do NOT reuse staging project
4. This ensures data isolation

### Step 2: Add PostgreSQL Database

1. **New Service** → **PostgreSQL**
2. Wait for database to initialize
3. Copy `DATABASE_URL` from PostgreSQL service variables
4. Copy `DIRECT_URL` (same URL, remove `?pgbouncer=true`)

### Step 3: Configure Environment Variables

**Copy these exact values (DIFFERENT from Staging):**

```env
# Environment
NODE_ENV=production

# Frontend (PRODUCTION domain)
FRONTEND_URL=https://your-domain.com

# Database (Production DB)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway?pgbouncer=true
DIRECT_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

# JWT (⚠️ MUST BE DIFFERENT FROM STAGING)
JWT_SECRET=production-secret-key-very-secure-random-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# GCP Configuration (for Firebase Auth, Vision API, Cloud Storage)
PROJECT_ID_GCP=your-gcp-project-id
PRIVATE_KEY_ID=your-private-key-id
PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
CLIENT_EMAIL_GCP=your-service-account@your-project.iam.gserviceaccount.com
CLIENT_ID_GCP=your-client-id

# Storage (Production buckets)
BUCKET_NAME_GCP=your-bucket-name
BUCKET_NAME_VOUCHERS=your-vouchers-bucket-production  ← Different from staging

# Optional: External Services
OPENAI_API_KEY=sk-proj-YOUR_KEY
PORT=3000
```

### Step 4: Backup Database BEFORE First Deploy

**CRITICAL: Do this before deploying any code to production**

1. In Railway → PostgreSQL → **Backups**
2. Click **Create Manual Backup**
3. Wait for backup to complete
4. Download or save backup reference

**Enable automatic backups:**
1. PostgreSQL Service → **Backups**
2. Enable **Automatic Backups**
3. Set frequency: Daily
4. Retention: Minimum 7 days

### Step 5: Deploy Production

**Option A: Blue-Green Deployment (Recommended)**

1. **Staging still running** (Blue)
2. Deploy to Production (Green)
3. Validate production works
4. Switch traffic (if using load balancer)
5. Keep Staging as rollback

```bash
# Deploy to production
git push heroku-prod main:main
# (assuming heroku-prod is configured for production)
```

**Option B: Direct Deployment (Faster, More Risk)**

```bash
# Deploy directly
git push heroku-prod main:main

# Validate immediately
railway logs

# If error: rollback to previous commit
```

### Step 6: Validate Production Deployment

**Check logs:**

```bash
railway logs

# Look for success:
🔐 Validando configuración de variables de entorno...
📋 Environment: production
✅ FRONTEND_URL: https://your-domain.com
✅ All environment variables validated successfully!

🔍 Verificando conectividad con la Base de Datos...
✅ Database connected successfully
✅ Server started on port 3000
```

**Test in production:**
1. Visit https://your-domain.com
2. Try signup/login
3. Should work without errors
4. Check response times (should be <200ms)

### Step 7: Active Monitoring (First 24 Hours)

**Check every 1-2 hours:**

- [ ] Logs for errors (none expected)
- [ ] Database connection status OK
- [ ] Response times normal (<200ms)
- [ ] No 401/403/500 errors
- [ ] Users can login/logout

**Keep on alert:**
- [ ] Slack/Email notifications enabled
- [ ] Phone available for emergencies
- [ ] Rollback plan ready if needed

---

## 📊 Comparison: Staging vs Production

| Aspect | Staging | Production |
|--------|---------|-----------|
| NODE_ENV | staging | production |
| FRONTEND_URL | development-url | production-url |
| Database | Separate (test data OK) | Separate (real data) |
| Pool Size | 10 connections | 20 connections |
| Query Logging | OFF | OFF |
| Auto-Sync | OFF | OFF |
| Backups | Manual | Automatic Daily |
| Monitoring | Relaxed | Critical 24/7 |
| Rollback | Easy | Planned |
| JWT_SECRET | staging-123 | production-xyz |

---

## 🔄 Workflow: Development → Staging → Production

```
1. LOCAL DEVELOPMENT
   └─ Code changes on development branch
   └─ npm run build && npm run start
   └─ Test locally with NODE_ENV=development

2. PUSH TO GITHUB
   └─ git commit changes
   └─ git push origin development
   └─ GitHub → Railway auto-deploys to Staging

3. STAGING VALIDATION
   └─ Railway auto-deploys on push
   └─ Smoke testing (1-2 hours)
   └─ Validate with real-like load

4. MERGE TO MAIN
   └─ git checkout main
   └─ git merge development
   └─ git push origin main

5. PRODUCTION DEPLOYMENT
   └─ git push heroku-prod main:main
   └─ Railway deploys to production
   └─ Quick validation
   └─ Active monitoring

6. POST-DEPLOYMENT
   └─ Monitor metrics (24h)
   └─ Document any issues
   └─ Prepare for next iteration
```

---

## 🚨 Troubleshooting

### Error: "FATAL ERROR: FRONTEND_URL is missing"

**Solution:**
1. Railway → Backend → Variables
2. Add: `FRONTEND_URL=https://your-frontend-domain.com` (or your production domain)
3. Save and Redeploy

### Error: "DATABASE_URL invalid"

**Solution:**
1. Verify PostgreSQL service is running (green status)
2. Copy DATABASE_URL from PostgreSQL → Variables
3. Paste exactly in backend variables (including password)
4. Redeploy

### Error: "GCP config unavailable"

**Solution:**
1. Verify `PRIVATE_KEY_GCP` has escaped newlines: `\n`
2. Verify all GCP variables are configured: PROJECT_ID_GCP, PRIVATE_KEY_ID, PRIVATE_KEY_GCP, CLIENT_EMAIL_GCP, CLIENT_ID_GCP
3. Redeploy

### 401 Authentication Loops

**Solution:**
1. Verify `FRONTEND_URL` exactly matches frontend domain
2. Verify NODE_ENV is compatible (staging/prod = HTTPS)
3. Check browser cookies (F12 → Application → Cookies)
4. Verify access_token cookie is present and Secure

### Performance is Slow

**Solution:**
1. Verify NODE_ENV=staging (not development)
2. Verify query logging is OFF (NODE_ENV != development)
3. Check database connection pool not exhausted
4. Check response times p95/p99 percentiles

---

## ✅ Deployment Checklist

### Pre-Staging Deployment
- [ ] Code tested locally
- [ ] `npm run build` succeeds
- [ ] All tests pass
- [ ] Commit pushed to development branch
- [ ] Railway Variables configured
- [ ] Database available

### Pre-Production Deployment
- [ ] Staging validated (24h minimum)
- [ ] Branch merged to main
- [ ] Database backup created and tested
- [ ] Automatic backups configured
- [ ] Monitoring setup ready
- [ ] Alerting configured
- [ ] Team notified

### Post-Deployment (All Environments)
- [ ] Logs verified (no errors)
- [ ] Frontend loads correctly
- [ ] Login/Signup works
- [ ] Token refresh works
- [ ] Response times acceptable
- [ ] Database connected
- [ ] Cookies being saved
- [ ] No 401/403/500 errors

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| View logs | `railway logs` |
| Deploy | `railway deploy` |
| Link to Railway | `railway link` |
| Redeploy | `git push origin <branch>` |
| View variables | Railway Dashboard → Variables |

---

## 📚 Related Documentation

- **[Firebase Environments](../auth/guides/FIREBASE_ENVIRONMENTS.md)** - NODE_ENV configuration details
- **[Quick Reference](./QUICK_REFERENCE.md)** - Copy-paste configurations

---

**Questions?** Check the Quick Reference guide or contact your DevOps team.
