# Matriz Completa de Permisos por Rol

## 📊 Matriz General

| Permiso | Admin | Soporte | Propietario | Gest. Fin. | Inquilino | Empleado | Proveedor | Visitante |
|---------|:-----:|:-------:|:-----------:|:----------:|:---------:|:-------:|:---------:|:---------:|
| **USUARIOS** |
| view_all_users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| create_user | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| update_user | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| delete_user | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| change_user_role | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | | | | | | | | |
| **CASAS/PROPIEDADES** |
| view_all_houses | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| view_own_houses | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| create_house | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| update_house | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| delete_house | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | | | | | | | | |
| **PAGOS** |
| view_all_payments | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| view_own_payments | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| create_payment | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| update_payment | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| delete_payment | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| approve_payment | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | | | | | | | | |
| **REPORTES** |
| view_system_reports | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| view_house_reports | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| export_reports | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | | | | | | | | |
| **EMPLEADOS/CONTRATISTAS** |
| view_contractors | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| create_contractor | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| update_contractor | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| delete_contractor | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| approve_contractor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | | | | | | | | |
| **TRANSACCIONES BANCARIAS** |
| view_bank_transactions | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| upload_bank_statement | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| reconcile_transactions | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| | | | | | | | | |
| **COMPROBANTES/VOUCHERS** |
| view_vouchers | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| upload_voucher | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| approve_voucher | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| delete_voucher | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| | | | | | | | | |
| **AUDITORIA/SISTEMA** |
| view_audit_logs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| view_system_stats | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| configure_system | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| manage_roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| manage_permissions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📋 Permisos por Recurso (Desglose Detallado)

### 📁 USUARIOS

```typescript
enum UserPermissions {
  // Lectura
  VIEW_ALL_USERS = 'users:view_all',
  VIEW_OWN_PROFILE = 'users:view_own',
  VIEW_HOUSE_USERS = 'users:view_house',

  // Creación
  CREATE_USER = 'users:create',
  INVITE_USER = 'users:invite',

  // Actualización
  UPDATE_OWN_PROFILE = 'users:update_own',
  UPDATE_HOUSE_USERS = 'users:update_house',
  UPDATE_ANY_USER = 'users:update_any',

  // Eliminación
  DELETE_USER = 'users:delete',

  // Roles
  ASSIGN_ROLE = 'users:assign_role',
  CHANGE_ROLE = 'users:change_role',
}

// Por rol
ADMIN: [VIEW_ALL_USERS, CREATE_USER, UPDATE_ANY_USER, DELETE_USER, ASSIGN_ROLE]
PROPIETARIO: [VIEW_HOUSE_USERS, INVITE_USER, UPDATE_HOUSE_USERS]
INQUILINO: [VIEW_OWN_PROFILE, UPDATE_OWN_PROFILE]
VISITANTE: [VIEW_OWN_PROFILE]
```

---

### 🏠 CASAS/PROPIEDADES

```typescript
enum HousePermissions {
  // Lectura
  VIEW_ALL_HOUSES = 'houses:view_all',
  VIEW_OWN_HOUSES = 'houses:view_own',
  VIEW_HOUSE_DETAILS = 'houses:view_details',

  // Creación
  CREATE_HOUSE = 'houses:create',

  // Actualización
  UPDATE_HOUSE = 'houses:update',

  // Eliminación
  DELETE_HOUSE = 'houses:delete',
}

// Por rol
ADMIN: [VIEW_ALL_HOUSES, CREATE_HOUSE, UPDATE_HOUSE, DELETE_HOUSE]
PROPIETARIO: [VIEW_OWN_HOUSES, VIEW_HOUSE_DETAILS, UPDATE_HOUSE]
INQUILINO: [VIEW_HOUSE_DETAILS] // Solo su casa
EMPLEADO: [VIEW_HOUSE_DETAILS] // Solo la casa donde trabaja
VISITANTE: [VIEW_HOUSE_DETAILS] // Solo la casa designada
```

---

### 💰 PAGOS

