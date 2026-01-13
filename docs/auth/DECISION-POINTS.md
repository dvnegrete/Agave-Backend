# 🚨 Puntos de Decisión Críticos - PENDIENTE RESOLVER

## ⚠️ IMPORTANTE: Debes responder estas preguntas para proceder

Este documento contiene decisiones críticas que **deben tomarse antes de implementar** la solución de autenticación y privilegios.

---

## 1️⃣ Sincronización Supabase ↔ PostgreSQL

### Pregunta
¿Cómo deseas sincronizar usuarios entre Supabase Auth y tu base de datos local?

### Opción A: Webhook de Supabase ⭐ RECOMENDADO
**Ventajas**:
- Desacoplamiento entre sistemas
- Supabase maneja la integridad
- Escalable y confiable
- Async (no bloquea signup)

**Desventajas**:
- Más complejo de configurar
- Latencia inherente (webhook async)
- Requiere manejo de reintentos
- Más puntos de fallo potenciales

**Esfuerzo de implementación**: Medio-Alto

---

### Opción B: Sincronización Directa en AuthService
**Ventajas**:
- Más simple
- Más rápido (síncrono)
- Transacciones atómicas
- Un solo punto de control

**Desventajas**:
- AuthService acoplado a BD local
- Si BD falla, usuario creado en Supabase sin registro local
- Requiere reconciliación periódica

**Esfuerzo de implementación**: Bajo-Medio

---

### Opción C: Híbrida (Directa + Reconciliación)
**Descripción**: Sincronización directa en AuthService + job diario de reconciliación

**Ventajas**:
- Lo mejor de ambas opciones
- Rápido en signup
- Confiable a largo plazo

**Desventajas**:
- Más código que mantener
- Complejidad media

**Esfuerzo de implementación**: Medio

---

### **TU DECISIÓN**:
```
Elige una: [ ] Opción A (Webhook) [ ] Opción B (Directo) [ ] Opción C (Híbrida)
```

---

## 2️⃣ Roles Adicionales

### Pregunta
De los roles sugeridos, ¿cuáles deseas implementar?

### Roles Obligatorios (tu especificación)
- ✅ **Admin** - Control total
- ✅ **Propietario** - Dueño de casa(s)
- ✅ **Inquilino** - Residente
- ✅ **Empleado** - Trabajador contratado
- ✅ **Proveedor** - Servicios externos

### Roles Sugeridos (opcionales)
- **Gestor Financiero**: Acceso a finanzas (delegado del Propietario)
  - ¿Implementar? [ ] Sí [ ] No [ ] Después

- **Soporte Técnico**: Personal de soporte del sistema
  - ¿Implementar? [ ] Sí [ ] No [ ] Después

- **Visitante**: Acceso temporal de solo lectura
  - ¿Implementar? [ ] Sí [ ] No [ ] Después

### **TU DECISIÓN**:
```
Marca los roles que deseas implementar en la Fase 1:
- [x] Admin
- [x] Propietario
- [x] Inquilino
- [x] Empleado
- [x] Proveedor
- [ ] Gestor Financiero
- [ ] Soporte Técnico
- [ ] Visitante
- [ ] Otros: _______________________
```

---

## 3️⃣ Sistema de Invitaciones

### Pregunta
¿Cómo deseas que un Propietario invite Empleados/Proveedores?

### Opción A: Email + Código de Invitación ⭐ RECOMENDADO
```
1. Propietario va a /contractors/invite
2. Rellena: email, rol, descripción
3. Sistema envía email con código
4. Empleado abre link con código
5. Rellena signup con email pre-verificado
6. Sistema lo vincula automáticamente
```

**Ventajas**:
- Seguro (email verificado)
- No requiere contraseña temporal
- Flujo claro
- Fácil de rastrear

**Desventajas**:
- Requiere servicio de email
- Flujo de 2 pasos

---

