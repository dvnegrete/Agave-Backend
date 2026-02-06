#!/bin/bash
# ============================================================================
# Script: Restaurar BD de Producción en Staging
# ============================================================================
# PROPÓSITO:
#   Restaura el último backup de producción en la BD de staging (Railway)
#
# REQUISITOS:
#   - gsutil instalado y autenticado (gcloud auth login)
#   - Variables de entorno: STAGING_DATABASE_URL, GCP_BUCKET_NAME
#   - PostgreSQL client instalado (psql, pg_dump)
#
# USO:
#   STAGING_DATABASE_URL="postgresql://..." bash scripts/restore-production-to-staging.sh
#
# SEGURIDAD:
#   ✅ Hace backup de staging antes de tocar nada
#   ✅ Limpia completamente la BD destino (evita conflictos)
#   ✅ Verifica integridad al finalizar
# ============================================================================

set -euo pipefail

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

BUCKET_NAME="${GCP_BUCKET_NAME:-agave-db-backups}"
STAGING_DB_URL="${STAGING_DATABASE_URL:-}"
TEMP_DIR="/tmp/agave-db-restore-$$"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

cleanup() {
  log_info "Limpiando archivos temporales..."
  rm -rf "$TEMP_DIR"
}

trap cleanup EXIT

# ============================================================================
# VALIDACIONES PREVIAS
# ============================================================================

echo ""
log_info "=========================================="
log_info "  RESTAURAR PRODUCCIÓN → STAGING"
log_info "=========================================="
echo ""

# Verificar que STAGING_DATABASE_URL esté configurado
if [ -z "$STAGING_DB_URL" ]; then
  log_error "STAGING_DATABASE_URL no está configurado"
  echo ""
  echo "Uso:"
  echo "  STAGING_DATABASE_URL=\"postgresql://user:pass@host:port/db\" bash scripts/restore-production-to-staging.sh"
  exit 1
fi

# Verificar gsutil
if ! command -v gsutil &> /dev/null; then
  log_error "gsutil no está instalado"
  echo ""
  echo "Instala Google Cloud SDK:"
  echo "  https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# Verificar psql
if ! command -v psql &> /dev/null; then
  log_error "psql (PostgreSQL client) no está instalado"
  exit 1
fi

# Verificar pg_dump
if ! command -v pg_dump &> /dev/null; then
  log_error "pg_dump no está instalado"
  exit 1
fi

log_success "Todas las validaciones pasaron"

# ============================================================================
# PASO 1: Descargar último backup de producción
# ============================================================================

echo ""
log_info "PASO 1/5: Descargando último backup de producción..."

mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Listar backups disponibles
log_info "Buscando backups en gs://${BUCKET_NAME}/..."
LATEST_BACKUP=$(gsutil ls -r "gs://${BUCKET_NAME}/" | grep '\.sql\.gz$' | sort | tail -1)

if [ -z "$LATEST_BACKUP" ]; then
  log_error "No se encontraron backups en GCS"
  exit 1
fi

BACKUP_DATE=$(echo "$LATEST_BACKUP" | grep -oP '\d{8}_\d{6}' | head -1)
log_info "Último backup encontrado: ${BACKUP_DATE}"
log_info "Ruta: $LATEST_BACKUP"

# Confirmar con el usuario
echo ""
log_warning "¿Estás seguro de restaurar este backup en STAGING?"
log_warning "Esto ELIMINARÁ TODOS los datos actuales de staging"
echo ""
read -p "Escribe 'CONFIRMAR' para continuar: " CONFIRMATION

if [ "$CONFIRMATION" != "CONFIRMAR" ]; then
  log_error "Operación cancelada por el usuario"
  exit 1
fi

# Descargar
FILENAME=$(basename "$LATEST_BACKUP")
log_info "Descargando: $FILENAME"
gsutil cp "$LATEST_BACKUP" "./$FILENAME"

# Descomprimir
log_info "Descomprimiendo..."
gunzip "$FILENAME"
BACKUP_SQL="${FILENAME%.gz}"

log_success "Backup descargado y descomprimido"

