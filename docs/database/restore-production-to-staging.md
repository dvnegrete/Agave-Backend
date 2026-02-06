# 🔄 Guía: Restaurar Producción en Staging

## Resumen

Esta guía explica cómo restaurar el último backup de la base de datos de **producción** en el ambiente de **staging** (Railway), de forma segura y con backup preventivo.

**Última actualización:** 2026-02-06

---

## 🎯 Objetivo

Sincronizar la BD de staging con los datos de producción para:
- Testing con datos reales en ambiente controlado
- Debugging de issues reportados en producción
- Validación de migraciones antes de aplicar en producción

---

## ⚠️ Advertencias Importantes

1. **Esta operación ELIMINA TODOS los datos de staging**
2. **Requiere downtime del ambiente de staging** (~5-10 minutos)
3. **NO ejecutar en producción** (script solo funciona con `STAGING_DATABASE_URL`)
4. **Verifica permisos de GCS** antes de ejecutar

---

## 📋 Requisitos Previos

### 1. Herramientas Instaladas

```bash
# Google Cloud SDK (gsutil)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# PostgreSQL Client
sudo apt-get install postgresql-client  # Ubuntu/Debian
brew install postgresql                  # macOS

# Verificar instalación
gsutil --version
psql --version
pg_dump --version
```

### 2. Autenticación en GCP

```bash
# Autenticarse con tu cuenta de GCP
gcloud auth login

# Verificar acceso al bucket de backups
gsutil ls gs://agave-db-backups/

# Deberías ver carpetas con formato: YYYYMMDD_HHMMSS/
```

### 3. Variables de Entorno

Necesitas la **DATABASE_URL de staging** de Railway:

```bash
# Opción 1: Via Railway CLI
railway login
railway environment staging
railway variables

# Opción 2: Via Railway Dashboard
# 1. Ir a https://railway.app/
# 2. Proyecto: agave-backend
# 3. Environment: staging
# 4. Variables → DATABASE_URL
```

---

## 🚀 Procedimiento de Restauración

### Paso 1: Preparar el Entorno

```bash
# Navegar al directorio del backend
cd /ruta/a/agave-backend

# Exportar la DATABASE_URL de staging
export STAGING_DATABASE_URL="postgresql://postgres:XXX@containers-us-west-123.railway.app:5432/railway"

# IMPORTANTE: Verifica que es la URL de STAGING, NO de producción
echo $STAGING_DATABASE_URL | grep -q "staging" || echo "⚠️ ADVERTENCIA: Verifica que sea staging"
```

### Paso 2: Ejecutar el Script de Restauración

```bash
# Ejecutar script
bash scripts/restore-production-to-staging.sh
```

**El script ejecutará automáticamente:**

1. ✅ **Validaciones previas** (gsutil, psql, DATABASE_URL)
2. 📥 **Descarga el último backup** de producción desde GCS
3. 💾 **Crea backup preventivo** de staging (por si algo sale mal)
4. 🧹 **Limpia completamente staging** (`DROP SCHEMA public CASCADE`)
5. 🔧 **Restaura el backup** de producción
6. ✔️ **Verifica integridad** (conteo de tablas, usuario sistema)

### Paso 3: Confirmar la Operación

Durante la ejecución, el script pedirá confirmación:

```
⚠️ ¿Estás seguro de restaurar este backup en STAGING?
⚠️ Esto ELIMINARÁ TODOS los datos actuales de staging

Escribe 'CONFIRMAR' para continuar:
```

**Escribe:** `CONFIRMAR` (en mayúsculas)

### Paso 4: Verificar el Resultado

Al finalizar, el script mostrará:

```
✅ ==========================================
✅   RESTAURACIÓN COMPLETADA
✅ ==========================================

ℹ️ Backup restaurado: 20260206_020030
ℹ️ Backup preventivo guardado en: /tmp/agave-db-restore-12345/staging_backup_before_restore_20260206_123045.sql.gz

⚠️ PRÓXIMOS PASOS:
  1. Verificar que la app de staging funciona correctamente
  2. Revisar que los datos son consistentes
  3. Si todo está OK, puedes eliminar: /tmp/agave-db-restore-12345
```

---

## 🧪 Validación Post-Restauración

### 1. Verificar Backend de Staging

```bash
# Si tienes Railway CLI
railway environment staging
railway logs

# Buscar en los logs:
# ✅ "Database connection established"
# ✅ "Application successfully started"
```

### 2. Verificar Frontend de Staging

```bash
# Abrir staging frontend
open https://staging.agave.app  # o tu URL de staging

# Verificar:
# - Login funciona
# - Dashboard carga correctamente
# - Transacciones visibles
# - Casas visibles
```

### 3. Queries de Verificación

