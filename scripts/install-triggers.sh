#!/bin/bash

# Script para instalar triggers de detección de duplicados
# Uso: ./scripts/install-triggers.sh

echo "🔧 Instalando función y trigger de detección de duplicados..."

# Verificar que DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL no está configurado"
    echo "Configura la variable de entorno DATABASE_URL y vuelve a intentar"
    exit 1
fi

# Instalar la función y trigger
echo "📥 Ejecutando script de instalación..."
psql "$DATABASE_URL" -f src/shared/database/functions/duplicate_detection.sql

# Verificar la instalación
echo "✅ Verificando instalación..."
psql "$DATABASE_URL" -c "
SELECT
    'Función: ' || proname as componente,
    'Creada' as estado
FROM pg_proc
WHERE proname = 'check_transaction_duplicate'
UNION ALL
SELECT
    'Trigger: ' || tgname as componente,
    'Creado' as estado
FROM pg_trigger
WHERE tgname = 'trigger_check_transaction_duplicate';
"

echo "🎉 Instalación completada"
echo ""
echo "Para probar el trigger, ejecuta:"
echo "npm run db:test-triggers"