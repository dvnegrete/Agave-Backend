# Jerarquía de Privilegios - Propuesta de Roles

## 📊 Jerarquía Visual

```
ADMIN (máximo privilegio)
  ↓
SOPORTE_TECNICO (delegado)
  ↓
PROPIETARIO (un dueño por casa)
  ├── GESTOR_FINANCIERO (subconjunto de propietario)
  ├── INQUILINO (residente)
  │   ├── EMPLEADO (contratado)
  │   └── PROVEEDOR (servicios)
  └── VISITANTE (acceso temporal)
```

---

## 🎯 Definición de Roles Principales

### 1. ADMIN
**Descripción**: Administrador del sistema con control total.

**Características**:
- Control total sobre todas las casas y usuarios
- Gestión de administradores del sistema
- Acceso a reportes globales
- Configuración del sistema
- Auditoría y logging

**Permisos típicos**:
- Crear/editar/eliminar usuarios
- Crear/editar/eliminar casas
- Ver todos los datos
- Generar reportes avanzados
- Cambiar configuración del sistema
- Ver audit logs

**Restricciones**: Ninguna

**Jerarquía**: Nivel 0 (máximo)

---

### 2. PROPIETARIO
**Descripción**: Propietario de una o más casas. Generalmente 1 propietario por casa.

**Características**:
- Gestión completa de su(s) casa(s)
- Gestión de inquilinos y contratistas
- Acceso a todos los datos de su(s) casa(s)
- Aprobación de pagos
- Generación de reportes de su(s) casa(s)

**Permisos típicos**:
- Crear/editar inquilinos de su casa
- Crear/editar empleados y proveedores
- Ver pagos de su casa
- Aprobar/rechazar pagos
- Ver reportes de su casa
- Editar datos de su casa
- Invitar gestores financieros

**Restricciones**:
- No puede ver casas de otros propietarios
- No puede crear admins
- No puede cambiar su propio rol
- No puede ver datos del sistema global

**Jerarquía**: Nivel 1

---

### 3. GESTOR_FINANCIERO
**Descripción**: Gestor designado por un propietario para manejar finanzas.

**Características**:
- Subconjunto de permisos del propietario
- Acceso solo a datos financieros
- No puede cambiar estructura de casas

**Permisos típicos**:
- Ver pagos
- Ver reportes financieros
- Exportar datos financieros

**Restricciones**:
- No puede crear/editar usuarios
- No puede cambiar estructuras
- No puede aprobar cambios administrativos
- Solo lectura de pagos (no crear)

**Jerarquía**: Nivel 1.5 (subconjunto de propietario)

---

### 4. INQUILINO
**Descripción**: Residente en la casa. Tiene acceso a información de su vivienda.

**Características**:
- Acceso a datos de su casa solamente
- Ver su deuda/pagos
- Recibir notificaciones
- Acceso limitado a reportes

**Permisos típicos**:
- Ver su deuda pendiente
- Ver historial de pagos propios
- Ver estado de servicios de la casa
- Ver avisos y comunicados

**Restricciones**:
- Solo ve su casa
- No puede crear/editar usuarios
- No puede aprobar nada
- No puede ver datos de otros inquilinos

**Jerarquía**: Nivel 2

---

### 5. EMPLEADO
**Descripción**: Trabajador contratado por un propietario (jardinero, portero, etc.).

**Características**:
- Acceso a funciones específicas del trabajo
- Controlado por propietario
- Acceso a su casa de trabajo

**Permisos típicos**:
- Ver tareas asignadas
- Registrar actividades
- Ver comunicados de la casa
- Reportar problemas/mantenimiento

**Restricciones**:
- Solo acceso a su casa asignada
- No puede ver datos de pagos
- No puede crear/editar otros usuarios
- Acceso limitado a reportes

**Jerarquía**: Nivel 3

---

### 6. PROVEEDOR
**Descripción**: Proveedor de servicios (fontanero, electricista, etc.).

**Características**:
- Similar a empleado pero enfocado en servicios
- Acceso temporal/por proyecto
- Controlado por propietario

**Permisos típicos**:
- Ver ordenes de servicio
- Reportar trabajos completados
- Ver especificaciones de servicios
- Comunicarse con propietario

**Restricciones**:
- Solo acceso mientras tiene servicios activos
- No puede ver datos de pagos
- No puede acceder a áreas no autorizadas
- Acceso limitado a información de la casa

**Jerarquía**: Nivel 4

---

### 7. SOPORTE_TECNICO (Sugerido)
**Descripción**: Técnico de soporte del sistema.

**Características**:
- Acceso para resolver problemas
- No es propietario pero tiene permisos especiales
- Auditoría de problemas de usuarios

