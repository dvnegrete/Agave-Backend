# Bank Reconciliation - Integracion Frontend

Contrato de API para conectar el frontend con los endpoints de conciliacion bancaria.

**Base URL**: `/bank-reconciliation`
**Autenticacion**: Todos los endpoints requieren `AuthGuard` (cookie de sesion o token JWT).

---

## 1. Ejecutar Conciliacion

```
POST /bank-reconciliation/reconcile
```

**Request body** (ambos campos opcionales):
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31"
}
```
Sin body o sin fechas: procesa TODO lo pendiente.

**Response 200**:
```json
{
  "summary": {
    "totalProcessed": 100,
    "conciliados": 85,
    "unfundedVouchers": 5,
    "unclaimedDeposits": 8,
    "requiresManualValidation": 2
  },
  "conciliados": [
    {
      "transactionBankId": "123",
      "voucherId": 456,
      "houseNumber": 15,
      "matchCriteria": ["AMOUNT", "DATE"],
      "confidenceLevel": "HIGH",
      "dateDifferenceHours": 0.5
    }
  ],
  "unfundedVouchers": [
    {
      "voucherId": 789,
      "amount": 2000.20,
      "date": "2025-01-10T09:00:00Z",
      "reason": "No matching bank transaction found"
    }
  ],
  "unclaimedDeposits": [
    {
      "transactionBankId": "999",
      "amount": 1500.15,
      "reason": "Conflicto: concepto sugiere casa 20, centavos sugieren casa 15",
      "requiresManualReview": true,
      "houseNumber": 15
    }
  ],
  "manualValidationRequired": [
    {
      "transactionBankId": "TX-001",
      "possibleMatches": [
        { "voucherId": 101, "similarity": 0.99, "dateDifferenceHours": 0.25 },
        { "voucherId": 102, "similarity": 0.98, "dateDifferenceHours": 0.75 }
      ],
      "reason": "2 vouchers con monto exacto y similitud muy cercana"
    }
  ]
}
```

---

## 2. Validacion Manual

### 2.1 Listar casos pendientes

```
GET /bank-reconciliation/manual-validation/pending
```

**Query params**:

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `startDate` | string (ISO date) | - | Fecha inicial |
| `endDate` | string (ISO date) | - | Fecha final |
| `houseNumber` | number | - | Filtrar por casa (1-66) |
| `page` | number | 1 | Pagina |
| `limit` | number | 20 | Registros por pagina (max 100) |
| `sortBy` | string | `date` | `date` \| `similarity` \| `candidates` |

**Response 200**:
```json
{
  "totalCount": 5,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "items": [
    {
      "transactionBankId": "TX-001",
      "transactionAmount": 1500.15,
      "transactionDate": "2025-01-15T10:00:00Z",
      "transactionConcept": "Pago residencia",
      "possibleMatches": [
        {
          "voucherId": 101,
          "voucherAmount": 1500.15,
          "voucherDate": "2025-01-15T09:00:00Z",
          "houseNumber": 15,
          "similarity": 0.99,
          "dateDifferenceHours": 1.0
        }
      ],
      "reason": "2 vouchers con monto exacto y similitud muy cercana",
      "createdAt": "2025-01-15T10:05:00Z",
      "status": "pending"
    }
  ]
}
```

### 2.2 Aprobar caso

```
POST /bank-reconciliation/manual-validation/:transactionId/approve
```

**Request body**:
```json
{
  "voucherId": 101,
  "approverNotes": "Voucher correcto, fecha coincide"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `voucherId` | number | Si | ID del voucher elegido (de `possibleMatches`) |
| `approverNotes` | string | No | Notas del operador |

**Response 200**:
```json
{
  "message": "Caso aprobado exitosamente",
  "reconciliation": {
    "transactionBankId": "TX-001",
    "voucherId": 101,
    "houseNumber": 15,
    "status": "confirmed"
  },
  "approvedAt": "2025-01-15T11:30:00Z"
}
```

### 2.3 Rechazar caso

```
POST /bank-reconciliation/manual-validation/:transactionId/reject
```

**Request body**:
```json
{
  "rejectionReason": "Ningun voucher coincide",
  "notes": "Contactar al residente"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `rejectionReason` | string | Si | Razon del rechazo |
| `notes` | string | No | Notas adicionales |

**Response 200**:
```json
{
  "message": "Caso rechazado exitosamente",
  "transactionBankId": "TX-001",
  "newStatus": "not-found",
  "rejectedAt": "2025-01-15T11:30:00Z"
}
```

### 2.4 Estadisticas

```
GET /bank-reconciliation/manual-validation/stats
```

**Response 200**:
```json
{
  "totalPending": 15,
  "totalApproved": 127,
  "totalRejected": 8,
  "pendingLast24Hours": 3,
  "approvalRate": 0.94,
  "avgApprovalTimeMinutes": 125,
  "distributionByHouseRange": {
    "1-10": 5,
    "11-20": 4,
    "21-30": 2,
    "31-40": 2,
    "41-66": 2
  }
}
```

---

## 3. Depositos No Reclamados

### 3.1 Listar depositos

```
GET /bank-reconciliation/unclaimed-deposits
```

**Query params**:

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `startDate` | string (ISO date) | - | Fecha inicial |
| `endDate` | string (ISO date) | - | Fecha final |
| `validationStatus` | string | `all` | `conflict` \| `not-found` \| `all` |
| `houseNumber` | number | - | Filtrar por casa sugerida (1-66) |
| `page` | number | 1 | Pagina |
| `limit` | number | 20 | Registros por pagina (max 100) |
| `sortBy` | string | `date` | `date` \| `amount` |

**Response 200**:
```json
{
  "totalCount": 3,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "items": [
    {
      "transactionBankId": "12345",
      "amount": 1500.15,
      "date": "2025-01-15",
      "time": "10:30:00",
      "concept": "Pago casa 20 mantenimiento",
      "validationStatus": "conflict",
      "reason": "Conflicto: concepto sugiere casa 20, centavos sugieren casa 15",
      "suggestedHouseNumber": 15,
      "conceptHouseNumber": 20,
      "processedAt": "2025-01-15T10:05:00Z"
    }
  ]
}
```

### 3.2 Asignar casa a deposito

```
POST /bank-reconciliation/unclaimed-deposits/:transactionId/assign-house
```

**Request body**:
```json
{
  "houseNumber": 15,
  "adminNotes": "Casa 15 confirmada por el residente"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `houseNumber` | number | Si | Numero de casa (1-66) |
| `adminNotes` | string | No | Notas del administrador |

**Response 200**:
```json
{
  "message": "Deposito asignado exitosamente a casa 15",
  "reconciliation": {
    "transactionBankId": "12345",
    "houseNumber": 15,
    "status": "confirmed",
    "paymentAllocation": {
      "total_distributed": 1500.00,
      "allocations": [
        { "conceptType": "maintenance", "allocatedAmount": 1000.00, "paymentStatus": "complete" },
        { "conceptType": "water", "allocatedAmount": 300.00, "paymentStatus": "complete" },
        { "conceptType": "extraordinary", "allocatedAmount": 200.00, "paymentStatus": "complete" }
      ]
    }
  },
  "assignedAt": "2025-01-15T11:30:00Z"
}
```

**Error 400**: `"El deposito {id} ya fue asignado previamente"` (idempotencia)
**Error 404**: `"Transaccion bancaria no encontrada: {id}"`

---

## 4. Vouchers Sin Fondos

### 4.1 Listar vouchers sin fondos

```
GET /bank-reconciliation/unfunded-vouchers
```

**Query params**:

| Param | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `startDate` | string (ISO date) | - | Fecha inicial |
| `endDate` | string (ISO date) | - | Fecha final |
| `page` | number | 1 | Pagina |
| `limit` | number | 20 | Registros por pagina (max 100) |
| `sortBy` | string | `date` | `date` \| `amount` |

**Response 200**:
```json
{
  "totalCount": 5,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "items": [
    {
      "voucherId": 101,
      "amount": 800.00,
      "date": "2025-01-15T13:36:36Z",
      "houseNumber": 15,
      "url": "p-2025-01-15_13-36-36-uuid.jpg"
    }
  ]
}
```

**Notas sobre los campos**:
- `houseNumber`: Extraido del voucher (via records → house_records → house). Puede ser `null` si el voucher no tiene casa asociada.
- `url`: Nombre del archivo en GCS. Puede ser `null`. Para construir la URL completa del comprobante, usar el bucket configurado en el backend.

### 4.2 Conciliar voucher con deposito

```
POST /bank-reconciliation/unfunded-vouchers/:voucherId/match-deposit
```

**URL param**: `voucherId` (number) - ID del voucher

**Request body**:
```json
{
  "transactionBankId": "12345",
  "houseNumber": 15,
  "adminNotes": "Voucher corresponde al deposito segun confirmacion del residente"
}
```

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| `transactionBankId` | string | Si | ID del deposito bancario a vincular |
| `houseNumber` | number | Si | Numero de casa (1-66) |
| `adminNotes` | string | No | Notas del administrador |

**Response 200**:
```json
{
  "message": "Voucher 101 conciliado exitosamente con deposito 12345",
  "reconciliation": {
    "voucherId": 101,
    "transactionBankId": "12345",
    "houseNumber": 15,
    "status": "confirmed"
  },
  "matchedAt": "2025-01-15T11:30:00Z"
}
```

**Error 400**: `"El voucher {id} ya fue conciliado previamente"` (idempotencia)
**Error 400**: `"El deposito {id} ya fue conciliado previamente"` (idempotencia)
**Error 404**: `"Voucher no encontrado: {id}"`
**Error 404**: `"Transaccion bancaria no encontrada: {id}"`

---

## Errores Comunes

Todos los endpoints retornan errores en formato estandar:

```json
{
  "statusCode": 400,
  "message": "Descripcion del error",
  "error": "Bad Request"
}
```

| Codigo | Cuando |
|--------|--------|
| 400 | Validacion de datos (casa fuera de rango, recurso ya procesado) |
| 401 | Sin autenticacion |
| 404 | Recurso no encontrado |

---

## Patron de Paginacion

Todos los endpoints GET con lista usan la misma estructura:

```json
{
  "totalCount": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3,
  "items": [...]
}
```

- `page` comienza en 1
- `limit` maximo 100, default 20
- `totalPages` = ceil(totalCount / limit)

---

## Flujo de UI Sugerido

### Panel de Conciliacion

1. Boton "Ejecutar Conciliacion" → `POST /reconcile`
2. Mostrar resumen con 4 contadores (conciliados, vouchers sin fondos, depositos no reclamados, validacion manual)
3. Cada contador lleva a su seccion correspondiente

### Seccion: Validacion Manual

1. Tabla con `GET /manual-validation/pending`
2. Al hacer clic en un caso, mostrar detalle con lista de `possibleMatches`
3. Cada match muestra: voucherId, monto, fecha, similarity, dateDifferenceHours
4. Boton "Aprobar" (seleccionar 1 voucher) → `POST .../approve`
5. Boton "Rechazar todos" → `POST .../reject`

### Seccion: Depositos No Reclamados

1. Tabla con `GET /unclaimed-deposits`
2. Filtros: fecha, tipo (conflict/not-found), casa sugerida
3. Cada fila muestra: monto, fecha, concepto, casa sugerida (centavos), casa sugerida (concepto), razon
4. Boton "Asignar Casa" → formulario con campo `houseNumber` + `adminNotes` → `POST .../assign-house`

### Seccion: Vouchers Sin Fondos

1. Tabla con `GET /unfunded-vouchers`
2. Filtros: fecha
3. Cada fila muestra: voucherId, monto, fecha, casa (si disponible), link al comprobante (url)
4. Boton "Conciliar con Deposito" → formulario con campos `transactionBankId`, `houseNumber`, `adminNotes` → `POST .../match-deposit`
5. Para `transactionBankId`, considerar un selector que muestre depositos no reclamados disponibles (`GET /unclaimed-deposits`)
