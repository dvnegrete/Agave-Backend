# Bank Reconciliation

Sistema automatizado que concilia transacciones bancarias con vouchers de pago para gestión de condominios.

## Responsabilidades

- Emparejar depósitos bancarios con vouchers subidos por residentes
- Identificar la casa correspondiente usando múltiples estrategias (monto+fecha, centavos, concepto con IA)
- Clasificar transacciones en 4 categorías: conciliadas, vouchers sin fondos, depósitos no reclamados, validación manual
- Persistir resultados en BD actualizando estados y creando registros de pago
- Integrar automáticamente con Payment Management para distribuir pagos entre conceptos

## Flujo Principal

1. **Obtener datos pendientes**: Transacciones bancarias (`is_deposit=true, confirmation_status=false`) y vouchers (`confirmation_status=false`)
2. **Matching**: Emparejar usando estrategias en orden de prioridad
3. **Clasificar**: Organizar resultados en 4 categorías
4. **Persistir**: Guardar en BD con estados correspondientes
5. **Asignar pagos**: Ejecutar automáticamente `AllocatePaymentUseCase` para distribuir a conceptos

## Estrategias de Matching

### 1. Monto Exacto + Fecha Cercana
Prioridad más alta. Compara monto exacto (±$0.01) y fecha dentro de ±36 horas.

**Caso único**: Concilia automáticamente
```
Transacción: $1500.15 el 15-ene 10:00
Voucher:     $1500.15 el 15-ene 09:30
→ CONCILIADO (diferencia: 30 min)
```

**Múltiples candidatos**:
- Si diferencia de similitud < 5% → Validación manual
- Si hay ganador claro → Auto-concilia con el más cercano en fecha

### 2. Centavos (sin voucher)
Identifica casa por centavos. Rango válido: 1-66.

```
Transacción: $1500.15 (sin voucher)
Centavos: 15 → Casa #15
→ CONCILIADO automáticamente
```

**Excepción**: Si hay conflicto con concepto → Depósito no reclamado

### 3. Concepto con IA (sin voucher, sin centavos)
Usa regex + IA (OpenAI/Vertex AI) para extraer número de casa del concepto.

```
Transacción: $1500.00 (sin centavos válidos)
Concepto: "Pago casa 20 mantenimiento"
IA extrae: Casa 20 (alta confianza)
→ CONCILIADO automáticamente
```

**Patrones soportados**: "Casa 5", "c15", "cs-10", "Apto 5", "Lote 12"

### 4. Conflicto → Depósito no reclamado
```
Transacción: $1500.15
Concepto: "Pago casa 20"
Centavos: 15, Concepto: 20
→ DEPÓSITO NO RECLAMADO (conflict)
```

## 4 Categorías de Resultados

### 1. Conciliados (`conciliados`)
Transacciones emparejadas exitosamente con voucher o identificadas sin voucher.

**Con voucher**:
```json
{
  "transactionBankId": "123",
  "voucherId": 456,
  "houseNumber": 15,
  "matchCriteria": ["AMOUNT", "DATE"],
  "confidenceLevel": "HIGH"
}
```

**Sin voucher** (automático):
```json
{
  "transactionBankId": "124",
  "houseNumber": 20,
  "matchCriteria": ["CONCEPT"],
  "confidenceLevel": "MEDIUM"
}
```

**Estado BD**: `validation_status = 'confirmed'`

### 2. Vouchers Sin Fondos (`unfundedVouchers`)
Vouchers que NO tienen transacción bancaria correspondiente. El dinero no se refleja en el banco.

```json
{
  "voucherId": 789,
  "amount": 2000.20,
  "date": "2025-01-10",
  "reason": "No matching bank transaction found"
}
```

**Razones comunes**: Transferencia en proceso (24-48h), pago rechazado, voucher falso, cuenta equivocada

**Estado BD**: No se persiste (voucher sigue `confirmation_status = false`)

**Acción**: Esperar procesamiento bancario, volver a ejecutar conciliación