**Permisos típicos**:
- Ver logs del sistema
- Ver datos de usuarios específicos
- Resetear contraseñas
- Desactivar cuentas problemáticas

**Restricciones**:
- No puede cambiar roles
- No puede acceder a datos financieros
- No puede crear usuarios
- Acceso limitado a cambios estructurales

**Jerarquía**: Nivel 0.5 (debajo de admin)

---

### 8. VISITANTE (Sugerido - Opcional)
**Descripción**: Acceso temporal de solo lectura.

**Características**:
- Acceso temporal a información
- Solo lectura
- Se expira automáticamente

**Permisos típicos**:
- Ver información pública de la casa
- Ver comunicados
- Ver horarios

**Restricciones**:
- Solo lectura (read-only)
- Acceso temporal
- No puede cambiar nada
- Acceso limitado a datos

**Jerarquía**: Nivel 5 (mínimo)

---

## 📈 Matriz de Comparación de Roles

| Característica | Admin | Soporte | Propietario | Gestor Fin. | Inquilino | Empleado | Proveedor | Visitante |
|----------------|:----:|:-------:|:-----------:|:----------:|:---------:|:-------:|:---------:|:---------:|
| Control Total | ✅ | ❌ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ |
| Múltiples Casas | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| Gestión Usuarios | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprobación Pagos | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver Finanzas | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Crear Empleados | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver Sistema | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Acceso Temporal | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Solo Lectura | ❌ | ❌ | ❌ | ✅ | ❌ | ✅* | ✅* | ✅ |

\* = Con restricciones o condiciones

---

## 🔄 Transiciones de Rol Permitidas

```
Admin puede crear/cambiar a cualquier rol
  ↓
Propietario puede crear:
  - Inquilino (en su casa)
  - Empleado (en su casa)
  - Proveedor (para su casa)
  - Gestor Financiero (para su casa)

Inquilino puede crear:
  - Nada (solo gestión de su perfil)

Empleado/Proveedor puede crear:
  - Nada (solo gestión de su perfil)
```

---

## 💡 Consideraciones de Diseño

### 1. Un Propietario por Casa
- Definición: Típicamente una casa tiene UN propietario principal
- Implicación: Simplifica lógica de aprobación
- Alternativa: Permitir múltiples propietarios (más complejo)

### 2. Empleados y Proveedores
- Empleados: Típicamente a largo plazo (jardinero, portero)
- Proveedores: Típicamente a corto plazo (mantenimiento, reparación)
- Control: El propietario decide quién puede trabajar en su casa

### 3. Acceso Contextual
- Un usuario con rol X en casa A puede tener rol Y en casa B
- Ej: Juan es propietario en casa A, pero inquilino en casa B
- Requiere sistema flexible de asignación usuario→casa→rol

### 4. Expiración de Acceso
- Empleados/Proveedores deberían tener fecha de vencimiento
- Acceso automático revocado después de la fecha
- Reasignación manual si se necesita extender

### 5. Delegación de Responsabilidades
- Propietario puede delegar funciones financieras a Gestor Financiero
- Reduce carga del propietario
- Mantiene control

---

## 🎓 Ejemplos de Casos de Uso

### Caso 1: Familia Viviendo Juntos
```
Propietario: María (dueña de la casa)
Inquilinos: Juan (marido), Diego (hijo)
Empleado: Carlos (jardinero, 2 veces por semana)
```

### Caso 2: Edificio de Departamentos
```
Propietario: Empresa XYZ
Inquilinos: 20+ residentes (1 por depto)
Empleados: Portero, Conserje, Mantenimiento
Proveedores: Gasfiter (por demanda), Electricista (por demanda)
```

### Caso 3: Propietario Múltiple
```
Propietario: Roberto (dueño de 3 casas)
  → Casa A: Gestor Financiero (Patricia) + 4 inquilinos + 1 empleado
  → Casa B: Gestor Financiero (Patricia) + 2 inquilinos
  → Casa C: Sin gestor + 3 inquilinos + 2 empleados
```

---

## 📝 Próximos Pasos

1. Validar roles con requisitos del negocio
2. Confirmar jerarquía propuesta
3. Revisar [03-DATA-ARCHITECTURE.md](./03-DATA-ARCHITECTURE.md) para estructura de datos
4. Revisar [06-PERMISSION-MATRIX.md](./06-PERMISSION-MATRIX.md) para permisos específicos

---

**Archivo**: `docs/auth/design/02-PRIVILEGE-HIERARCHY.md`
**Actualizado**: 2025-01-11
**Estado**: Propuesta - Pendiente validación
