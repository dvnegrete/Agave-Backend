# Documentación de Autenticación y Sistema de Privilegios

## 📌 Resumen General

Este directorio contiene el análisis completo de la implementación de autenticación con Supabase Auth y un sistema de privilegios jerárquico para Agave.

**Estado:** Análisis completado - Pendiente decisiones de diseño y arquitectura.

---

## 📚 Documentos Disponibles

### Análisis y Diseño
1. **[01-CURRENT-STATE.md](./analysis/01-CURRENT-STATE.md)**
   - Estado actual del sistema de autenticación
   - Fortalezas identificadas
   - Carencias y gaps de funcionalidad

2. **[02-PRIVILEGE-HIERARCHY.md](./design/02-PRIVILEGE-HIERARCHY.md)**
   - Propuesta completa de roles jerárquicos
   - Descripción de cada rol
   - Sugerencias de roles adicionales
   - Relaciones entre roles

3. **[03-DATA-ARCHITECTURE.md](./design/03-DATA-ARCHITECTURE.md)**
   - Estructura de datos para soportar autenticación
   - Tablas propuestas en PostgreSQL
   - Extensiones a Supabase Auth
   - Relaciones de usuarios con casas y contratistas

4. **[04-AUTHENTICATION-FLOW.md](./design/04-AUTHENTICATION-FLOW.md)**
   - Flujos de autenticación para cada caso de uso
   - Sincronización Supabase ↔ PostgreSQL
   - Webhook vs. sincronización directa
   - Manejo de invitaciones

5. **[05-COMPONENTS.md](./architecture/05-COMPONENTS.md)**
   - Componentes técnicos necesarios
   - Guards basados en roles
   - Decoradores personalizados
   - Servicios auxiliares

6. **[06-PERMISSION-MATRIX.md](./design/06-PERMISSION-MATRIX.md)**
   - Matriz de permisos por rol
   - Desglose de capacidades
   - Validación de acceso

7. **[07-DECISION-POINTS.md](./DECISION-POINTS.md)** ⚠️ IMPORTANTE
   - Decisiones críticas que necesita tomar
   - Opciones disponibles para cada decisión
   - Impacto de cada opción

---

## 🎯 Plan de Implementación (Alto Nivel)

### Fase 1: Modelo de Datos (Base)
- Crear tablas de roles y permisos
- Extender tabla users con supabase_id
- Crear relaciones usuario-casa-rol
- Migraciones TypeORM

### Fase 2: Autenticación Mejorada
- Actualizar AuthService para sincronizar usuarios
- Implementar guards y decoradores
- Actualizar enums con nuevos roles

### Fase 3: Servicios de Negocio
- PermissionService: verificar permisos
- UserService: gestión de usuarios
- ContractorService: gestión de contratistas
- InvitationService: sistema de invitaciones

### Fase 4: Endpoints de Control de Acceso
- Crear usuarios como admin
- Invitar empleados/proveedores
- Obtener perfil con permisos
- Cambiar roles

### Fase 5: Testing y Documentación
- Tests de guards y permisos
- Documentación de API
- Ejemplos de uso

---

## 🚀 Cómo Proceder

1. **Revisar análisis**: Lee los documentos en orden numérico
2. **Tomar decisiones**: Completa [DECISION-POINTS.md](./DECISION-POINTS.md)
3. **Validar diseño**: Asegúrate que el diseño se alinea con tus necesidades
4. **Implementar**: Usa los componentes descritos en [05-COMPONENTS.md](./architecture/05-COMPONENTS.md)

---

## 📁 Estructura de Directorios

```
docs/auth/
├── INDEX.md (este archivo)
├── DECISION-POINTS.md (decisiones pendientes)
├── analysis/
│   └── 01-CURRENT-STATE.md
├── design/
│   ├── 02-PRIVILEGE-HIERARCHY.md
│   ├── 03-DATA-ARCHITECTURE.md
│   ├── 04-AUTHENTICATION-FLOW.md
│   └── 06-PERMISSION-MATRIX.md
└── architecture/
    └── 05-COMPONENTS.md
```

---

## 🔗 Enlaces Relacionados

- **Modules Auth**: `docs/modules/auth/README.md`
- **Current Implementation**: `src/shared/auth/`
- **Database Entities**: `src/shared/database/entities/`

---

## 📝 Notas

- Este análisis se realizó sin hacer cambios al código
- Las decisiones pueden ser revisadas y ajustadas
- Se recomienda usar un enfoque iterativo
- Los componentes pueden implementarse gradualmente

---

**Última actualización**: 2025-01-11
**Estado**: 🔄 Pendiente decisiones de implementación