### 3. Depósitos No Reclamados (`unclaimedDeposits`)
Transacciones bancarias que NO tienen voucher correspondiente. Dinero entró al banco pero no hay comprobante.

**Tipo A: Con conflicto**
```json
{
  "transactionBankId": "999",
  "amount": 1500.15,
  "reason": "Conflicto: concepto sugiere casa 20, centavos sugieren casa 15",
  "requiresManualReview": true,
  "houseNumber": 15
}
```
**Estado BD**: `validation_status = 'conflict'`

**Tipo B: Sin información**
```json
{
  "transactionBankId": "888",
  "amount": 600.00,
  "reason": "Sin voucher, sin centavos válidos, sin concepto identificable",
  "requiresManualReview": true,
  "houseNumber": 0
}
```
**Estado BD**: `validation_status = 'not-found'`

**Razones comunes**: Usuario olvidó subir comprobante, pago en efectivo, depósito de tercero, error en monto

**Acción**: Contactar residentes, solicitar comprobante, asignar casa manualmente

### 4. Validación Manual (`manualValidationRequired`)
Múltiples vouchers con similitud muy cercana (< 5%). Sistema escala a decisión humana.

```json
{
  "transactionBankId": "TX-001",
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
  ],
  "reason": "2 vouchers con monto exacto y similitud muy cercana"
}
```

**Estado BD**: `validation_status = 'requires-manual'`

**Auditoría**: Se registra en `manual_validation_approvals` (única fuente de verdad)

## API Endpoints

### POST /bank-reconciliation/reconcile
Ejecuta proceso de conciliación.

**Request**:
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31"
}
```
Ambos parámetros opcionales. Sin parámetros: procesa TODO lo pendiente.

**Response**:
```json
{
  "summary": {
    "totalProcessed": 100,
    "conciliados": 85,
    "unfundedVouchers": 5,
    "unclaimedDeposits": 8,
    "requiresManualValidation": 2
  },
  "conciliados": [...],
  "unfundedVouchers": [...],
  "unclaimedDeposits": [...],
  "manualValidationRequired": [...]
}
```

### GET /bank-reconciliation/manual-validation/pending
Lista casos que requieren validación manual.

**Query params**:
- `startDate`, `endDate`: Rango de fechas
- `houseNumber`: Filtrar por casa
- `page`, `limit`: Paginación (default: 1, 20)
- `sortBy`: 'date' | 'similarity' | 'candidates'

**Response**:
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
        }
      ],
      "reason": "...",
      "status": "pending"
    }
  ]
}
```

### POST /bank-reconciliation/manual-validation/:transactionId/approve
Aprueba un caso eligiendo uno de los vouchers candidatos.

**Request**:
```json
{
  "voucherId": 101,
  "approverNotes": "Voucher correcto, fecha coincide"
}
```

**Response**:
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

### POST /bank-reconciliation/manual-validation/:transactionId/reject
Rechaza todos los vouchers candidatos.

**Request**:
```json
{
  "rejectionReason": "Ningún voucher coincide",
  "notes": "Contactar al residente"
}
```

### GET /bank-reconciliation/manual-validation/stats
Retorna estadísticas agregadas.

**Response**:
```json
{
  "totalPending": 15,
  "totalApproved": 127,
  "totalRejected": 8,
  "approvalRate": 0.94,
  "avgApprovalTimeMinutes": 125
}
```

### GET /bank-reconciliation/unclaimed-deposits
Lista depósitos no reclamados (estados: conflict, not-found).

**Query params**:
- `startDate`, `endDate`: Rango de fechas
- `validationStatus`: 'conflict' | 'not-found' | 'all'
- `houseNumber`: Filtrar por casa sugerida
- `page`, `limit`: Paginación
- `sortBy`: 'date' | 'amount'

**Response**:
```json
{
  "totalCount": 3,
  "items": [
    {
      "transactionBankId": "TX-12345",
      "amount": 1500.15,
      "validationStatus": "conflict",
      "suggestedHouseNumber": 15,
      "conceptHouseNumber": 20,
      "reason": "Conflicto: concepto sugiere casa 20, centavos sugieren casa 15"
    }
  ]
}
```