```bash
# Conectar a staging
psql "$STAGING_DATABASE_URL"

# Verificar datos
SELECT 'users' as tabla, COUNT(*) as total FROM users
UNION ALL
SELECT 'houses', COUNT(*) FROM houses
UNION ALL
SELECT 'transactions_bank', COUNT(*) FROM transactions_bank
UNION ALL
SELECT 'records', COUNT(*) FROM records
ORDER BY tabla;

# Verificar usuario sistema
SELECT id, email, role FROM users WHERE email = 'sistema@conciliacion.local';

# Verificar últimas transacciones
SELECT id, date, amount, bank_name FROM transactions_bank ORDER BY created_at DESC LIMIT 10;

# Salir
\q
```

---

## 🛡️ Recuperación de Emergencia

Si algo sale mal durante la restauración, puedes recuperar staging con el backup preventivo:

### Opción 1: Desde el Backup Preventivo Local

```bash
# El script guarda el backup en /tmp/agave-db-restore-XXXXX/
cd /tmp/agave-db-restore-*

# Restaurar staging desde el backup preventivo
gunzip staging_backup_before_restore_*.sql.gz
psql "$STAGING_DATABASE_URL" < staging_backup_before_restore_*.sql

echo "✅ Staging recuperado desde backup preventivo"
```

### Opción 2: Desde un Backup Antiguo en GCS

```bash
# Listar backups disponibles
gsutil ls -lh gs://agave-db-backups/ | sort

# Elegir uno anterior (por ejemplo, de hace 2 días)
BACKUP_DATE="20260204_020030"

# Descargar y restaurar
gsutil cp "gs://agave-db-backups/$BACKUP_DATE/agave_backup_$BACKUP_DATE.sql.gz" ./
gunzip agave_backup_$BACKUP_DATE.sql.gz

# Limpiar staging
psql "$STAGING_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restaurar
psql "$STAGING_DATABASE_URL" < agave_backup_$BACKUP_DATE.sql

echo "✅ Staging restaurado desde backup de GCS"
```

---

## 📊 Troubleshooting

### Error: "gsutil: command not found"

**Solución:**

```bash
# Instalar Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### Error: "AccessDeniedException: 403"

**Causa:** Tu cuenta de GCP no tiene permisos para leer el bucket.

**Solución:**

```bash
# Verificar cuenta activa
gcloud auth list

# Re-autenticarse
gcloud auth login

# Verificar permisos del bucket
gsutil iam get gs://agave-db-backups/
```

### Error: "STAGING_DATABASE_URL no está configurado"

**Solución:**

```bash
# Exportar la variable correctamente
export STAGING_DATABASE_URL="postgresql://user:pass@host:port/database"

# Verificar
echo $STAGING_DATABASE_URL
```

### Error: "relation 'XXX' already exists"

**Causa:** La BD no se limpió correctamente antes de restaurar.

**Solución:**

```bash
# Limpiar manualmente la BD
psql "$STAGING_DATABASE_URL" -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
"

psql "$STAGING_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;"

# Volver a ejecutar el script
bash scripts/restore-production-to-staging.sh
```

### Warning: "Usuario sistema NO encontrado"

**Causa:** El backup no incluía el usuario sistema.

**Solución:**

```bash
# El usuario sistema se crea automáticamente al iniciar la app
railway environment staging
railway restart

# O manualmente:
psql "$STAGING_DATABASE_URL" -f src/shared/database/scripts/ensure-system-user.sql
```

---

## 🔐 Mejores Prácticas

### 1. Frecuencia Recomendada

- **Desarrollo activo:** 1 vez por semana
- **Testing pre-release:** Antes de cada release mayor
- **Debugging crítico:** Cuando sea necesario reproducir issues de producción

### 2. Comunicación al Equipo

Antes de ejecutar la restauración, notifica al equipo:

```markdown
🔄 Restauración de Staging programada

**Fecha/Hora:** 2026-02-06 10:00 AM (horario local)
**Duración:** ~10 minutos
**Impacto:** Staging no disponible durante el proceso
**Datos:** Se restaurará el backup de producción del 2026-02-06 02:00 AM
```

### 3. Post-Restauración

Después de restaurar, considera:

- **Enmascarar datos sensibles** si el equipo de desarrollo tiene acceso
- **Resetear contraseñas** de usuarios de prueba
- **Verificar integraciones** externas (APIs, webhooks)

---

## 📚 Referencias

- **Script de Restauración:** `scripts/restore-production-to-staging.sh`
- **Script de Backup:** `.github/scripts/backup-db.sh`
- **Workflow de Backup:** `.github/workflows/backup-db.yml`
- **Setup Guide:** `docs/database/setup-guide.md`
- **Schema Documentation:** `docs/database/schema.md`

---

## 🆘 Soporte

Si encuentras problemas:

1. Revisar logs del script: `/tmp/agave-db-restore-*/restore.log`
2. Verificar Railway logs: `railway logs`
3. Consultar esta guía de troubleshooting
4. Contactar al equipo de DevOps

---

**Última actualización:** 2026-02-06
**Autor:** DevOps Team
**Versión:** 1.0.0
