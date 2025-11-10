# 📚 Estructura de Documentación

Este documento describe la organización de toda la documentación del proyecto Agave Backend.

## 🎯 Ubicación Centralizada

Toda la documentación del proyecto está centralizada en el directorio `/docs/` para facilitar el acceso, mantenimiento y navegación.

## 📁 Estructura de Directorios

```
docs/
├── README.md                              # Índice principal de documentación
├── GOOGLE_CLOUD_VISION_SETUP.md          # Guía de configuración de GCP
├── DOCUMENTATION_STRUCTURE.md            # Este archivo
│
├── api/                                   # Documentación de API
│   ├── README.md                          # Índice de endpoints
│   └── swagger-integration.md             # Guía de Swagger/OpenAPI
│
├── database/                              # Documentación de base de datos
│   ├── schema.md                         # Esquema de tablas
│   ├── triggers.md                       # Triggers SQL
│   ├── indexes.md                        # Índices de optimización
│   └── setup.md                          # Comandos de setup
│
├── features/                              # Documentación de features
│   ├── transactions-bank/
│   │   └── README.md                     # Feature de transacciones bancarias
│   ├── bank-reconciliation/
│   │   └── README.md                     # Feature de conciliación bancaria
│   ├── vouchers/
│   │   └── README.md                     # Feature de procesamiento de vouchers
│   └── payment-management/
│       ├── README.md                     # Feature de gestión de pagos
│       └── MIGRATIONS.md                 # Guía de migraciones de BD
│
├── modules/                               # Documentación de módulos compartidos
│   ├── README.md                         # Índice de módulos
│   ├── auth/                             # Autenticación
│   │   └── README.md
│   ├── content/                          # Sistema de contenido centralizado
│   │   └── README.md
│   ├── google-cloud/                     # Librería de Google Cloud
│   │   └── README.md
│   ├── transactions-bank/                # Módulo de transacciones
│   │   └── README.md
│   └── vouchers/                         # Módulo de vouchers
│       ├── README.md                     # Documentación general
│       └── ocr-implementation.md         # Implementación de OCR
│
├── examples/                              # Ejemplos de código
│   └── README.md
│
└── guides/                                # Guías de desarrollo
    └── README.md
```

## 📖 Documentos Principales

### Documentación de Arquitectura
- **[README.md](README.md)** - Índice principal con overview del proyecto
- **[../CLAUDE.md](../CLAUDE.md)** - Estructura del proyecto y comandos para Claude Code

### Módulos Compartidos

#### Google Cloud Platform
- **Ubicación en código**: `src/shared/libs/google-cloud/`
- **Documentación**: [modules/google-cloud/README.md](modules/google-cloud/README.md)
- **Setup**: [GOOGLE_CLOUD_VISION_SETUP.md](GOOGLE_CLOUD_VISION_SETUP.md)

Librería unificada para servicios de GCP:
- Vision API (OCR)
- Cloud Storage
- Cloud Translate
- Text-to-Speech
- Speech-to-Text

#### Content Dictionary System
- **Ubicación en código**: `src/shared/content/`
- **Documentación**: [modules/content/README.md](modules/content/README.md)

Sistema centralizado de:
- Mensajes de usuario (WhatsApp, Transacciones Bancarias)
- Prompts de IA
- Valores de negocio y configuración
- Type-safety completo

### Features

#### Transactions Bank
- **Ubicación en código**: `src/features/transactions-bank/`
- **Documentación**: [features/transactions-bank/README.md](features/transactions-bank/README.md)

Módulo de procesamiento de transacciones bancarias con:
- Detección automática de duplicados
- Soporte multi-banco
- Validación de datos
- Exportación de reportes

#### Bank Reconciliation
- **Ubicación en código**: `src/features/bank-reconciliation/`
- **Documentación**: [features/bank-reconciliation/README.md](features/bank-reconciliation/README.md)

Módulo de conciliación bancaria automática con:
- Matching de vouchers vs transacciones bancarias
- Identificación de casa por centavos
- Tres grupos de resultados (conciliados, pendientes, sobrantes)
- Niveles de confianza y validación manual

#### Payment Management
- **Ubicación en código**: `src/features/payment-management/`
- **Documentación**: [features/payment-management/README.md](features/payment-management/README.md)
- **Migraciones**: [features/payment-management/MIGRATIONS.md](features/payment-management/MIGRATIONS.md)

Módulo de gestión de períodos de facturación con:
- Creación automática de períodos durante conciliación
- Configuración versionada de montos y reglas de pago
- Montos personalizados por casa (convenios de pago)
- Distribución detallada de pagos entre conceptos
- Sistema de acumulación de centavos y balances

#### Vouchers & OCR
- **Ubicación en código**: `src/features/vouchers/`
- **Documentación General**: [modules/vouchers/README.md](modules/vouchers/README.md)
- **Implementación OCR**: [modules/vouchers/ocr-implementation.md](modules/vouchers/ocr-implementation.md)