### POST /bank-reconciliation/unclaimed-deposits/:transactionId/assign-house
Asigna manualmente una casa a un depósito.

**Request**:
```json
{
  "houseNumber": 15,
  "adminNotes": "Casa 15 confirmada por el residente"
}
```

**Automáticamente**:
- Valida casa (1-66)
- Crea/busca casa (con usuario Sistema si no existe)
- Actualiza estado a `confirmed`
- Crea Record y HouseRecord
- Ejecuta asignación automática de pagos
- Registra auditoría en `manual_validation_approvals`

**Response**:
```json
{
  "message": "Depósito asignado exitosamente a casa 15",
  "reconciliation": {
    "transactionBankId": "TX-12345",
    "houseNumber": 15,
    "status": "confirmed",
    "paymentAllocation": {
      "total_distributed": 1500.00,
      "allocations": [...]
    }
  }
}
```

## Integración con Payment Management

Cada conciliación exitosa ejecuta automáticamente `AllocatePaymentUseCase`:

1. Obtiene/crea período actual (año-mes)
2. Distribuye monto entre conceptos (mantenimiento, agua, cuota extraordinaria)
3. Actualiza `HouseBalance` con acumulación de centavos
4. Crea `RecordAllocation` para trazabilidad

Esto ocurre tanto para:
- Conciliaciones con voucher
- Conciliaciones automáticas sin voucher
- Asignaciones manuales de depósitos no reclamados

## Persistencia en Base de Datos

### Estados en `transaction_status.validation_status`

| Estado | Significado | Se reprocesa? |
|--------|-------------|---------------|
| `pending` | No procesado | Sí |
| `confirmed` | Conciliado exitosamente | No |
| `conflict` | Conflicto entre fuentes | No (requiere manual) |
| `not-found` | Sin información | No (requiere manual) |
| `requires-manual` | Múltiples candidatos | No (requiere manual) |

### Auditoría de Decisiones Manuales

Tabla `manual_validation_approvals` (única fuente de verdad):
- `transaction_id`: Qué transacción
- `voucher_id`: Qué voucher (NULL = rechazado/depósito sin voucher)
- `approved_by_user_id`: Quién decidió
- `approval_notes`: Por qué aprobó
- `rejection_reason`: Por qué rechazó
- `approved_at`: Cuándo decidió

### Evita Reprocesamiento

El sistema NO reprocesa transacciones que ya tienen `TransactionStatus` (con cualquier estado).

## Configuración

Archivo: `src/features/bank-reconciliation/config/reconciliation.config.ts`

```typescript
export const ReconciliationConfig = {
  DATE_TOLERANCE_HOURS: 36,              // Tolerancia de fecha/hora
  AUTO_MATCH_SIMILARITY_THRESHOLD: 0.95, // Umbral para match automático
  SIMILARITY_THRESHOLD: 0.05,            // Umbral para validación manual (5%)
  ENABLE_CONCEPT_MATCHING: true,         // Habilita análisis de concepto
  ENABLE_AI_CONCEPT_ANALYSIS: true,      // Usa IA si regex no es concluyente
  ENABLE_MANUAL_VALIDATION: true,        // Habilita validación manual
  MAX_HOUSE_NUMBER: 66,                  // Rango válido de casas
};
```

## Edge Cases

### Múltiples vouchers con mismo monto
Si diferencia de similitud < 5% → Validación manual
Si diferencia > 5% → Auto-concilia con el más cercano en fecha

### Conflicto centavos vs concepto
Centavos sugiere casa 15, concepto sugiere casa 20 → Depósito no reclamado (conflict)

### Monto sin centavos ni concepto
$600.00 sin centavos válidos, concepto genérico → Depósito no reclamado (not-found)

### Casa no existe
Se crea automáticamente con usuario Sistema (`00000000-0000-0000-0000-000000000000`)

