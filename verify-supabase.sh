#!/bin/bash

# ========================================
# SUPABASE CONFIGURATION VERIFICATION SCRIPT
# ========================================
# Uso: bash verify-supabase.sh
# Verifica que todas las variables de Supabase están configuradas correctamente

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contador de errores
ERRORS=0
WARNINGS=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supabase Configuration Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ========================================
# 1. VERIFICAR ARCHIVO .env
# ========================================
echo -e "${BLUE}[1] Verificando archivo .env...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}✗ Archivo .env no encontrado${NC}"
    echo "  Copia env.example a .env:"
    echo "  cp env.example .env"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Archivo .env encontrado${NC}"
fi

echo ""

# ========================================
# 2. VERIFICAR SUPABASE_URL
# ========================================
echo -e "${BLUE}[2] Verificando SUPABASE_URL...${NC}"

if [ -f .env ]; then
    SUPABASE_URL=$(grep "^SUPABASE_URL=" .env | cut -d '=' -f 2 | xargs)

    if [ -z "$SUPABASE_URL" ]; then
        echo -e "${RED}✗ SUPABASE_URL está vacío${NC}"
        ERRORS=$((ERRORS + 1))
    elif [ "$SUPABASE_URL" = "your_supabase_url_here" ] || [ "$SUPABASE_URL" = "https://..." ]; then
        echo -e "${RED}✗ SUPABASE_URL no está configurado (valor por defecto)${NC}"
        ERRORS=$((ERRORS + 1))
    elif [[ $SUPABASE_URL == https://* ]]; then
        echo -e "${GREEN}✓ SUPABASE_URL configurado${NC}"
        echo "  URL: $SUPABASE_URL"
    else
        echo -e "${RED}✗ SUPABASE_URL no parece válido${NC}"
        echo "  Debe empezar con https://"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""

# ========================================
# 3. VERIFICAR SUPABASE_ANON_KEY
# ========================================
echo -e "${BLUE}[3] Verificando SUPABASE_ANON_KEY...${NC}"

if [ -f .env ]; then
    SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" .env | cut -d '=' -f 2 | xargs)

    if [ -z "$SUPABASE_ANON_KEY" ]; then
        echo -e "${RED}✗ SUPABASE_ANON_KEY está vacío${NC}"
        ERRORS=$((ERRORS + 1))
    elif [ "$SUPABASE_ANON_KEY" = "your_supabase_anon_key_here" ] || [ ${#SUPABASE_ANON_KEY} -lt 50 ]; then
        echo -e "${RED}✗ SUPABASE_ANON_KEY no está configurado o es muy corto${NC}"
        echo "  Debe tener 200+ caracteres"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ SUPABASE_ANON_KEY configurado${NC}"
        echo "  Longitud: ${#SUPABASE_ANON_KEY} caracteres"
        echo "  Primeros 20 caracteres: ${SUPABASE_ANON_KEY:0:20}..."
    fi
fi

echo ""

# ========================================
# 4. VERIFICAR SUPABASE_SERVICE_ROLE_KEY
# ========================================
echo -e "${BLUE}[4] Verificando SUPABASE_SERVICE_ROLE_KEY...${NC}"

if [ -f .env ]; then
    SUPABASE_SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env | cut -d '=' -f 2 | xargs)

    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo -e "${RED}✗ SUPABASE_SERVICE_ROLE_KEY está vacío${NC}"
        ERRORS=$((ERRORS + 1))
    elif [ "$SUPABASE_SERVICE_ROLE_KEY" = "your_supabase_service_role_key_here" ] || [ ${#SUPABASE_SERVICE_ROLE_KEY} -lt 50 ]; then
        echo -e "${RED}✗ SUPABASE_SERVICE_ROLE_KEY no está configurado o es muy corto${NC}"
        echo "  Debe tener 200+ caracteres"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ SUPABASE_SERVICE_ROLE_KEY configurado${NC}"
        echo "  Longitud: ${#SUPABASE_SERVICE_ROLE_KEY} caracteres"
        echo "  Primeros 20 caracteres: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
    fi

    # ⚠️ Advertencia de seguridad
    if grep -q "SUPABASE_SERVICE_ROLE_KEY" .gitignore 2>/dev/null; then
        echo -e "${GREEN}✓ .gitignore protege .env${NC}"
    else
        echo -e "${YELLOW}⚠ Verifica que .env está en .gitignore${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""

# ========================================
# 5. VERIFICAR DATABASE_URL (OPCIONAL)
# ========================================
echo -e "${BLUE}[5] Verificando DATABASE_URL (opcional)...${NC}"

if [ -f .env ]; then
    DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f 2 | xargs)

    if [ -z "$DATABASE_URL" ]; then
        echo -e "${YELLOW}ℹ DATABASE_URL está vacío${NC}"
        echo "   (Esto es OK si solo usas Supabase Auth sin su BD)"
    elif [ "$DATABASE_URL" = "your_database_url_here" ]; then
        echo -e "${YELLOW}ℹ DATABASE_URL no está configurado${NC}"
        echo "   (Esto es OK si solo usas Supabase Auth sin su BD)"
    elif [[ $DATABASE_URL == postgresql://* ]]; then
        echo -e "${GREEN}✓ DATABASE_URL configurado${NC}"
        # Ocultamos el password
        HIDDEN_URL=$(echo $DATABASE_URL | sed 's/:.*@/:***@/')
        echo "  URL: $HIDDEN_URL"
    else
        echo -e "${YELLOW}⚠ DATABASE_URL no parece válido${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""

# ========================================
# 6. VERIFICAR node_modules
# ========================================
echo -e "${BLUE}[6] Verificando dependencias...${NC}"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ node_modules encontrado${NC}"
    if [ -d "node_modules/@supabase" ]; then
        echo -e "${GREEN}✓ @supabase/supabase-js instalado${NC}"
    else
        echo -e "${YELLOW}⚠ @supabase/supabase-js no encontrado${NC}"
        echo "  Ejecuta: npm install"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠ node_modules no encontrado${NC}"
    echo "  Ejecuta: npm install"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ========================================
# 7. VERIFICAR ARCHIVO .gitignore
# ========================================
echo -e "${BLUE}[7] Verificando .gitignore...${NC}"

if [ -f ".gitignore" ]; then
    if grep -q "^\.env" .gitignore; then
        echo -e "${GREEN}✓ .env protegido en .gitignore${NC}"
    else
        echo -e "${YELLOW}⚠ .env no está en .gitignore${NC}"
        echo "  Agrega '.env' a .gitignore"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠ .gitignore no encontrado${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ========================================
# RESUMEN
# ========================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RESUMEN${NC}"
echo -e "${BLUE}========================================${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Todas las verificaciones pasaron${NC}"
    echo ""
    echo "Próximos pasos:"
    echo "  1. npm run start:dev"
    echo "  2. Abre http://localhost:3000"
    echo "  3. Prueba la autenticación"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Hay ${WARNINGS} notas${NC}"
    echo ""
    echo "Supabase Auth está configurado correctamente."
    echo ""
    echo "Si usas SOLO Supabase Auth (sin su BD):"
    echo "  ✓ Puedes ignorar las notas sobre DATABASE_URL"
    echo "  → Lee: docs/auth/guides/SUPABASE_AUTH_ONLY.md"
    echo ""
    echo "Si planeas usar Supabase BD también:"
    echo "  → Configura DATABASE_URL según SUPABASE_STEP_BY_STEP.md"
    echo ""
    echo "Próximos pasos:"
    echo "  1. npm run start:dev"
    echo "  2. Prueba: curl -X POST http://localhost:3000/auth/signup"
    exit 0
else
    echo -e "${RED}✗ ${ERRORS} errores encontrados${NC}"
    echo ""
    echo "Debes resolver estos errores antes de continuar:"
    echo "  1. Lee: docs/auth/guides/SUPABASE_STEP_BY_STEP.md"
    echo "  2. O si solo usas Auth: docs/auth/guides/SUPABASE_AUTH_ONLY.md"
    echo "  3. Verifica: docs/auth/guides/ENV_VARIABLES_QUICK_REFERENCE.md"
    echo "  4. Obtén las credenciales de https://app.supabase.com"
    exit 1
fi
