#!/bin/bash

OLD_DB=$1
NEW_DB=$2
TABLE=$3

if [ -z "$OLD_DB" ] || [ -z "$NEW_DB" ] || [ -z "$TABLE" ]; then
  echo "Uso: bash scripts/compare-records.sh <OLD_DB_URL> <NEW_DB_URL> <TABLA>"
  echo ""
  echo "Ejemplo:"
  echo "  bash scripts/compare-records.sh postgresql://... postgresql://... transactions_bank"
  exit 1
fi

echo "🔍 Comparando registros en tabla: $TABLE"
echo ""

# Crear archivos temporales
TMP_OLD=$(mktemp)
TMP_NEW=$(mktemp)

# Descargar IDs de ambas BDs
echo "📥 Descargando IDs de BD antigua..."
psql $OLD_DB -t -c "SELECT id FROM $TABLE ORDER BY id;" > $TMP_OLD 2>/dev/null

echo "📥 Descargando IDs de BD nueva..."
psql $NEW_DB -t -c "SELECT id FROM $TABLE ORDER BY id;" > $TMP_NEW 2>/dev/null

echo ""

# Registros SOLO en BD antigua
echo "🔴 Registros SOLO en BD antigua (no están en nueva):"
ONLY_OLD=$(comm -23 $TMP_OLD $TMP_NEW | wc -l)

if [ $ONLY_OLD -eq 0 ]; then
  echo "   ✅ Ninguno"
else
  echo "   Total: $ONLY_OLD"
  echo "   Primeros 20:"
  comm -23 $TMP_OLD $TMP_NEW | head -20 | sed 's/^/     - /'
fi

echo ""

# Registros SOLO en BD nueva
echo "🟢 Registros SOLO en BD nueva (no están en antigua):"
ONLY_NEW=$(comm -13 $TMP_OLD $TMP_NEW | wc -l)

if [ $ONLY_NEW -eq 0 ]; then
  echo "   ✅ Ninguno"
else
  echo "   Total: $ONLY_NEW"
  echo "   Primeros 20:"
  comm -13 $TMP_OLD $TMP_NEW | head -20 | sed 's/^/     - /'
fi

# Registros comunes
COMMON=$(comm -12 $TMP_OLD $TMP_NEW | wc -l)
echo ""
echo "✅ Registros comunes (en ambas): $COMMON"

# Limpiar
rm $TMP_OLD $TMP_NEW

echo ""
echo "✅ Comparación completada"
