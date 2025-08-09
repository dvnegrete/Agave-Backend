#!/usr/bin/env bash
set -euo pipefail

echo "[init-db] Iniciando preparación de base de datos con Prisma"

PROJECT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$PROJECT_ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "[init-db] ⚠️  No se encontró archivo .env en $PROJECT_ROOT_DIR"
  echo "[init-db] Crea un .env basado en .env.example y define DATABASE_URL (y DIRECT_URL opcional)."
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  # Intentar cargar .env para shells que no lo cargan automáticamente
  set -a
  # shellcheck disable=SC1091
  source .env || true
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[init-db] ❌ La variable de entorno DATABASE_URL no está definida."
  echo "[init-db] Define DATABASE_URL en tu .env."
  exit 1
fi

echo "[init-db] Ejecutando prisma generate"
npx --yes prisma generate

MIGRATIONS_DIR="prisma/migrations"
if [[ -d "$MIGRATIONS_DIR" ]] && compgen -G "$MIGRATIONS_DIR/*" > /dev/null; then
  echo "[init-db] Se detectaron migraciones. Ejecutando prisma migrate deploy"
  npx --yes prisma migrate deploy
else
  if [[ "${NODE_ENV:-development}" == "production" ]]; then
    echo "[init-db] ❌ No hay migraciones y estás en producción (NODE_ENV=production)."
    echo "[init-db] Genera migraciones con 'npm run db:dev -- --name init' en entorno de desarrollo y súbelas antes de desplegar."
    exit 1
  fi
  echo "[init-db] No hay migraciones. Aplicando esquema con prisma db push (entorno no productivo)."
  npx --yes prisma db push
fi

echo "[init-db] ✅ Tablas y estructura sincronizadas con prisma/schema.prisma"


