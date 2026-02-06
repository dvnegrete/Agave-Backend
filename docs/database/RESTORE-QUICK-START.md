# ⚡ Quick Start: Restaurar Producción en Staging

## 🎯 TL;DR - Ejecución Rápida (5 minutos)

```bash
# 1. Autenticarse en GCP (una vez)
gcloud auth login

# 2. Exportar DATABASE_URL de staging
export STAGING_DATABASE_URL="postgresql://user:pass@host:port/database"

# 3. Ejecutar script automatizado
cd agave-backend
bash scripts/restore-production-to-staging.sh

# 4. Confirmar cuando se solicite
# Escribe: CONFIRMAR
```

**¡Listo!** El script hace todo automáticamente:
- ✅ Descarga el último backup de producción
- ✅ Crea backup preventivo de staging
- ✅ Limpia staging completamente
- ✅ Restaura producción
- ✅ Verifica integridad

---

## 📦 Requisitos Previos (Setup Único)

### Instalar Herramientas

```bash
# Google Cloud SDK (para gsutil)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# PostgreSQL Client (si no tienes)
# Ubuntu/Debian:
sudo apt-get install postgresql-client

# macOS:
brew install postgresql
```

### Autenticación GCP

```bash
# Autenticarse (una vez)
gcloud auth login

# Verificar acceso a backups
gsutil ls gs://agave-db-backups/
```

---

## 🚀 Opciones de Restauración

### Opción 1: Script Automatizado (Recomendado)

**Tiempo:** 5-7 minutos
**Dificultad:** Fácil
**Seguridad:** ✅✅✅ (Backup automático + validaciones)

```bash
cd agave-backend
export STAGING_DATABASE_URL="postgresql://..."
bash scripts/restore-production-to-staging.sh
```

**Ventajas:**
- ✅ Backup automático de staging antes de tocar nada
- ✅ Limpieza completa de la BD (sin conflictos)
- ✅ Validaciones previas
- ✅ Verificación de integridad post-restauración

**Desventajas:**
- Requiere instalar gsutil y gcloud

---

### Opción 2: Manual con psql (Rápido)

**Tiempo:** 3-4 minutos
**Dificultad:** Media
**Seguridad:** ⚠️ (Sin backup automático)

```bash
# 1. Descargar último backup
gsutil ls -r gs://agave-db-backups/ | grep '\.sql\.gz$' | tail -1
# Copia la ruta del último backup

# 2. Descargar y descomprimir
gsutil cp gs://agave-db-backups/YYYYMMDD_HHMMSS/agave_backup_YYYYMMDD_HHMMSS.sql.gz ./
gunzip agave_backup_*.sql.gz

# 3. Limpiar staging
psql "$STAGING_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 4. Restaurar
psql "$STAGING_DATABASE_URL" < agave_backup_*.sql
```

**Ventajas:**
- ⚡ Muy rápido (menos pasos)
- 📦 No requiere scripts adicionales

**Desventajas:**
- ⚠️ No crea backup preventivo (hazlo manualmente antes)
- ⚠️ Sin validaciones automáticas

---

### Opción 3: Railway CLI (Experimental)

**Tiempo:** 10-15 minutos
**Dificultad:** Alta
**Seguridad:** ⚠️⚠️ (Requiere configuración manual)

```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Autenticar
railway login

# 3. Vincular proyecto
railway link

# 4. Seleccionar staging
railway environment staging

# 5. Obtener DATABASE_URL
railway variables

# 6. Usar Opción 1 o 2 con esa URL
```

**Ventajas:**
- 🔑 Obtiene DATABASE_URL automáticamente

**Desventajas:**
- 🐌 Más lento (setup inicial)
- 📚 Requiere familiaridad con Railway CLI

---

## 🎯 Recomendación por Caso de Uso

| Caso de Uso | Opción Recomendada | Motivo |
|-------------|-------------------|--------|
| **Primera vez** | Opción 1 (Script) | Más seguro, con backup automático |
| **Urgente (producción caída)** | Opción 2 (Manual) | Más rápido, menos pasos |
| **Testing recurrente** | Opción 1 (Script) | Automatización + seguridad |
| **Sin acceso a GCP** | Opción 3 (Railway) | Alternativa sin GCS |

---

## 📊 Comparación de Opciones

| Característica | Script Auto | Manual | Railway CLI |
|---------------|-------------|--------|-------------|
| **Tiempo** | 5-7 min | 3-4 min | 10-15 min |
| **Backup preventivo** | ✅ Sí | ❌ No | ❌ No |
| **Validaciones** | ✅ Sí | ❌ No | ⚠️ Parcial |
| **Verificación integridad** | ✅ Sí | ❌ No | ❌ No |
| **Logs detallados** | ✅ Sí | ⚠️ Básico | ⚠️ Básico |
| **Recuperación fácil** | ✅ Sí | ❌ No | ❌ No |

---

## ⚠️ Antes de Ejecutar

### Checklist Pre-Restauración

- [ ] Tienes acceso a GCP con permisos en `gs://agave-db-backups/`
- [ ] Tienes la `STAGING_DATABASE_URL` de Railway
- [ ] Has notificado al equipo (staging no disponible ~10 min)
- [ ] Sabes qué backup quieres restaurar (último por defecto)
- [ ] Tienes tiempo para validar post-restauración

### Obtener STAGING_DATABASE_URL

**Opción A: Railway Dashboard**
```
1. https://railway.app/
2. Proyecto: agave-backend
3. Environment: staging
4. Variables → DATABASE_URL → Copy
```

**Opción B: Railway CLI**
```bash
railway environment staging
railway variables | grep DATABASE_URL
```

---

## ✅ Validación Post-Restauración

### 1. Verificar Backend

```bash
# Railway logs
railway environment staging
railway logs

# Buscar:
# ✅ "Database connection established"
# ✅ "Application successfully started"
```

### 2. Verificar Datos

```bash
psql "$STAGING_DATABASE_URL" -c "
SELECT 'users' as tabla, COUNT(*) FROM users
UNION ALL
SELECT 'houses', COUNT(*) FROM houses
UNION ALL
SELECT 'transactions_bank', COUNT(*) FROM transactions_bank;
"
```

### 3. Verificar Frontend

```
https://staging.agave.app (o tu URL)

- Login funciona ✅
- Dashboard carga ✅
- Transacciones visibles ✅
```

---

## 🆘 Troubleshooting Rápido

### "gsutil: command not found"
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud auth login
```

### "AccessDeniedException: 403"
```bash
gcloud auth login
gsutil iam get gs://agave-db-backups/
```

### "relation already exists"
```bash
# Limpiar manualmente antes de restaurar
psql "$STAGING_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### "Database connection failed"
```bash
# Verificar DATABASE_URL
echo $STAGING_DATABASE_URL

# Railway puede estar en sleep mode (despierta con:)
psql "$STAGING_DATABASE_URL" -c "SELECT 1"
```

---

## 📚 Más Información

- **Guía Detallada:** [restore-production-to-staging.md](./restore-production-to-staging.md)
- **Script de Backup:** `.github/scripts/backup-db.sh`
- **Workflow GitHub Actions:** `.github/workflows/backup-db.yml`
- **Setup Guide:** [setup-guide.md](./setup-guide.md)

---

**Última actualización:** 2026-02-06
**Mantenedor:** DevOps Team
