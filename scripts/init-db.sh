#!/usr/bin/env bash
set -euo pipefail

echo "[init-db] Iniciando preparación de base de datos con TypeORM"

PROJECT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$PROJECT_ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "[init-db] ⚠️  No se encontró archivo .env en $PROJECT_ROOT_DIR"
  echo "[init-db] Crea un .env basado en .env.example y define DATABASE_URL."
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

echo "[init-db] Ejecutando migraciones de TypeORM..."
npm run db:deploy

echo "[init-db] ✅ Base de datos sincronizada con TypeORM"
echo "[init-db] Próximo paso: npm run start:dev"

