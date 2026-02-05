 #!/bin/bash
set -euo pipefail

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="agave_backup_${BACKUP_DATE}.sql.gz"
BUCKET_NAME="${GCP_BUCKET_NAME:-agave-db-backups}"
MAX_RETRIES=10
RETRY_DELAY=10

# ============================================
# PASO 1: Despertar la BD en Railway (Healthcheck)
# ============================================
RETRY=0
until psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: Database unreachable after $((MAX_RETRIES * RETRY_DELAY))s"
    exit 1
  fi
  sleep $RETRY_DELAY
done

# ============================================
# PASO 2: Crear dump comprimido
# ============================================

PG_DUMP="/usr/lib/postgresql/17/bin/pg_dump"
if command -v pg_dump-17 &> /dev/null; then
  PG_DUMP="pg_dump-17"
fi

"$PG_DUMP" --no-sync "$DATABASE_URL" | gzip > "$BACKUP_FILE"
gsutil cp "$BACKUP_FILE" "gs://${BUCKET_NAME}/${BACKUP_DATE}/${BACKUP_FILE}"
echo "Backup completed in GCP: gs://${BUCKET_NAME}/${BACKUP_DATE}/${BACKUP_FILE}"

rm "$BACKUP_FILE"

# ============================================
# PASO 3: Limpiar respaldos antiguos (mantener solo 15)
# ============================================

BACKUPS=$(gsutil ls "gs://${BUCKET_NAME}/" 2>/dev/null | grep -oP '\d{8}_\d{6}(?=/$)' | sort || true)
BACKUP_COUNT=$(echo "$BACKUPS" | grep -c . || true)

if [ "$BACKUP_COUNT" -gt 15 ]; then
  TO_DELETE=$((BACKUP_COUNT - 15))
  BACKUPS_TO_DELETE=$(echo "$BACKUPS" | head -n $TO_DELETE)

  while IFS= read -r BACKUP_DIR; do
    if [ -n "$BACKUP_DIR" ]; then
      gsutil -m rm -r "gs://${BUCKET_NAME}/${BACKUP_DIR}/" 2>/dev/null || true
    fi
  done <<< "$BACKUPS_TO_DELETE"

  echo "Cleanup: deleted $TO_DELETE old backups (total: $((BACKUP_COUNT - TO_DELETE)))"
fi