### Opción B: Admin Crea Usuario + Password Temporal
```
1. Propietario pide a Admin crear usuario
2. Admin va a /auth/admin/create-user
3. Sistema genera password temporal
4. Admin comparte credenciales
5. Empleado hace login
6. Sistema fuerza cambio de password
```

**Ventajas**:
- Admin tiene control total
- Flujo simple

**Desventajas**:
- Requiere intervención de Admin
- Password temporal en email (seguridad)
- Workflow más lento

---

### Opción C: Ambas
Implementar ambas opciones para flexibilidad.

**Ventajas**:
- Máxima flexibilidad

**Desventajas**:
- Más código
- Más testing necesario

---

### **TU DECISIÓN**:
```
¿Cuál sistema de invitaciones prefieres?
[ ] Opción A (Email + Código) ⭐ RECOMENDADO
[ ] Opción B (Admin + Password Temporal)
[ ] Opción C (Ambas)
```

---

## 4️⃣ Acceso Contextual

### Pregunta
¿Cuál es el comportamiento deseado para acceso a casas?

### Opción A: Acceso Estricto por Asignación
Un usuario **solo ve lo que está explícitamente asignado**

```
Usuario: Juan
- Casa A: Inquilino (ve solo datos de Casa A)
- Casa B: Propietario (ve todo de Casa B)
- Casa C: Sin acceso

Resultado: Juan ve SOLO Casa A y Casa B
```

**Ventajas**:
- Máxima seguridad
- Control granular
- Cumple regulaciones de privacidad

**Desventajas**:
- Requiere mantenimiento de asignaciones
- Más complejos los queries

---

### Opción B: Acceso Basado en Rol + Casa Primaria
Usuario ve su casa "primaria" + casas donde tiene rol definido

```
Usuario: Juan (Inquilino)
- Casa Primaria: Casa A
- Casas asignadas: Casa B (como Propietario)

Resultado: Juan ve Casa A + Casa B
```

**Ventajas**:
- Más flexible
- Simpler para usuarios con múltiples casas

**Desventajas**:
- Menos seguro
- Riesgo de fuga de datos

---

### Opción C: Admin Puede Ver Todo, Otros Acceso Estricto
Admin ve todo, otros usuarios rigen por Opción A.

**Ventajas**:
- Seguridad normal + Admin override
- Práctico para soporte

**Desventajas**:
- Combinación de dos sistemas

---

### **TU DECISIÓN**:
```
¿Cómo debe funcionar el acceso a casas?
[ ] Opción A (Acceso Estricto) ⭐ MÁS SEGURO
[ ] Opción B (Basado en Rol + Primaria)
[ ] Opción C (Admin Todo + Otros Estricto)
```

---

## 5️⃣ Matriz de Permisos Inicial

### Pregunta
¿Deseas usar la matriz de permisos propuesta o simplificar?

### Opción A: Matriz Completa (Propuesta) ⭐ RECOMENDADO
**Permisos granulares por recurso**:
- users:view_all, users:create, users:update_any, etc.
- payments:view_own, payments:approve, payments:delete, etc.
- reports:view_house, reports:generate, reports:export, etc.
- ... (total ~40-50 permisos)

**Ventajas**:
- Máxima flexibilidad
- Fácil agregar nuevos permisos
- Control fino
- Preparado para futuro

**Desventajas**:
- Más complejo inicialmente
- Más queries a BD
- Mantenimiento

---

### Opción B: Matriz Simplificada
**Solo grupos grandes**:
- view_own_data
- manage_house
- manage_contractors
- approve_payments
- view_reports

**Ventajas**:
- Más simple
- Menos BD queries
- Más rápido implementar

**Desventajas**:
- Menos flexible
- Difícil agregar permisos específicos después

---

### **TU DECISIÓN**:
```
¿Qué modelo de permisos prefieres?
[ ] Opción A (Completa, ~40-50 permisos) ⭐ RECOMENDADO
[ ] Opción B (Simplificada, ~5-10 permisos)
```