```typescript
enum PaymentPermissions {
  // Lectura
  VIEW_ALL_PAYMENTS = 'payments:view_all',
  VIEW_OWN_PAYMENTS = 'payments:view_own',
  VIEW_HOUSE_PAYMENTS = 'payments:view_house',

  // Creación
  CREATE_PAYMENT = 'payments:create',
  RECORD_PAYMENT = 'payments:record',

  // Actualización
  UPDATE_PAYMENT = 'payments:update',
  EDIT_PAYMENT = 'payments:edit',

  // Eliminación
  DELETE_PAYMENT = 'payments:delete',

  // Aprobación
  APPROVE_PAYMENT = 'payments:approve',
  REJECT_PAYMENT = 'payments:reject',

  // Validación
  VALIDATE_PAYMENT = 'payments:validate',
}

// Por rol
ADMIN: [VIEW_ALL_PAYMENTS, CREATE_PAYMENT, UPDATE_PAYMENT, DELETE_PAYMENT, APPROVE_PAYMENT]
PROPIETARIO: [VIEW_HOUSE_PAYMENTS, CREATE_PAYMENT, APPROVE_PAYMENT]
GESTOR_FINANCIERO: [VIEW_HOUSE_PAYMENTS, APPROVE_PAYMENT] // Solo lectura + aprobación
INQUILINO: [VIEW_OWN_PAYMENTS] // Solo ve su deuda
EMPLEADO: [] // No ve pagos
```

---

### 📊 REPORTES

```typescript
enum ReportPermissions {
  // Lectura
  VIEW_SYSTEM_REPORTS = 'reports:view_system',
  VIEW_HOUSE_REPORTS = 'reports:view_house',
  VIEW_OWN_REPORTS = 'reports:view_own',

  // Generación
  GENERATE_PAYMENT_REPORT = 'reports:generate_payment',
  GENERATE_FINANCIAL_REPORT = 'reports:generate_financial',
  GENERATE_SYSTEM_REPORT = 'reports:generate_system',

  // Exportación
  EXPORT_REPORTS = 'reports:export',
  EXPORT_TO_PDF = 'reports:export_pdf',
  EXPORT_TO_EXCEL = 'reports:export_excel',
}

// Por rol
ADMIN: [VIEW_SYSTEM_REPORTS, GENERATE_SYSTEM_REPORT, EXPORT_REPORTS]
PROPIETARIO: [VIEW_HOUSE_REPORTS, GENERATE_PAYMENT_REPORT, EXPORT_REPORTS]
GESTOR_FINANCIERO: [VIEW_HOUSE_REPORTS, GENERATE_FINANCIAL_REPORT, EXPORT_REPORTS]
INQUILINO: [VIEW_OWN_REPORTS] // Reportes de su deuda
```

---

### 👥 EMPLEADOS/CONTRATISTAS

```typescript
enum ContractorPermissions {
  // Lectura
  VIEW_ALL_CONTRACTORS = 'contractors:view_all',
  VIEW_OWN_CONTRACTORS = 'contractors:view_own',
  VIEW_CONTRACTOR_DETAILS = 'contractors:view_details',

  // Creación
  CREATE_CONTRACTOR = 'contractors:create',
  INVITE_CONTRACTOR = 'contractors:invite',

  // Actualización
  UPDATE_CONTRACTOR = 'contractors:update',
  EDIT_SERVICES = 'contractors:edit_services',

  // Eliminación
  DELETE_CONTRACTOR = 'contractors:delete',
  REVOKE_CONTRACTOR = 'contractors:revoke',

  // Aprobación
  APPROVE_CONTRACTOR = 'contractors:approve',
  VERIFY_CONTRACTOR = 'contractors:verify',
}

// Por rol
ADMIN: [VIEW_ALL_CONTRACTORS, APPROVE_CONTRACTOR, VERIFY_CONTRACTOR]
PROPIETARIO: [VIEW_OWN_CONTRACTORS, CREATE_CONTRACTOR, UPDATE_CONTRACTOR]
EMPLEADO: [VIEW_CONTRACTOR_DETAILS] // Ve otros empleados/proveedores
```

---

### 🏦 TRANSACCIONES BANCARIAS

