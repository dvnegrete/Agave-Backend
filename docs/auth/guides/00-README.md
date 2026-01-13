# 📚 Guías de Configuración de Supabase - Bienvenido

Bienvenido al centro de documentación de Supabase para Agave Backend.

---

## 🎯 ¿Qué Necesitas Hacer?

### Opción 1: Necesito configurar Supabase YA

**Tiempo:** 10 minutos

Sigue esta guía paso a paso:

```
📖 SUPABASE_STEP_BY_STEP.md
   ↓
   (Seguir los 10 pasos exactamente)
   ↓
✅ Supabase configurado
```

---

### Opción 2: Necesito verificar que está bien configurado

**Tiempo:** 1 minuto

Ejecuta este comando desde `agave-backend/`:

```bash
bash verify-supabase.sh
```

Si todo está verde ✓, ¡estás listo!

---

### Opción 3: Necesito una referencia rápida

**Para:** Recordar qué variable va dónde

Lee: **ENV_VARIABLES_QUICK_REFERENCE.md**

Tiempo: 2 minutos

---

### Opción 4: Tengo un problema

**Primero:** Ejecuta el script de verificación
```bash
bash verify-supabase.sh
```

**Luego:** Consulta la sección "Problemas Comunes" en:
- **SUPABASE_SETUP.md**

O revisa la guía completa para entender mejor.

---

## 📖 Estructura de Documentos

```
docs/auth/guides/
│
├── 00-README.md (este archivo)
│   ↓ Empieza aquí para orientación
│
├── SUPABASE_STEP_BY_STEP.md ⭐
│   ↓ Guía visual paso a paso (5-10 min)
│
├── ENV_VARIABLES_QUICK_REFERENCE.md
│   ↓ Referencia rápida de variables (2-3 min)
│
├── VERIFICATION_SCRIPT.md
│   ↓ Cómo usar verify-supabase.sh (1 min)
│
└── SUPABASE_SETUP.md
    ↓ Guía completa y detallada (15-20 min)
```

---

## 🚀 Flujo Rápido (5-10 Minutos)

### Si es tu primera vez:

```
1. Abre SUPABASE_STEP_BY_STEP.md
2. Sigue cada paso exactamente
3. Copia las 3 variables de Supabase
4. Actualiza .env
5. Ejecuta: bash verify-supabase.sh
6. ¡Listo! Tu Supabase está configurado
```

### Si ya lo has hecho antes:

```
1. Ve a https://app.supabase.com
2. Settings → API Settings
3. Copia 3 claves
4. Actualiza .env
5. bash verify-supabase.sh
6. ✅ Listo
```

---

## 📋 Las 3 Variables Principales

Necesitas obtener **exactamente 3 variables** de Supabase:

### 1. SUPABASE_URL
```
Ubicación: Settings → General → Project URL
Formato: https://[PROJECT-ID].supabase.co
Ejemplo: https://abc123xyz456.supabase.co
```

### 2. SUPABASE_ANON_KEY
```
Ubicación: Settings → API Settings → anon public
Formato: eyJ0eXAi... (200+ caracteres)
Seguridad: ✅ Pública, segura compartir
```

### 3. SUPABASE_SERVICE_ROLE_KEY
```
Ubicación: Settings → API Settings → service_role (secret)
Formato: eyJ0eXAi... (200+ caracteres)
Seguridad: ⚠️ SECRETA, nunca exponer
```

---

## ✅ Verificación

Después de configurar, ejecuta:

```bash
bash verify-supabase.sh
```

Debe mostrar:
```
✓ SUPABASE_URL configurado
✓ SUPABASE_ANON_KEY configurado
✓ SUPABASE_SERVICE_ROLE_KEY configurado
✓ DATABASE_URL configurado
✓ @supabase/supabase-js instalado
✓ .env protegido en .gitignore

✓ Todas las verificaciones pasaron
```

---

## 🔗 Después de Configurar

Una vez que Supabase esté listo:

1. **Lee el análisis general**: `../INDEX.md`
2. **Toma decisiones de arquitectura**: `../DECISION-POINTS.md`
3. **Entiende el modelo de roles**: `../design/02-PRIVILEGE-HIERARCHY.md`
4. **Ve los componentes técnicos**: `../architecture/05-COMPONENTS.md`

---

## 💡 Tips Importantes

### ✅ Hacer
```
✓ Copiar las claves completas (son largas)
✓ Guardar .env en tu máquina local
✓ Proteger .env con .gitignore
✓ Usar SUPABASE_URL y ANON_KEY en frontend
✓ Usar SERVICE_ROLE_KEY solo en backend
```

### ❌ NO Hacer
```
✗ No truncar las claves
✗ No subir .env a GitHub
✗ No compartir SERVICE_ROLE_KEY
✗ No hardcodear variables en código
✗ No guardar contraseñas en comentarios
```

---

## 📞 ¿Ayuda?

### Si necesitas referencia rápida
→ **ENV_VARIABLES_QUICK_REFERENCE.md**

### Si necesitas instrucciones visuales
→ **SUPABASE_STEP_BY_STEP.md**

### Si tienes problemas
1. Ejecuta: `bash verify-supabase.sh`
2. Lee la sección "Problemas Comunes" en **SUPABASE_SETUP.md**
3. Verifica en [supabase.com/docs](https://supabase.com/docs)

### Si necesitas entender todo
→ **SUPABASE_SETUP.md**

---

## ⏱️ Tiempo Total

- **Configuración:** 5-10 minutos
- **Verificación:** 1 minuto
- **Primeras pruebas:** 5 minutos
- **Total:** ~15-20 minutos

---

## 🎯 Próximo Paso

```
👉 Abre: SUPABASE_STEP_BY_STEP.md
   y sigue los 10 pasos exactamente
```

---

**Guía:** docs/auth/guides/00-README.md
**Versión:** 1.0
**Estado:** ✅ Listo
**Última actualización:** 2025-01-12

¡Bienvenido a la configuración de Supabase!