---

## 6️⃣ Verificación de Email

### Pregunta
¿Requiere verificación de email?

### Opción A: Requerido para Todos
Usuario debe verificar email antes de usar la cuenta.

**Ventajas**:
- Datos válidos garantizados
- Comunicación confiable

**Desventajas**:
- Flujo más largo
- Usuarios pueden perder emails

---

### Opción B: Requerido Solo para Ciertas Acciones
Email verificado solo para operaciones sensibles (aprobar pagos, etc.)

**Ventajas**:
- Balance seguridad/UX
- Usuarios pueden usar sistema antes

**Desventajas**:
- Lógica más compleja
- Múltiples flujos

---

### Opción C: No Requerido (Supabase maneja)
Supabase lo maneja automáticamente.

**Ventajas**:
- Más simple
- Supabase responsable

**Desventajas**:
- Menos control
- Emails inválidos posibles

---

### **TU DECISIÓN**:
```
¿Cómo deseas manejar verificación de email?
[ ] Opción A (Requerido para todos)
[ ] Opción B (Requerido para operaciones sensibles)
[ ] Opción C (No requerido - Supabase maneja)
```

---

## 7️⃣ Auditoría y Logging

### Pregunta
¿Qué nivel de auditoría deseas?

### Opción A: Auditoría Completa
Registrar TODOS los cambios:
- login/logout
- cambios de rol
- cambios de permisos
- acceso a recursos sensibles
- cambios de contraseña
- etc.

**Ventajas**:
- Compliance/regulatorio
- Debugging completo
- Seguridad máxima

**Desventajas**:
- Más espacio BD
- Queries más lentas
- Privacidad (GDPR)

---

### Opción B: Auditoría Crítica
Solo acciones críticas:
- creación de usuarios
- cambios de rol
- aprobaciones de pagos

**Ventajas**:
- Balance

**Desventajas**:
- Menos trazabilidad

---

### Opción C: Sin Auditoría (Por ahora)
No implementar auditoría inicialmente.

**Ventajas**:
- Más simple
- Más rápido

**Desventajas**:
- Difícil agregar después
- Riesgo de compliance

---

### **TU DECISIÓN**:
```
¿Qué nivel de auditoría deseas?
[ ] Opción A (Completa) ⭐ RECOMENDADO
[ ] Opción B (Crítica)
[ ] Opción C (Sin auditoría)
```

---

## 8️⃣ Propietarios Múltiples por Casa

### Pregunta
¿Una casa puede tener múltiples propietarios o solo uno?

### Opción A: Un Propietario por Casa
Simplifica lógica, una persona responsable.

**Ventajas**:
- Más simple
- Responsabilidad clara
- Fácil de implementar

**Desventajas**:
- No flexible para sociedades

---

### Opción B: Múltiples Propietarios por Casa
Varias personas pueden ser propietarios.

**Ventajas**:
- Flexible
- Soporta sociedades

**Desventajas**:
- Más complejo
- Conflictos de decisiones
- Necesita jerarquía entre propietarios

---

### **TU DECISIÓN**:
```
¿Una casa puede tener múltiples propietarios?
[ ] No, un propietario por casa (Opción A) ⭐ RECOMENDADO
[ ] Sí, múltiples propietarios (Opción B)
```

---

## 9️⃣ Migración de Usuarios Existentes

### Pregunta
¿Cómo deseas migrar usuarios actuales del sistema?

### Contexto
Ya hay usuarios en la tabla `users` con roles. Necesitan ser mapeados al nuevo sistema.

### Opción A: Migración Automática
Script ejecuta migración:
1. Crea relación con Supabase Auth
2. Asigna rol en tabla users
3. Crea user_house_assignments automáticamente

**Ventajas**:
- Rápido
- Usuarios siguen usando sistema

