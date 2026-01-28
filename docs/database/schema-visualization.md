# Database Schema Visualization

## Overview

Este documento explica cómo visualizar el esquema de la base de datos de Agave Backend usando herramientas de diagramación.

## Archivo DBML

**Ubicación**: `/agave-database.dbml`
**Formato**: DBML (Database Markup Language)
**Versión**: 3.1.0

### ¿Qué es DBML?

DBML es un lenguaje de marcado diseñado para definir y documentar esquemas de bases de datos de forma legible tanto para humanos como para máquinas.

**Ventajas**:
- ✅ Fácil de leer y escribir
- ✅ Compatible con múltiples herramientas de visualización
- ✅ Sincronizable con el código
- ✅ Documentación integrada

## Visualización con DrawDB

### Método 1: Import DBML (Recomendado)

1. **Abrir DrawDB**
   ```
   https://www.drawdb.app/
   ```

2. **Importar archivo**
   - Click en "Import" (esquina superior derecha)
   - Selecciona "DBML"
   - Copia y pega el contenido de `agave-database.dbml`
   - Click en "Import"

3. **Resultado**
   - Verás el diagrama completo con 19 tablas
   - Todas las relaciones (foreign keys) visualizadas
   - Agrupadas por funcionalidad

### Método 2: Desde el Repositorio

Si el archivo está en GitHub:

```
https://www.drawdb.app/import?url=https://raw.githubusercontent.com/[user]/[repo]/[branch]/agave-database.dbml
```

## Contenido del Esquema

### Tablas Principales (19 total)

#### 1. Core (Usuarios y Casas)
- **users**: Usuarios del sistema (UUID de Supabase)
- **houses**: Casas/propiedades del fraccionamiento

#### 2. Banking (Transacciones y Vouchers)
- **transactions_bank**: Transacciones bancarias importadas
- **vouchers**: Comprobantes de pago (OCR)
- **transactions_status**: Estado de validación
- **last_transaction_bank**: Tracking de última transacción
- **manual_validation_approvals**: Auditoría de validaciones manuales (v3.1)

#### 3. Records (Sistema de Registros)
- **records**: Registros de pagos
- **house_records**: Relación muchos-a-muchos casas-records
- **record_allocations**: Distribución detallada de pagos

#### 4. Billing & Payment Management
- **periods**: Períodos de facturación mensuales
- **period_config**: Configuración versionada de montos
- **house_balances**: Balance financiero por casa
- **house_period_overrides**: Montos personalizados (convenios)

#### 5. Charges (Cuentas por Concepto)
- **cta_maintenance**: Cuotas de mantenimiento
- **cta_water**: Cargos por agua
- **cta_extraordinary_fee**: Cuotas extraordinarias
- **cta_penalties**: Penalizaciones y multas
- **cta_other_payments**: Otros pagos diversos

### ENUMs (6 tipos)

```dbml
Enum role_t {
  admin, owner, tenant
}

Enum status_t {
  active, suspend, inactive
}

Enum validation_status_t {
  not-found, pending, confirmed, requires-manual, conflict
}

Enum record_allocations_concept_type_enum {
  maintenance, water, extraordinary_fee, penalties, other
}

Enum record_allocations_payment_status_enum {
  complete, partial, overpaid
}

Enum house_period_overrides_concept_type_enum {
  maintenance, water, extraordinary_fee
}
```

### Relaciones (27 Foreign Keys)

El diagrama muestra visualmente:
- ✅ Relaciones uno-a-muchos (houses → users)
- ✅ Relaciones muchos-a-muchos (house_records)
- ✅ Cascadas (ON DELETE CASCADE, ON UPDATE CASCADE)
- ✅ Referencias opcionales (nullable)

## Otras Herramientas Compatibles

### dbdiagram.io

1. Visita https://dbdiagram.io/
2. Click en "Import" → "DBML"
3. Pega el contenido de `agave-database.dbml`

### dbdocs.io (Documentación Online)

```bash
# Instalar CLI
npm install -g dbdocs

# Generar documentación
dbdocs build agave-database.dbml

# Resultado: URL pública con documentación interactiva
```

### SQL Designer Tools

Muchas herramientas SQL soportan import desde DBML:
- DBeaver (con plugins)
- DataGrip (con plugins)
- pgAdmin (conversión requerida)

## Mantenimiento del Archivo

### Cuándo Actualizar

