#!/bin/bash

OLD_DB=$1
NEW_DB=$2

if [ -z "$OLD_DB" ] || [ -z "$NEW_DB" ]; then
  echo "Uso: bash scripts/compare-databases.sh postgresql://user:pass@host:port/db postgresql://user:pass@host:port/db"
  exit 1
fi

echo "🔍 Comparando BDs..."
echo ""

# Tabla simple
echo "┌────────────────────────────────┬────────┬────────┬──────────┐"
echo "│ Tabla                          │ Antigua│ Nueva  │ Diferencia│"
echo "├────────────────────────────────┼────────┼────────┼──────────┤"

TOTAL_OLD=0
TOTAL_NEW=0

# Obtener tablas
TABLES=$(psql $OLD_DB -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")

for table in $TABLES; do
  OLD_COUNT=$(psql $OLD_DB -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
  NEW_COUNT=$(psql $NEW_DB -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
  DIFF=$((OLD_COUNT - NEW_COUNT))

  TOTAL_OLD=$((TOTAL_OLD + OLD_COUNT))
  TOTAL_NEW=$((TOTAL_NEW + NEW_COUNT))

  printf "│ %-30s │ %6d │ %6d │ %8d │\n" "$table" "$OLD_COUNT" "$NEW_COUNT" "$DIFF"
done

echo "├────────────────────────────────┼────────┼────────┼──────────┤"
printf "│ %-30s │ %6d │ %6d │ %8d │\n" "TOTAL" "$TOTAL_OLD" "$TOTAL_NEW" "$((TOTAL_OLD - TOTAL_NEW))"
echo "└────────────────────────────────┴────────┴────────┴──────────┘"

echo ""
echo "✅ Comparación completada"
