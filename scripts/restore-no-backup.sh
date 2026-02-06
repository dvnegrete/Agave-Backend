#!/bin/bash
# Restauración SIN backup preventivo (más rápido)

set -euo pipefail

if [ -z "${PROD_DATABASE_URL:-}" ] || [ -z "${STAGING_DATABASE_URL:-}" ]; then
  echo "❌ Configura las variables primero:"
  echo "   PROD_DATABASE_URL=\"postgresql://...\" \\"
  echo "   STAGING_DATABASE_URL=\"postgresql://...\" \\"
  echo "   bash scripts/restore-no-backup.sh"
  exit 1
fi

echo "⚠️  SIN BACKUP PREVENTIVO - Todos los datos de staging serán eliminados"
read -p "Escribe 'SI' para continuar: " CONFIRM
[ "$CONFIRM" != "SI" ] && exit 1

echo ""
echo "🧹 Limpiando staging..."
psql "$STAGING_DATABASE_URL" -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true

psql "$STAGING_DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE;" > /dev/null 2>&1
psql "$STAGING_DATABASE_URL" -c "CREATE SCHEMA public;" > /dev/null 2>&1

echo "🔄 Copiando producción → staging (esto puede tardar 2-5 min)..."
pg_dump "$PROD_DATABASE_URL" 2>&1 | psql "$STAGING_DATABASE_URL" > /dev/null 2>&1

echo ""
echo "✅ Completado. Verificando..."
psql "$STAGING_DATABASE_URL" -c "
  SELECT 'users' as tabla, COUNT(*) as total FROM users
  UNION ALL SELECT 'houses', COUNT(*) FROM houses
  UNION ALL SELECT 'transactions_bank', COUNT(*) FROM transactions_bank
  UNION ALL SELECT 'records', COUNT(*) FROM records;
"

echo ""
echo "✅ Restauración exitosa"