Actualiza `agave-database.dbml` cuando:
- ✅ Agregas nuevas tablas
- ✅ Modificas columnas existentes
- ✅ Cambias relaciones (foreign keys)
- ✅ Añades o modificas índices
- ✅ Cambias ENUMs

### Sincronización con Código

El archivo DBML debe reflejar:
1. Entidades en `src/shared/database/entities/`
2. Esquema en `bd_initial.sql`
3. Migraciones aplicadas

### Verificación de Sincronización

```bash
# 1. Contar tablas en DBML
grep "^Table " agave-database.dbml | wc -l
# Debe ser: 19

# 2. Contar tablas en bd_initial.sql
grep "CREATE TABLE" bd_initial.sql | wc -l
# Debe ser: 19

# 3. Contar entidades en código
ls -1 src/shared/database/entities/*.entity.ts | wc -l
# Debe ser: 19 (sin contar enums.ts)
```

## Tips de Visualización

### En DrawDB

**Organizar por Grupos**:
- Los TableGroups ya están definidos en el DBML
- DrawDB los mostrará automáticamente agrupados

**Colores Personalizados**:
- Puedes cambiar colores de tablas por grupo
- Click derecho en tabla → "Change Color"

**Zoom y Navegación**:
- Scroll para zoom
- Click y arrastra para mover canvas
- Double-click en tabla para centrar

**Exportar**:
- PNG/SVG para documentación
- PDF para presentaciones
- SQL para comparación

### Layouts Recomendados

**Layout 1: Por Funcionalidad**
```
[Core: users, houses]
         ↓
[Banking: transactions, vouchers, status]
         ↓
[Records: records, house_records, allocations]
         ↓
[Billing: periods, config, balances, overrides]
         ↓
[Charges: cta_maintenance, cta_water, etc.]
```

**Layout 2: Por Flujo de Datos**
```
users → houses
         ↓
   transactions_bank ← vouchers
         ↓
   transactions_status
         ↓
      records
         ↓
   house_records → houses
```

## Ejemplos de Uso

### Onboarding de Nuevos Desarrolladores

```bash
# 1. Mostrar estructura visual
echo "Abre: https://www.drawdb.app/"
echo "Importa: agave-database.dbml"

# 2. Explicar módulos
echo "Core (azul): Usuarios y casas"
echo "Banking (verde): Transacciones bancarias"
echo "Records (amarillo): Sistema de pagos"
echo "Billing (naranja): Períodos y configuración"
echo "Charges (rojo): Cuentas por concepto"
```

### Revisión de Arquitectura

Usa el diagrama para:
- ✅ Planear nuevas features
- ✅ Identificar relaciones complejas
- ✅ Detectar tablas huérfanas
- ✅ Optimizar queries (ver índices)

### Documentación de Features

Incluye capturas del diagrama en:
- PRs de nuevas features
- Documentación de módulos
- Presentaciones técnicas

## Conversión a Otros Formatos

### DBML → SQL

```bash
# Usando dbml-cli
npm install -g @dbml/cli

# Convertir a PostgreSQL
dbml2sql agave-database.dbml --postgres -o schema.sql
```

### SQL → DBML

```bash
# Desde PostgreSQL
sql2dbml --postgres $DATABASE_URL -o schema.dbml
```

### DBML → JSON Schema

```bash
# Convertir a JSON
dbml2json agave-database.dbml -o schema.json
```

## Troubleshooting

### Error: "Invalid DBML syntax"

- Verifica que todos los Enums estén definidos antes de usarlos
- Revisa que las referencias sean correctas (Table.column)
- Asegúrate que no haya espacios extra en nombres

### Error: "Table not found"

- Verifica orden de definición de tablas
- Las tablas referenciadas deben definirse primero

### Relaciones no se muestran

- Verifica sintaxis de `ref: > table.column`
- Asegúrate que las columnas existan
- Revisa tipos de datos compatibles

## Recursos Adicionales

### Documentación DBML
- Sitio oficial: https://www.dbml.org/
- Guía completa: https://www.dbml.org/docs/

### Herramientas
- DrawDB: https://www.drawdb.app/
- dbdiagram.io: https://dbdiagram.io/
- dbdocs.io: https://dbdocs.io/

### Comunidad
- GitHub: https://github.com/holistics/dbml
- Discord: DBML Community

---

**Última actualización**: Enero 2026
**Versión del esquema**: 3.1.0
**Mantenido por**: Equipo de Desarrollo Agave
