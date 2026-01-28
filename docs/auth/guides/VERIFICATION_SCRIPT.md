# Script de Verificación de Supabase

## 🎯 Propósito

Verificar automáticamente que todas las variables de entorno de Supabase están configuradas correctamente.

---

## 📍 Ubicación del Script

```
agave-backend/verify-supabase.sh
```

---

## ▶️ Cómo Usar

### Opción 1: Ejecución Directa

```bash
# Desde agave-backend/
bash verify-supabase.sh
```

### Opción 2: Hacerlo Ejecutable

```bash
# Hacer el script ejecutable
chmod +x verify-supabase.sh

# Luego ejecutar
./verify-supabase.sh
```

### Opción 3: Desde Cualquier Carpeta

```bash
# Ejecutar desde otra carpeta
bash /ruta/a/agave-backend/verify-supabase.sh
```

---

## 📊 Qué Verifica

El script comprueba automáticamente:

| # | Verificación | Detalle |
|---|--------------|---------|
| 1 | Archivo .env | Existe en la raíz del proyecto |
| 2 | SUPABASE_URL | Configurado y válido (https://*) |
| 3 | SUPABASE_ANON_KEY | Configurado y tiene longitud correcta |
| 4 | SUPABASE_SERVICE_ROLE_KEY | Configurado y tiene longitud correcta |
| 5 | DATABASE_URL | Configurado (opcional) |
| 6 | Dependencias | @supabase/supabase-js instalado |
| 7 | .gitignore | .env está protegido |

---

## ✅ Ejemplos de Output

### Caso 1: Todo Correcto ✓

```
========================================
Supabase Configuration Verification
========================================

[1] Verificando archivo .env...
✓ Archivo .env encontrado

[2] Verificando SUPABASE_URL...
✓ SUPABASE_URL configurado
  URL: https://abc123xyz456.supabase.co

[3] Verificando SUPABASE_ANON_KEY...
✓ SUPABASE_ANON_KEY configurado
  Longitud: 232 caracteres
  Primeros 20 caracteres: eyJ0eXAiOiJKV1QiLC...

[4] Verificando SUPABASE_SERVICE_ROLE_KEY...
✓ SUPABASE_SERVICE_ROLE_KEY configurado
  Longitud: 240 caracteres
  Primeros 20 caracteres: eyJ0eXAiOiJKV1QiLC...
✓ .gitignore protege .env

[5] Verificando DATABASE_URL...
✓ DATABASE_URL configurado
  URL: postgresql://***@db.abc123xyz456.supabase.co:5432/postgres

[6] Verificando dependencias...
✓ node_modules encontrado
✓ @supabase/supabase-js instalado

[7] Verificando .gitignore...
✓ .env protegido en .gitignore

========================================
RESUMEN
========================================
✓ Todas las verificaciones pasaron

Próximos pasos:
  1. npm run start:dev
  2. Abre http://localhost:3000
  3. Prueba la autenticación
```

---

### Caso 2: Error - Variable Faltante ✗

```
[2] Verificando SUPABASE_URL...
✗ SUPABASE_URL está vacío
  Lee: docs/auth/guides/SUPABASE_STEP_BY_STEP.md

[3] Verificando SUPABASE_ANON_KEY...
✗ SUPABASE_ANON_KEY no está configurado o es muy corto
  Debe tener 200+ caracteres

========================================
RESUMEN
========================================
✗ 2 errores encontrados

Debes resolver estos errores antes de continuar:
  1. Lee: docs/auth/guides/SUPABASE_STEP_BY_STEP.md
  2. Verifica: docs/auth/guides/ENV_VARIABLES_QUICK_REFERENCE.md
  3. Obtén las credenciales de https://app.supabase.com
```

---

### Caso 3: Advertencia - Config Parcial ⚠️

```
[5] Verificando DATABASE_URL...
⚠ DATABASE_URL está vacío (opcional)

[6] Verificando dependencias...
⚠ @supabase/supabase-js no encontrado
  Ejecuta: npm install

========================================
RESUMEN
========================================
⚠ Hay 2 advertencias

El sistema podría funcionar, pero revisa los avisos
```

---

## 🔍 Interpretación de Resultados

### ✓ Verde - Correcto

Significa que esa verificación pasó correctamente. Puedes continuar.

### ⚠️ Amarillo - Advertencia

Significa que hay algo que debería revisar, pero el sistema podría funcionar.

**Acciones:**
1. Lee el mensaje
2. Sigue la recomendación
3. Ejecuta el script nuevamente

### ✗ Rojo - Error

Significa que hay algo que DEBE ser arreglado antes de continuar.

**Acciones:**
1. Lee el mensaje de error
2. Consulta las guías recomendadas
3. Soluciona el problema
4. Ejecuta el script nuevamente

---

## 🔧 Flujo Recomendado

```
1. Configura variables en Supabase Dashboard
   ↓
2. Actualiza archivo .env con las credenciales
   ↓
3. Ejecuta: bash verify-supabase.sh
   ↓
4. Revisa los resultados
   ├─ Si TODO OK → npm run start:dev
   ├─ Si Advertencias → Lee y soluciona
   └─ Si Errores → Sigue las guías de configuración
   ↓
5. Si todo está bien, ¡tu backend está listo!
```

---

## 📋 Script Details

### Lo Que Verifica en Detalle

#### 1. Archivo .env
```bash
# Verifica que existe
[ -f .env ]
```

#### 2. SUPABASE_URL
```bash
# Verifica:
# - No está vacío
# - No es el valor por defecto
# - Comienza con https://
```

#### 3. SUPABASE_ANON_KEY
```bash
# Verifica:
# - No está vacío
# - Tiene 200+ caracteres (JWT)
# - No es el valor por defecto
```

#### 4. SUPABASE_SERVICE_ROLE_KEY
```bash
# Verifica:
# - No está vacío
# - Tiene 200+ caracteres (JWT)
# - No es el valor por defecto
# - Verifica que .env está en .gitignore (seguridad)
```

#### 5. DATABASE_URL
```bash
# Verifica:
# - No es obligatorio
# - Si existe, comienza con postgresql://
# - Contiene credenciales válidas
```

#### 6. Dependencias
```bash
# Verifica:
# - node_modules existe
# - @supabase/supabase-js está instalado
```

#### 7. .gitignore
```bash
# Verifica:
# - .gitignore existe
# - Contiene "\.env"
```

---

## 🔒 Privacidad del Script

### Lo Que NO Hace

- ❌ No entra a GitHub
- ❌ No entra a Supabase
- ❌ No comparte credenciales
- ❌ No almacena información

### Lo Que SÍ Hace

- ✅ Lee solo el archivo .env local
- ✅ Valida formato y longitud
- ✅ Ocultamuestra las contraseñas en el output
- ✅ Proporciona recomendaciones locales

---

## 🚀 Siguientes Pasos

Si todo está verde:

```bash
# 1. Instalar dependencias (si no lo hiciste)
npm install

# 2. Iniciar el backend
npm run start:dev

# 3. Verifica los logs
# Debe aparecer: ✓ Supabase initialized successfully

# 4. Prueba un endpoint
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

---

## 📞 Si el Script Falla

### Paso 1: Lee el error cuidadosamente
El script dice exactamente qué está mal.

### Paso 2: Consulta las guías
- Para obtener variables: **SUPABASE_STEP_BY_STEP.md**
- Para referencia rápida: **ENV_VARIABLES_QUICK_REFERENCE.md**
- Para troubleshooting: **SUPABASE_SETUP.md**

### Paso 3: Soluciona y vuelve a ejecutar
```bash
bash verify-supabase.sh
```

### Paso 4: Si persiste el problema
Verifica manualmente que las credenciales en Supabase son correctas.

---

## 💡 Tips

1. **Ejecuta regularmente**: Después de cambiar variables, vuelve a ejecutar el script
2. **Usa antes de git commit**: Verifica que .env no está siendo tracked
3. **Parte del CI/CD**: Puedes agregarlo a tu pipeline de deploy
4. **Educativo**: Lee los mensajes, aprende qué se verifica

---

**Archivo**: `docs/auth/guides/VERIFICATION_SCRIPT.md`
**Actualizado**: 2025-01-12
**Estado**: ✅ Documentación del script de verificación