**Desventajas**:
- Asignaciones pueden ser incorrectas
- Requiere validación manual

---

### Opción B: Migración Manual + Validación
Admin revisa y valida cada usuario antes de migrar.

**Ventajas**:
- Asignaciones correctas
- Control total

**Desventajas**:
- Lento
- Requiere trabajo manual
- Datos inconsistentes durante migración

---

### Opción C: Migración en Dos Fases
1. Migración automática (data técnica)
2. Validación manual (business logic)

**Ventajas**:
- Balance

**Desventajas**:
- Más tiempo

---

### **TU DECISIÓN**:
```
¿Cómo migrar usuarios existentes?
[ ] Opción A (Automática)
[ ] Opción B (Manual + Validación)
[ ] Opción C (Dos Fases) ⭐ RECOMENDADO
```

---

## 🔟 Timeline y Prioridades

### Pregunta
¿En qué orden deseas implementar?

### Opción A: Todo en una Fase (MVP Completo)
Todas las funcionalidades en una sola fase.

**Ventajas**:
- Sistema completo rápido

**Desventajas**:
- Riesgo alto
- Testing difícil
- Tiempo largo

---

### Opción B: Fases Incrementales ⭐ RECOMENDADO

**Fase 1** (2-3 semanas): Bases
- BD (roles, permissions)
- AuthService mejorado
- RoleGuard básico
- Usuarios admin creando usuarios

**Fase 2** (2 semanas): Componentes Completos
- PermissionGuard
- ContextGuard
- Servicios mejorados
- Invitaciones

**Fase 3** (2 semanas): Integración
- Actualizar endpoints existentes
- Testing completo
- Documentación

**Fase 4** (1 semana): Auditoría y Polish
- AuditLogService
- Logs completos
- Optimización

---

### **TU DECISIÓN**:
```
¿Deseas implementar todo en una fase o en fases?
[ ] Opción A (Todo en una fase)
[ ] Opción B (Fases incrementales) ⭐ RECOMENDADO
```

---

## 📝 Resumen de Decisiones

**Completa este cuadro con tus respuestas:**

| Decisión | Tu Respuesta | Notas |
|----------|--------------|-------|
| 1. Sincronización | [ ] A [ ] B [ ] C | |
| 2. Roles Adicionales | [ ] Gest.Fin [ ] Soporte [ ] Visitante | |
| 3. Invitaciones | [ ] A [ ] B [ ] C | |
| 4. Acceso Contextual | [ ] A [ ] B [ ] C | |
| 5. Matriz Permisos | [ ] A (Completa) [ ] B (Simple) | |
| 6. Verificación Email | [ ] A [ ] B [ ] C | |
| 7. Auditoría | [ ] A [ ] B [ ] C | |
| 8. Múltiples Propietarios | [ ] No [ ] Sí | |
| 9. Migración Usuarios | [ ] A [ ] B [ ] C | |
| 10. Timeline | [ ] Todo [ ] Fases | |

---

## 🚀 Próximos Pasos Después de Decidir

Una vez hayas respondido estas preguntas:

1. **Comunica tus decisiones** (comparte este archivo completado)
2. **Revisión de arquitectura** si es necesario ajustar por tus decisiones
3. **Crear plan detallado** basado en tus respuestas
4. **Comenzar implementación** en orden de prioridad
5. **Testing exhaustivo** para cada componente

---

## ⚠️ NOTA IMPORTANTE

Estas decisiones pueden ser **revisadas y ajustadas** durante la implementación si es necesario. Este no es un compromiso irreversible, pero es mejor tomar decisiones informadas al inicio que cambiar todo después.

---

**Archivo**: `docs/auth/DECISION-POINTS.md`
**Actualizado**: 2025-01-11
**Estado**: 🔴 **PENDIENTE TUS RESPUESTAS**

**Por favor completa este documento y comunica tus decisiones para proceder con la implementación.**