Módulo de procesamiento de comprobantes con:
- OCR con Google Cloud Vision
- Integración con WhatsApp Business API
- Gestión de conversaciones con contexto
- Clasificación de mensajes con IA

### Base de Datos
- **[database/schema.md](database/schema.md)** - Estructura completa de tablas
- **[database/triggers.md](database/triggers.md)** - Lógica de triggers SQL
- **[database/indexes.md](database/indexes.md)** - Optimización de performance
- **[database/setup.md](database/setup.md)** - Comandos npm de setup

## 🔄 Migración de Documentación

Los siguientes archivos fueron migrados a la estructura centralizada:

### Movidos
- `IMPLEMENTACION_OCR_GCP.md` → `docs/modules/vouchers/ocr-implementation.md`

### Copiados (mantienen versión en src/)
- `src/shared/libs/google-cloud/README.md` → `docs/modules/google-cloud/README.md`
- `src/shared/content/README.md` → `docs/modules/content/README.md`

> 💡 **Nota**: Los READMEs en `src/` se mantienen como referencia rápida para desarrolladores, pero apuntan a la documentación completa en `docs/`.

## 🧭 Navegación Rápida

### Por Tema

**Desarrollo**:
- [Quick Start](README.md#quick-start)
- [Development Guidelines](README.md#development-guidelines)
- [Code Quality](README.md#code-quality)

**API**:
- [API Documentation](api/README.md)
- [Swagger/OpenAPI Integration](api/swagger-integration.md)
- [Transactions Bank API](README.md#transactions-bank-endpoints)
- [Vouchers & OCR API](README.md#vouchers--ocr-endpoints)

**Integración**:
- [Google Cloud Setup](GOOGLE_CLOUD_VISION_SETUP.md)
- [WhatsApp Business API](modules/vouchers/README.md#whatsapp-integration)
- [Content System](modules/content/README.md)

**Base de Datos**:
- [Schema](database/schema.md)
- [Triggers](database/triggers.md)
- [Setup Commands](database/setup.md)

## 📝 Convenciones

### Nombres de Archivos
- `README.md` - Documentación principal de un módulo/feature
- `[nombre].md` - Documentación específica de un tema
- Usar kebab-case para nombres de archivos: `ocr-implementation.md`

### Estructura de Documentos
1. **Título principal** (#)
2. **Overview/Resumen** - Descripción breve
3. **Tabla de contenidos** (para documentos largos)
4. **Secciones principales** (##)
5. **Ejemplos de código** - Siempre que sea posible
6. **Referencias** - Links a documentación relacionada

### Links Internos
- Usar rutas relativas para links entre documentos
- Ejemplo: `[Content System](modules/content/README.md)`
- Incluir anclas cuando sea necesario: `#sección-específica`

## 🔍 Búsqueda de Documentación

### Por Palabra Clave

```bash
# Buscar en toda la documentación
grep -r "keyword" docs/

# Buscar solo en títulos
grep -r "^#.*keyword" docs/

# Buscar archivos específicos
find docs/ -name "*keyword*.md"
```

### Por Categoría

- **Arquitectura**: `docs/README.md`, `CLAUDE.md`
- **API**: `docs/api/README.md`, `docs/api/swagger-integration.md`
- **Features**: `docs/features/`
- **Módulos Compartidos**: `docs/modules/`
- **Base de Datos**: `docs/database/`
- **Configuración**: Sección "Environment Configuration" en `docs/README.md`

## 🚀 Mejores Prácticas

### Al Crear Nueva Documentación

1. **Ubicación correcta**:
   - Features → `docs/features/[feature-name]/`
   - Módulos compartidos → `docs/modules/[module-name]/`
   - Guías → `docs/guides/`

2. **Actualizar índices**:
   - Agregar enlace en `docs/README.md`
   - Actualizar tabla de contenidos del módulo padre

3. **Incluir ejemplos**:
   - Código funcional
   - Casos de uso comunes
   - Configuración necesaria

4. **Mantener actualizado**:
   - Revisar al hacer cambios en el código
   - Actualizar versiones de dependencias
   - Documentar breaking changes

### Al Actualizar Documentación Existente

1. Verificar que todos los links funcionen
2. Actualizar ejemplos de código si hay cambios en la API
3. Mantener consistencia con otras documentaciones
4. Añadir fecha de última actualización si es relevante

## 📞 Soporte

Si tienes dudas sobre dónde ubicar documentación:
1. Revisa esta estructura
2. Consulta documentos similares existentes
3. Pregunta en el equipo de desarrollo

---

## 📝 Actualizaciones Recientes

### Noviembre 2025
- ✅ Agregada documentación de Swagger/OpenAPI Integration
- ✅ Implementada arquitectura híbrida de decoradores para Swagger
- ✅ Documentados 11 endpoints con Swagger (bank-reconciliation: 1, transactions-bank: 8, vouchers: 2)
- ✅ Actualizada estructura de directorios en `docs/api/`

---

**Mantenido por**: Equipo de Desarrollo Agave
**Última actualización**: Noviembre 2025
