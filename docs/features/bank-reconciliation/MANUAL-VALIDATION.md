# 🔍 Manual Validation - Validación Manual

## ¿Qué es?

Cuando el sistema encuentra **múltiples vouchers con similitud muy cercana** (diferencia < 5%), escala la decisión a un operador humano en lugar de hacer una conciliación automática incorrecta.

**Ejemplo**:
```
Transacción: $1500.15 el 2025-01-15 10:00

Voucher A: $1500.15 el 2025-01-15 10:15 → Similitud: 0.99
Voucher B: $1500.15 el 2025-01-15 10:45 → Similitud: 0.98

Diferencia: 0.01 (1%) < 5% → REQUIERE VALIDACIÓN MANUAL
```

---

## 🔄 Flujo de Validación Manual

### 1. **Pendiente**: Sistema detecta casos ambiguos
```
validation_status = 'requires-manual'
metadata.possibleMatches = [candidatos]
```

### 2. **Listar**: Operador ve casos pendientes
```bash
GET /bank-reconciliation/manual-validation/pending
```

Respuesta:
```json
{
  "totalCount": 5,
  "page": 1,
  "items": [
    {
      "transactionBankId": "TX-001",
      "transactionAmount": 1500.15,
      "possibleMatches": [
        {
          "voucherId": 101,
          "similarity": 0.99,
          "dateDifferenceHours": 0.25
        },
        {
          "voucherId": 102,
          "similarity": 0.98,
          "dateDifferenceHours": 0.75
        }
      ]
    }
  ]
}
```

### 3. **Decidir**: Operador elige opción o rechaza
```bash
# Opción A: Aprobar (elegir un voucher)
POST /bank-reconciliation/manual-validation/TX-001/approve
{
  "voucherId": 101,
  "approverNotes": "Voucher correcto, primera coincidencia"
}

# Opción B: Rechazar (ninguno es válido)
POST /bank-reconciliation/manual-validation/TX-001/reject
{
  "rejectionReason": "Ningún voucher coincide",
  "notes": "Contactar al residente"
}
```

### 4. **Auditado**: Se registra decisión en auditoría
```sql
-- manual_validation_approvals (ÚNICA FUENTE DE VERDAD)
{
  "transaction_id": "TX-001",
  "voucher_id": 101,
  "approved_by_user_id": "user-123",
  "approval_notes": "Voucher correcto, primera coincidencia",
  "approved_at": "2025-01-15T10:30:00Z"
}
```

---

## 📊 Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/manual-validation/pending` | Listar casos pendientes con filtros |
| `POST` | `/manual-validation/:transactionId/approve` | Aprobar caso |
| `POST` | `/manual-validation/:transactionId/reject` | Rechazar caso |
| `GET` | `/manual-validation/stats` | Estadísticas de validación manual |

### Filtros de búsqueda
```bash
GET /bank-reconciliation/manual-validation/pending?
  startDate=2025-01-01&
  endDate=2025-01-31&
  houseNumber=15&
  page=1&
  limit=20&
  sortBy=similarity  # date|similarity|candidates
```

---

## 🗄️ Auditoría (3NF Normalizada)

Todos los datos de validación manual se almacenan **ÚNICAMENTE** en la tabla `manual_validation_approvals`:

```sql
CREATE TABLE manual_validation_approvals (
  id serial PRIMARY KEY,
  transaction_id varchar NOT NULL,      -- Qué transacción
  voucher_id int,                       -- Qué voucher (NULL = rechazado)
  approved_by_user_id uuid NOT NULL,    -- Quién decidió
  approval_notes text,                  -- Por qué aprobó
  rejection_reason text,                -- Por qué rechazó
  approved_at timestamptz NOT NULL      -- Cuándo decidió
);
```

**Ventajas**:
- ✅ Single source of truth
- ✅ Historial completo
- ✅ Sin redundancias (3NF)

---

## ⚙️ Configuración

```typescript
// src/features/bank-reconciliation/config/reconciliation.config.ts

export const ReconciliationConfig = {
  SIMILARITY_THRESHOLD: 0.05,           // 5% máxima diferencia
  ENABLE_MANUAL_VALIDATION: true,       // Activar/desactivar feature
};
```

---

## 📈 Estadísticas

```bash
GET /bank-reconciliation/manual-validation/stats
```

Respuesta:
```json
{
  "totalPending": 15,
  "totalApproved": 127,
  "totalRejected": 8,
  "approvalRate": 0.94,
  "avgApprovalTimeMinutes": 125,
  "distributionByHouseRange": {
    "1-10": 5,
    "11-20": 4,
    "21-30": 2
  }
}
```

---

## ✅ Ejemplo Completo

```bash
# 1. Ejecutar conciliación
POST /bank-reconciliation/reconcile
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31"
}

# Respuesta incluye: "requiresManualValidation": [...]

# 2. Listar casos manuales
GET /bank-reconciliation/manual-validation/pending
  ?page=1&limit=10&sortBy=similarity

# 3. Revisar casos
# (Operador revisa los candidatos en la UI)

# 4. Aprobar caso
POST /bank-reconciliation/manual-validation/TX-001/approve
{
  "voucherId": 101,
  "approverNotes": "OK"
}

# 5. Verificar auditoría
SELECT * FROM manual_validation_approvals
WHERE transaction_id = 'TX-001';
```

---

**Versión**: 1.0.0
**Última actualización**: Noviembre 2025
**Estado**: ✅ Production Ready
