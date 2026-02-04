 #!/bin/bash
set -euo pipefail

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="agave_backup_${BACKUP_DATE}.sql.gz"
BUCKET_NAME="${GCP_BUCKET_NAME:-agave-db-backups}"
MAX_RETRIES=10
RETRY_DELAY=10

echo "🔄 Iniciando backup de BD..."

# ============================================
# PASO 1: Despertar la BD en Railway (Healthcheck)
# ============================================
echo "🌙 Verificando que la BD esté despierta..."

RETRY=0
until psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "❌ Error: BD no respondió después de $((MAX_RETRIES * RETRY_DELAY)) segundos"
    exit 1
  fi
  echo "⏳ Intento $RETRY/$MAX_RETRIES: BD despertando, esperando ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done

echo "✅ BD despierta y operativa"

# ============================================
# PASO 2: Crear dump comprimido
# ============================================
echo "📦 Creando dump de la BD..."

# Usar pg_dump con --no-sync para evitar mismatch de versiones
# Alternativamente, especificar la versión correcta
PG_DUMP="/usr/lib/postgresql/17/bin/pg_dump"

# Si existe pg_dump-17, usarlo
if command -v pg_dump-17 &> /dev/null; then
  PG_DUMP="pg_dump-17"
fi

echo "📌 Usando: $PG_DUMP"
"$PG_DUMP" --no-sync "$DATABASE_URL" | gzip > "$BACKUP_FILE"

echo "✅ Backup creado: $BACKUP_FILE"
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "📦 Tamaño: $SIZE"

# Subir a Google Cloud Storage
echo "📤 Subiendo a GCS..."
gsutil cp "$BACKUP_FILE" "gs://${BUCKET_NAME}/${BACKUP_DATE}/${BACKUP_FILE}"

echo "✅ Backup subido a GCS"
echo "📍 gs://${BUCKET_NAME}/${BACKUP_DATE}/${BACKUP_FILE}"

# Limpiar archivo local
rm "$BACKUP_FILE"