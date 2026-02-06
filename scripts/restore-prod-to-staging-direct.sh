#!/bin/bash
# ============================================================================
# Script: Restaurar Producción → Staging (Directo)
# ============================================================================
# PROPÓSITO:
#   Copia directamente la BD de producción a staging usando las DATABASE_URLs
#
# REQUISITOS:
#   - psql y pg_dump instalados
#   - DATABASE_URLs de producción y staging
#
# USO:
#   PROD_DATABASE_URL="postgresql://..." \
#   STAGING_DATABASE_URL="postgresql://..." \
#   bash scripts/restore-prod-to-staging-direct.sh
# ============================================================================

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# ============================================================================
# VALIDACIONES
# ============================================================================

echo ""
log_info "=========================================="
log_info "  COPIA DIRECTA: PRODUCCIÓN → STAGING"
log_info "=========================================="
echo ""

if [ -z "${PROD_DATABASE_URL:-}" ]; then
  log_error "PROD_DATABASE_URL no está configurado"
  echo ""
  echo "Uso:"
  echo "  PROD_DATABASE_URL=\"postgresql://...\" \\"
  echo "  STAGING_DATABASE_URL=\"postgresql://...\" \\"
  echo "  bash scripts/restore-prod-to-staging-direct.sh"
  exit 1
fi

if [ -z "${STAGING_DATABASE_URL:-}" ]; then
  log_error "STAGING_DATABASE_URL no está configurado"
  exit 1
fi

# Verificar herramientas
if ! command -v psql &> /dev/null || ! command -v pg_dump &> /dev/null; then
  log_error "psql y/o pg_dump no están instalados"
  exit 1
fi

log_success "Validaciones OK"

# Extraer nombres de BD para mostrar
PROD_DB=$(echo "$PROD_DATABASE_URL" | grep -oP '(?<=/)[^?]+$' || echo "producción")
STAGING_DB=$(echo "$STAGING_DATABASE_URL" | grep -oP '(?<=/)[^?]+$' || echo "staging")

echo ""
log_info "BD Origen:  $PROD_DB"
log_info "BD Destino: $STAGING_DB"
echo ""

# ============================================================================
# CONFIRMACIÓN
# ============================================================================

log_warning "⚠️  ESTO ELIMINARÁ TODOS LOS DATOS DE STAGING ⚠️"
echo ""
read -p "Escribe 'CONFIRMAR' para continuar: " CONFIRMATION

if [ "$CONFIRMATION" != "CONFIRMAR" ]; then
  log_error "Operación cancelada"
  exit 1
fi

# ============================================================================
# PASO 1: Backup Preventivo de Staging (Opcional pero Recomendado)
# ============================================================================

echo ""
log_info "PASO 1/4: Creando backup preventivo de staging..."

BACKUP_FILE="staging_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
log_info "Creando: $BACKUP_FILE"

pg_dump "$STAGING_DATABASE_URL" 2>/dev/null | gzip > "$BACKUP_FILE" &
BACKUP_PID=$!

# Mostrar progreso
while kill -0 $BACKUP_PID 2>/dev/null; do
  echo -n "."
  sleep 1
done
wait $BACKUP_PID

log_success "Backup preventivo creado: $BACKUP_FILE"

# ============================================================================
# PASO 2: Limpiar Staging
# ============================================================================

echo ""
log_info "PASO 2/4: Limpiando staging..."

# Terminar conexiones activas
log_info "Terminando conexiones activas..."
psql "$STAGING_DATABASE_URL" -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database() AND pid <> pg_backend_pid();
" 2>/dev/null || log_warning "No se pudieron terminar algunas conexiones"

# Limpiar schema
log_info "Eliminando schema..."
psql "$STAGING_DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE;" 2>/dev/null
psql "$STAGING_DATABASE_URL" -c "CREATE SCHEMA public;"
psql "$STAGING_DATABASE_URL" -c "GRANT ALL ON SCHEMA public TO PUBLIC;"

log_success "Staging limpiado"

# ============================================================================
# PASO 3: Copiar Producción → Staging
# ============================================================================

echo ""
log_info "PASO 3/4: Copiando producción → staging..."
log_info "Esto puede tardar 2-5 minutos dependiendo del tamaño..."

# Dump y restore en un solo pipe (más rápido)
pg_dump "$PROD_DATABASE_URL" 2>/dev/null | psql "$STAGING_DATABASE_URL" 2>&1 | \
  grep -v "NOTICE:" | grep -v "^$" || true

log_success "Datos copiados"

# ============================================================================
# PASO 4: Verificación
# ============================================================================

echo ""
log_info "PASO 4/4: Verificando integridad..."

# Contar registros
log_info "Contando registros..."
psql "$STAGING_DATABASE_URL" -c "
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
" 2>/dev/null

# Verificar usuario sistema
log_info "Verificando usuario sistema..."
SYSTEM_USER=$(psql "$STAGING_DATABASE_URL" -t -c "
  SELECT id FROM users WHERE email = 'sistema@conciliacion.local';
" 2>/dev/null | xargs || echo "")

if [ -n "$SYSTEM_USER" ]; then
  log_success "Usuario sistema: $SYSTEM_USER"
else
  log_warning "Usuario sistema no encontrado (se creará al iniciar app)"
fi

# ============================================================================
# RESUMEN
# ============================================================================

echo ""
log_success "=========================================="
log_success "  ✅ RESTAURACIÓN COMPLETADA"
log_success "=========================================="
echo ""
log_info "Backup preventivo guardado en: $BACKUP_FILE"
echo ""
log_warning "PRÓXIMOS PASOS:"
echo "  1. Verificar que staging funciona correctamente"
echo "  2. Si todo OK, puedes eliminar: $BACKUP_FILE"
echo ""
log_info "Para recuperar staging desde el backup:"
echo "  gunzip $BACKUP_FILE"
echo "  psql \"\$STAGING_DATABASE_URL\" < ${BACKUP_FILE%.gz}"
echo ""
