#!/bin/bash
set -euo pipefail

echo "🔄 Restaurando BD desde último backup en GCS..."

BUCKET_NAME="${GCP_BUCKET_NAME:-agave-db-backups}"

# Verificar que DATABASE_URL está configurado
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ Error: DATABASE_URL no está configurado"
  exit 1
fi

# Listar backups disponibles
echo "📋 Buscando backups disponibles en gs://${BUCKET_NAME}/..."
LATEST_BACKUP=$(gsutil ls -r "gs://${BUCKET_NAME}/" | grep '\.sql\.gz$' | tail -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "❌ Error: No se encontraron backups en GCS"
  exit 1
fi

echo "✅ Último backup encontrado: $LATEST_BACKUP"

# Descargar backup
FILENAME=$(basename "$LATEST_BACKUP")
echo "📥 Descargando: $FILENAME"
gsutil cp "$LATEST_BACKUP" "./$FILENAME"

# Descomprimir
echo "📦 Descomprimiendo..."
gunzip "$FILENAME"
BACKUP_SQL="${FILENAME%.gz}"

# Restaurar a la BD
echo "🔧 Restaurando base de datos..."
psql "$DATABASE_URL" < "$BACKUP_SQL"

echo "✅ Restauración completada correctamente"

# Verificar
echo "📊 Verificando..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_usuarios FROM users;" 2>/dev/null || echo "⚠️  No se pudo verificar (BD puede estar inicializando)"

# Limpiar
echo "🧹 Limpiando archivos temporales..."
rm "$BACKUP_SQL"

echo "✅ Proceso completado"
