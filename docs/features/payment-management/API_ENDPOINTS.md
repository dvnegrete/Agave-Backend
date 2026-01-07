# Payment Management API Endpoints

Documentación completa de todos los endpoints disponibles en el feature de Payment Management.

## Base URL

```
GET https://api.agave-backend.local/api/payment-management
```

## Tabla de Contenidos

1. [Períodos](#períodos)
2. [Configuración](#configuración)
3. [Pagos y Historial](#pagos-e-historial)
4. [Saldo de Casas](#saldo-de-casas)

---

## Períodos

### GET /periods

Obtiene todos los períodos de facturación registrados.

**Descripción**: Retorna una lista de todos los períodos con sus configuraciones asociadas.

**Parámetros**:
- Ninguno

**Response (200 OK)**:

```json
[
  {
    "id": 1,
    "year": 2024,
    "month": 11,
    "start_date": "2024-11-01",
    "end_date": "2024-11-30",
    "period_config_id": 1,
    "display_name": "Noviembre 2024",
    "created_at": "2024-11-01T00:00:00Z",
    "updated_at": "2024-11-01T00:00:00Z"
  },
  {
    "id": 2,
    "year": 2024,
    "month": 12,
    "start_date": "2024-12-01",
    "end_date": "2024-12-31",
    "period_config_id": 1,
    "display_name": "Diciembre 2024",
    "created_at": "2024-12-01T00:00:00Z",
    "updated_at": "2024-12-01T00:00:00Z"
  }
]
```

**Swagger**: Disponible en `/api/docs#/Payment%20Management/GET%20periods`

---

### POST /periods

Crea un nuevo período de facturación manualmente.

**Descripción**: Crea un nuevo período con una configuración específica. Retorna error si el período ya existe.

**Request Body**:

```json
{
  "year": 2025,
  "month": 1,
  "period_config_id": 1
}
```

**Request Parameters**:

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `year` | integer | Sí | Año del período (ej: 2025) |
| `month` | integer | Sí | Mes del período (1-12) |
| `period_config_id` | integer | Sí | ID de la configuración a usar |

**Response (201 Created)**:

```json
{
  "id": 3,
  "year": 2025,
  "month": 1,
  "start_date": "2025-01-01",
  "end_date": "2025-01-31",
  "period_config_id": 1,
  "display_name": "Enero 2025",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

**Errores**:

| Código | Descripción |
|--------|-------------|
| 400 | El período ya existe o datos inválidos |
| 404 | Configuración no encontrada |

**Swagger**: Disponible en `/api/docs#/Payment%20Management/POST%20periods`

---

### POST /periods/ensure

Asegura la existencia de un período (crea si no existe).

**Descripción**: Endpoint especial para el sistema de conciliación bancaria. Si el período existe, lo retorna. Si no existe, busca la configuración activa y lo crea automáticamente.

**Request Body**:

```json
{
  "year": 2024,
  "month": 11
}
```

**Response (200 OK)**:

```json
{
  "id": 1,
  "year": 2024,
  "month": 11,
  "start_date": "2024-11-01",
  "end_date": "2024-11-30",
  "period_config_id": 1,
  "display_name": "Noviembre 2024",
  "created_at": "2024-11-01T00:00:00Z",
  "updated_at": "2024-11-01T00:00:00Z"
}
```

**Errores**:

| Código | Descripción |
|--------|-------------|
| 404 | No hay configuración activa para la fecha |

**Swagger**: Disponible en `/api/docs#/Payment%20Management/POST%20periods%2Fensure`

**Nota**: Este endpoint es utilizado internamente por el módulo de conciliación bancaria.

---

## Configuración

### POST /config

Crea una nueva configuración de período.

**Descripción**: Crea una nueva configuración de montos default y reglas de pago. Permite versionado de configuraciones con vigencia por fechas.

**Request Body**:

```json
{
  "default_maintenance_amount": 100000,
  "default_water_amount": 50000,
  "default_extraordinary_fee_amount": 25000,
  "payment_due_day": 10,
  "late_payment_penalty_amount": 5000,
  "effective_from": "2024-01-01",
  "effective_until": null,
  "is_active": true
}
```

**Request Parameters**:

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `default_maintenance_amount` | float | Sí | Monto mensual de mantenimiento |
| `default_water_amount` | float | No | Monto mensual de agua |
| `default_extraordinary_fee_amount` | float | No | Monto de cuota extraordinaria |
| `payment_due_day` | integer | Sí | Día límite de pago (1-31) |
| `late_payment_penalty_amount` | float | Sí | Monto de penalidad por atraso |
| `effective_from` | date | Sí | Fecha desde la cual aplica (YYYY-MM-DD) |
| `effective_until` | date | No | Fecha hasta la cual aplica (null = indefinido) |
| `is_active` | boolean | Sí | Si está activa esta configuración |

**Response (201 Created)**:

```json
{
  "id": 1,
  "default_maintenance_amount": 100000,
  "default_water_amount": 50000,
  "default_extraordinary_fee_amount": 25000,
  "payment_due_day": 10,
  "late_payment_penalty_amount": 5000,
  "effective_from": "2024-01-01",
  "effective_until": null,
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Errores**:

| Código | Descripción |
|--------|-------------|
| 400 | Montos negativos o payment_due_day inválido |

**Swagger**: Disponible en `/api/docs#/Payment%20Management/POST%20config`

---

## Pagos e Historial

### GET /houses/{houseId}/payments

Obtiene el historial completo de pagos de una casa, incluyendo vouchers no conciliados.

**Descripción**: Retorna todos los pagos realizados por una casa con detalles de distribución entre conceptos. También incluye vouchers que no han sido conciliados con transacciones bancarias.

**Path Parameters**:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `houseId` | integer | ID de la casa (ej: 42) |

**Response (200 OK)**:

```json
{
  "house_id": 42,
  "house_number": 42,
  "total_payments": 3,
  "total_paid": 250000,
  "total_expected": 250000,
  "payments": [
    {
      "id": 1,
      "record_id": 1,
      "house_id": 42,
      "concept_type": "MAINTENANCE",
      "concept_id": 1,
      "allocated_amount": 100000,
      "expected_amount": 100000,
      "payment_status": "COMPLETE",
      "difference": 0,
      "period_year": 2024,
      "period_month": 11,
      "payment_date": "2024-11-15T10:30:00Z"
    },
    {
      "id": 2,
      "record_id": 1,
      "house_id": 42,
      "concept_type": "WATER",
      "concept_id": 2,
      "allocated_amount": 50000,
      "expected_amount": 50000,
      "payment_status": "COMPLETE",
      "difference": 0,
      "period_year": 2024,
      "period_month": 11,
      "payment_date": "2024-11-15T10:30:00Z"
    },
    {
      "id": 3,
      "record_id": 2,
      "house_id": 42,
      "concept_type": "MAINTENANCE",
      "concept_id": 1,
      "allocated_amount": 100000,
      "expected_amount": 100000,
      "payment_status": "COMPLETE",
      "difference": 0,
      "period_year": 2024,
      "period_month": 12,
      "payment_date": "2024-12-10T14:20:00Z"
    }
  ],
  "unreconciled_vouchers": {
    "total_count": 2,
    "vouchers": [
      {
        "id": 1,
        "date": "2024-12-14T10:15:00Z",
        "amount": 300.00,
        "confirmation_status": false,
        "confirmation_code": "202412-ABC123",
        "created_at": "2024-12-14T10:20:00Z"
      },
      {
        "id": 2,
        "date": "2024-12-20T14:30:00Z",
        "amount": 450.50,
        "confirmation_status": false,
        "confirmation_code": "202412-DEF456",
        "created_at": "2024-12-20T14:35:00Z"
      }
    ]
  }
}
```

**Response Fields - Pagos**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID del registro de asignación |
| `record_id` | integer | ID del record de transacción |
| `house_id` | integer | ID de la casa |
| `concept_type` | string | Tipo de concepto (MAINTENANCE, WATER, EXTRAORDINARY_FEE) |
| `concept_id` | integer | ID del concepto específico |
| `allocated_amount` | float | Monto asignado |
| `expected_amount` | float | Monto esperado |
| `payment_status` | string | Estado del pago (COMPLETE, PARTIAL, OVERPAID) |
| `difference` | float | Diferencia entre pagado y esperado |
| `period_year` | integer | Año del período |
| `period_month` | integer | Mes del período |
| `payment_date` | datetime | Fecha del pago |

**Response Fields - Vouchers No Conciliados**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID del voucher |
| `date` | datetime | Fecha del voucher |
| `amount` | float | Monto del voucher |
| `confirmation_status` | boolean | Estado de confirmación |
| `confirmation_code` | string \| null | Código de confirmación único (ej: 202412-ABC123) |
| `created_at` | datetime | Fecha de creación del voucher |

**Errores**:

| Código | Descripción |
|--------|-------------|
| 404 | Casa no encontrada |

**Swagger**: Disponible en `/api/docs#/Payment%20Management/GET%20houses%2F%7BhouseId%7D%2Fpayments`

---

### GET /houses/{houseId}/payments/{periodId}

Obtiene los pagos de una casa en un período específico.

**Descripción**: Retorna los pagos realizados en un período determinado con detalles de distribución.

**Path Parameters**:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `houseId` | integer | ID de la casa (ej: 42) |
| `periodId` | integer | ID del período (ej: 1) |

**Response (200 OK)**:

```json
{
  "house_id": 42,
  "house_number": 42,
  "total_payments": 2,
  "total_paid": 150000,
  "total_expected": 150000,
  "payments": [
    {
      "id": 1,
      "record_id": 1,
      "house_id": 42,
      "concept_type": "MAINTENANCE",
      "concept_id": 1,
      "allocated_amount": 100000,
      "expected_amount": 100000,
      "payment_status": "COMPLETE",
      "difference": 0,
      "period_year": 2024,
      "period_month": 11,
      "payment_date": "2024-11-15T10:30:00Z"
    },
    {
      "id": 2,
      "record_id": 1,
      "house_id": 42,
      "concept_type": "WATER",
      "concept_id": 2,
      "allocated_amount": 50000,
      "expected_amount": 50000,
      "payment_status": "COMPLETE",
      "difference": 0,
      "period_year": 2024,
      "period_month": 11,
      "payment_date": "2024-11-15T10:30:00Z"
    }
  ]
}
```

**Errores**:

| Código | Descripción |
|--------|-------------|
| 404 | Casa no encontrada |

**Swagger**: Disponible en `/api/docs#/Payment%20Management/GET%20houses%2F%7BhouseId%7D%2Fpayments%2F%7BperiodId%7D`

---

## Saldo de Casas

### GET /houses/{houseId}/balance

Obtiene el saldo actual de una casa.

**Descripción**: Retorna el estado financiero actual (deuda, crédito, centavos acumulados) de una casa.

**Path Parameters**:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `houseId` | integer | ID de la casa (ej: 42) |

**Response (200 OK)**:

```json
{
  "house_id": 42,
  "house_number": 42,
  "accumulated_cents": 0.75,
  "credit_balance": 0,
  "debit_balance": 150000,
  "net_balance": -150000,
  "status": "in-debt",
  "updated_at": "2024-11-20T15:45:00Z"
}
```

**Response Fields**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `house_id` | integer | ID de la casa |
| `house_number` | integer | Número de la casa |
| `accumulated_cents` | float | Centavos acumulados (0.00-0.99) |
| `credit_balance` | float | Saldo a favor |
| `debit_balance` | float | Deuda acumulada |
| `net_balance` | float | Saldo neto (credit - debit) |
| `status` | string | Estado: `balanced`, `credited`, `in-debt` |
| `updated_at` | datetime | Última actualización |

**Estados de Balance**:

| Estado | Descripción |
|--------|-------------|
| `balanced` | Sin deuda ni crédito (debit = 0, credit = 0) |
| `credited` | Tiene crédito a su favor (credit > 0, debit = 0) |
| `in-debt` | Tiene deuda (debit > 0, independiente de credit) |

**Errores**:

| Código | Descripción |
|--------|-------------|
| 404 | Casa no encontrada |

**Swagger**: Disponible en `/api/docs#/Payment%20Management/GET%20houses%2F%7BhouseId%7D%2Fbalance`

---

## Ejemplos de Uso cURL

### Crear un nuevo período

```bash
curl -X POST http://localhost:3000/api/payment-management/periods \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 1,
    "period_config_id": 1
  }'
```

### Asegurar período (para conciliación)

```bash
curl -X POST http://localhost:3000/api/payment-management/periods/ensure \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2024,
    "month": 11
  }'
```

### Obtener historial de pagos

```bash
curl -X GET http://localhost:3000/api/payment-management/houses/42/payments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Obtener saldo de casa

```bash
curl -X GET http://localhost:3000/api/payment-management/houses/42/balance \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Crear configuración

```bash
curl -X POST http://localhost:3000/api/payment-management/config \
  -H "Content-Type: application/json" \
  -d '{
    "default_maintenance_amount": 100000,
    "default_water_amount": 50000,
    "default_extraordinary_fee_amount": 25000,
    "payment_due_day": 10,
    "late_payment_penalty_amount": 5000,
    "effective_from": "2024-01-01",
    "effective_until": null,
    "is_active": true
  }'
```

---

## Acceso a Swagger UI

Para visualizar e interactuar con todos los endpoints:

```
http://localhost:3000/api/docs
```

Los endpoints de Payment Management están agrupados bajo la etiqueta **"Payment Management"**.

---

## Notas de Implementación

### Estados de Pago

Los pagos se registran con los siguientes estados:
- `COMPLETE`: Monto pagado = Monto esperado
- `PARTIAL`: Monto pagado < Monto esperado
- `OVERPAID`: Monto pagado > Monto esperado

### Centavos Acumulados

- Se acumulan automáticamente con cada pago
- Rango: 0.00 a 0.99
- Cuando exceden 1.00, se aplican automáticamente al siguiente período

### Distribución de Conceptos

Los pagos se distribuyen en el siguiente orden de prioridad:
1. Mantenimiento (maintenance)
2. Agua (water)
3. Cuota extraordinaria (extraordinary_fee)

El monto restante se aplica como crédito a favor.

---

**Última actualización**: Enero 7, 2026
**Versión de API**: v1
**Status**: En producción

### Cambios Recientes (Enero 2026)

✨ **Nuevo**: Endpoint `/payment-management/houses/{houseId}/payments` ahora incluye:
- Campo `unreconciled_vouchers` con lista de vouchers sin conciliar
- Campo `confirmation_code` en cada voucher para trazabilidad
- Integración automática con Bank Reconciliation

✨ **Nuevo**: Endpoints adicionales para consultas de pago:
- `GET /payment-management/houses/{houseId}/balance` - Saldo actual
- `GET /payment-management/houses/{houseId}/payments/{periodId}` - Pagos por período