**Setup requerido**: Ejecutar una vez antes de usar conciliación:
```sql
INSERT INTO users (id, email) VALUES
('00000000-0000-0000-0000-000000000000', 'sistema@conciliacion.local')
ON CONFLICT (id) DO NOTHING;
```

### Error durante asignación de pagos
La conciliación se completa, pero se loguea error. El registro existe pero falta asignación a conceptos (requiere revisión manual).

## Limpieza de Archivos

Cuando un voucher se concilia exitosamente:
- Se elimina automáticamente su imagen del bucket GCS
- Se actualiza `voucher.url = null` para ahorrar storage

## Dependencias

### Módulos externos
- `OpenAIModule`: Análisis de concepto con IA (prioridad 1)
- `VertexAIModule`: Fallback si OpenAI falla
- `PaymentManagementModule`: Asignación automática de pagos

### Entidades
- `TransactionBank`: Transacciones bancarias
- `Voucher`: Comprobantes de pago
- `TransactionStatus`: Estado de conciliación
- `Record`: Registro de pago
- `HouseRecord`: Asociación casa-registro
- `House`: Casas del condominio

## Workflows Típicos

### Workflow 1: Conciliación Mensual
```bash
# 1. Ejecutar conciliación del mes
POST /bank-reconciliation/reconcile
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31"
}

# 2. Revisar vouchers sin fondos
# (Esperar 24-48h procesamiento bancario)

# 3. Revisar depósitos no reclamados
GET /bank-reconciliation/unclaimed-deposits?validationStatus=all

# 4. Asignar casas manualmente donde sea necesario
POST /bank-reconciliation/unclaimed-deposits/TX-123/assign-house
{
  "houseNumber": 15,
  "adminNotes": "Confirmado por teléfono"
}

# 5. Revisar casos de validación manual
GET /bank-reconciliation/manual-validation/pending

# 6. Aprobar/rechazar casos manuales
POST /bank-reconciliation/manual-validation/TX-456/approve
{
  "voucherId": 101,
  "approverNotes": "Fecha coincide"
}
```

### Workflow 2: Depósito Sin Información
```
Depósito: $2600.00
Centavos: 00 (no válidos)
Concepto: "TRANSFERENCIA"
→ Estado: not-found

1. Contactar residentes para identificar pagador
2. Solicitar comprobante de transferencia
3. Asignar casa manualmente vía endpoint
```

### Workflow 3: Conflicto Centavos-Concepto
```
Depósito: $1500.15
Centavos: 15
Concepto: "Pago casa 20"
→ Estado: conflict

1. Revisar historial de pagos de ambas casas
2. Contactar residente si es necesario
3. Decidir fuente correcta (centavos o concepto)
4. Asignar casa manualmente
```

## Mejores Prácticas

1. **Ejecutar conciliación regularmente**: Semanal o mensualmente
2. **Procesar casos manuales rápido**: Evitar acumulación de decisiones pendientes
3. **Revisar depósitos no reclamados**: Contactar residentes para resolver
4. **Validar estados de cuenta**: Asegurar que están completos antes de conciliar
5. **Monitorear tasa de éxito**: Alto % de conciliados indica buena calidad de datos

## Queries SQL Útiles

### Ver conciliaciones recientes
```sql
SELECT
  validation_status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM transaction_status
WHERE processed_at > NOW() - INTERVAL '1 hour'
GROUP BY validation_status;
```

### Ver depósitos no reclamados pendientes
```sql
SELECT
  tb.id,
  tb.amount,
  tb.date,
  ts.validation_status,
  ts.reason
FROM transactions_bank tb
JOIN transaction_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('conflict', 'not-found');
```

### Ver auditoría de decisiones manuales
```sql
SELECT
  mva.transaction_id,
  tb.amount,
  mva.approved_by_user_id,
  mva.approval_notes,
  mva.approved_at
FROM manual_validation_approvals mva
JOIN transactions_bank tb ON tb.id = mva.transaction_id
ORDER BY mva.approved_at DESC
LIMIT 20;
```

---

**Última actualización**: Enero 2026
**Estado**: Production Ready