# ============================================================================
# PASO 2: Backup preventivo de staging
# ============================================================================

echo ""
log_info "PASO 2/5: Creando backup preventivo de staging..."

STAGING_BACKUP_FILE="staging_backup_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

log_info "Creando backup de staging: $STAGING_BACKUP_FILE"
pg_dump "$STAGING_DB_URL" | gzip > "$STAGING_BACKUP_FILE"

log_success "Backup de staging creado: $STAGING_BACKUP_FILE"
log_info "Si algo sale mal, puedes restaurar staging con:"
log_info "  gunzip $STAGING_BACKUP_FILE"
log_info "  psql \$STAGING_DATABASE_URL < ${STAGING_BACKUP_FILE%.gz}"

# ============================================================================
# PASO 3: Limpiar BD de staging
# ============================================================================

echo ""
log_info "PASO 3/5: Limpiando BD de staging (DROP SCHEMA)..."

# Desconectar todas las sesiones activas
log_info "Desconectando sesiones activas..."
psql "$STAGING_DB_URL" -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
" 2>/dev/null || log_warning "No se pudieron desconectar sesiones (puede ser normal)"

# Eliminar y recrear el schema public
log_info "Eliminando schema public..."
psql "$STAGING_DB_URL" -c "DROP SCHEMA IF EXISTS public CASCADE;" 2>/dev/null || true

log_info "Recreando schema public..."
psql "$STAGING_DB_URL" -c "CREATE SCHEMA public;"

log_info "Otorgando permisos..."
psql "$STAGING_DB_URL" -c "GRANT ALL ON SCHEMA public TO PUBLIC;"

log_success "BD de staging limpiada completamente"

# ============================================================================
# PASO 4: Restaurar backup de producción
# ============================================================================

echo ""
log_info "PASO 4/5: Restaurando backup de producción en staging..."

# Restaurar
psql "$STAGING_DB_URL" < "$BACKUP_SQL" 2>&1 | tee restore.log

# Verificar errores en el log
if grep -qi "error" restore.log; then
  log_warning "Se detectaron errores durante la restauración (revisar restore.log)"
else
  log_success "Restauración completada sin errores"
fi

# ============================================================================
# PASO 5: Verificar integridad
# ============================================================================

echo ""
log_info "PASO 5/5: Verificando integridad de la BD..."

# Contar registros en tablas principales
log_info "Contando registros..."
psql "$STAGING_DB_URL" -c "
SELECT
  'users' as tabla, COUNT(*) as total FROM users
UNION ALL
SELECT 'houses', COUNT(*) FROM houses
UNION ALL
SELECT 'transactions_bank', COUNT(*) FROM transactions_bank
UNION ALL
SELECT 'records', COUNT(*) FROM records
UNION ALL
SELECT 'periods', COUNT(*) FROM periods
ORDER BY tabla;
"

# Verificar que el usuario sistema existe
log_info "Verificando usuario sistema..."
SYSTEM_USER=$(psql "$STAGING_DB_URL" -t -c "SELECT id FROM users WHERE email = 'sistema@conciliacion.local';" | xargs)

if [ -n "$SYSTEM_USER" ]; then
  log_success "Usuario sistema encontrado: $SYSTEM_USER"
else
  log_warning "Usuario sistema NO encontrado (se creará al iniciar la app)"
fi

# ============================================================================
# RESUMEN FINAL
# ============================================================================

echo ""
log_success "=========================================="
log_success "  RESTAURACIÓN COMPLETADA"
log_success "=========================================="
echo ""
log_info "Backup restaurado: ${BACKUP_DATE}"
log_info "Backup preventivo guardado en: $TEMP_DIR/$STAGING_BACKUP_FILE"
echo ""
log_warning "PRÓXIMOS PASOS:"
echo "  1. Verificar que la app de staging funciona correctamente"
echo "  2. Revisar que los datos son consistentes"
echo "  3. Si todo está OK, puedes eliminar: $TEMP_DIR"
echo ""

# Mantener el directorio temporal para que el usuario revise
trap - EXIT