```typescript
enum BankPermissions {
  // Lectura
  VIEW_BANK_TRANSACTIONS = 'bank:view_transactions',
  VIEW_STATEMENT = 'bank:view_statement',

  // Operaciones
  UPLOAD_STATEMENT = 'bank:upload_statement',
  RECONCILE_TRANSACTIONS = 'bank:reconcile',
  MATCH_TRANSACTION = 'bank:match_transaction',

  // Reportes
  VIEW_RECONCILIATION_REPORT = 'bank:view_report',
}

// Por rol
ADMIN: [VIEW_BANK_TRANSACTIONS, UPLOAD_STATEMENT, RECONCILE_TRANSACTIONS]
PROPIETARIO: [VIEW_BANK_TRANSACTIONS, UPLOAD_STATEMENT, RECONCILE_TRANSACTIONS]
GESTOR_FINANCIERO: [VIEW_BANK_TRANSACTIONS, RECONCILE_TRANSACTIONS]
```

---

### 📄 COMPROBANTES/VOUCHERS

```typescript
enum VoucherPermissions {
  // Lectura
  VIEW_ALL_VOUCHERS = 'vouchers:view_all',
  VIEW_OWN_VOUCHERS = 'vouchers:view_own',

  // Operaciones
  UPLOAD_VOUCHER = 'vouchers:upload',
  PROCESS_VOUCHER = 'vouchers:process',

  // Aprobación
  APPROVE_VOUCHER = 'vouchers:approve',
  REJECT_VOUCHER = 'vouchers:reject',

  // Eliminación
  DELETE_VOUCHER = 'vouchers:delete',
}

// Por rol
ADMIN: [VIEW_ALL_VOUCHERS, APPROVE_VOUCHER, DELETE_VOUCHER]
PROPIETARIO: [VIEW_OWN_VOUCHERS, APPROVE_VOUCHER]
PROVEEDOR: [UPLOAD_VOUCHER] // Sube sus comprobantes
```

---

### 🔐 AUDITORIA/SISTEMA

```typescript
enum AuditPermissions {
  // Auditoría
  VIEW_AUDIT_LOGS = 'audit:view_logs',
  VIEW_USER_ACTIVITY = 'audit:view_activity',
  VIEW_CHANGE_HISTORY = 'audit:view_history',

  // Estadísticas
  VIEW_SYSTEM_STATS = 'audit:view_stats',
  VIEW_USAGE_METRICS = 'audit:view_metrics',

  // Configuración
  CONFIGURE_SYSTEM = 'system:configure',
  MANAGE_ROLES = 'system:manage_roles',
  MANAGE_PERMISSIONS = 'system:manage_permissions',
  MANAGE_SETTINGS = 'system:manage_settings',
}

// Por rol
ADMIN: [All audit permissions]
SOPORTE_TECNICO: [VIEW_AUDIT_LOGS, VIEW_USER_ACTIVITY, VIEW_SYSTEM_STATS]
```

---

## 🎯 Estrategia de Verificación

### 1. En Controladores (Decorador simple)

```typescript
@Get('payments')
@UseGuards(AuthGuard)
@RequirePermissions('payments:view_own')
getPayments(@CurrentUser() user: User) {
  // User tiene permiso
}
```

### 2. Con Contexto (Guard avanzado)

```typescript
@Get('houses/:houseId/payments')
@UseGuards(AuthGuard, ContextGuard)
@RequirePermissions('payments:view_house')
getHousePayments(
  @Param('houseId') houseId: string,
  @CurrentUser() user: User
) {
  // Guard verifica:
  // 1. User tiene permiso 'payments:view_house'
  // 2. User tiene acceso a esa house específica
}
```

### 3. En Servicios (Programático)

```typescript
async getPayments(userId: string) {
  const user = await this.userService.getUser(userId);

  // Verificar permisos
  if (!this.permissionService.hasPermission(user.id, 'payments:view_all')) {
    if (!this.permissionService.hasPermission(user.id, 'payments:view_own')) {
      throw new ForbiddenException('No tienes acceso a pagos');
    }
    // Solo puede ver sus pagos
    return this.paymentRepository.findByUserId(userId);
  }

  // Puede ver todos
  return this.paymentRepository.find();
}
```

---

## 📝 Próximos Pasos

1. Validar matriz con equipo de negocio
2. Revisar [05-COMPONENTS.md](../architecture/05-COMPONENTS.md)
3. Implementar PermissionService
4. Crear Guards personalizados

---

**Archivo**: `docs/auth/design/06-PERMISSION-MATRIX.md`
**Actualizado**: 2025-01-11
**Estado**: Propuesta - Pendiente validación de negocio
