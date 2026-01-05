# 🏦 Unclaimed Deposits - Depósitos No Reclamados

## ¿Qué son?

Depósitos **válidos** que aparecen en el estado de cuenta bancario pero **no pudieron conciliarse automáticamente** por falta de información para identificar la casa correspondiente.

**IMPORTANTE**: Estos depósitos **SIEMPRE aparecerán en reportes financieros** de ingresos/egresos, sin importar su estado. Solo se asignan a casas cuando se resuelve manualmente.

---

## 📊 Estados Posibles

### 🟡 CONFLICT (Conflicto)
**Casa identificable pero con información contradictoria**

```
Transacción: $1500.15
Centavos: 15 → Casa #15
Concepto: "Pago casa 20"
→ CONFLICTO: ¿Casa 15 o 20?
```

**Persistencia en BD:**
```sql
transaction_status {
  validation_status: 'conflict',
  identified_house_number: 15,  -- Sugerencia (centavos)
  reason: 'Conflicto: concepto sugiere casa 20, centavos sugieren casa 15'
}
```

### 🔴 NOT_FOUND (No Encontrado)
**Sin información para identificar casa**

```
Transacción: $2600.00
Centavos: 00 (no válidos)
Concepto: "TRANSFERENCIA" (genérico)
→ SIN INFORMACIÓN
```

**Persistencia en BD:**
```sql
transaction_status {
  validation_status: 'not-found',
  identified_house_number: NULL,
  reason: 'Sin voucher, sin centavos válidos, sin concepto identificable'
}
```

---

## 📡 Endpoints

### 1. GET /bank-reconciliation/unclaimed-deposits

**Propósito**: Listar todos los depósitos no reclamados

**Query params:**
```bash
GET /bank-reconciliation/unclaimed-deposits?
  startDate=2025-01-01&         # Opcional
  endDate=2025-01-31&           # Opcional
  validationStatus=all&         # 'conflict' | 'not-found' | 'all'
  houseNumber=15&               # Filtrar por casa sugerida (opcional)
  page=1&                        # Página (default: 1)
  limit=20&                      # Registros por página (default: 20)
  sortBy=date                    # 'date' | 'amount'
```

**Response:**
```json
{
  "totalCount": 3,
  "page": 1,
  "limit": 20,
  "totalPages": 1,
  "items": [
    {
      "transactionBankId": "TX-12345",
      "amount": 1500.15,
      "date": "2025-01-15T10:00:00Z",
      "concept": "Pago casa 20",
      "validationStatus": "conflict",
      "reason": "Conflicto: concepto sugiere casa 20, centavos sugieren casa 15",
      "suggestedHouseNumber": 15,    // De los centavos
      "conceptHouseNumber": 20,      // De análisis IA/regex
      "processedAt": "2025-01-15T10:05:00Z"
    },
    {
      "transactionBankId": "TX-12346",
      "amount": 2600.00,
      "date": "2025-01-16T14:30:00Z",
      "concept": "DEPOSITO",
      "validationStatus": "not-found",
      "reason": "Sin voucher, sin centavos válidos, sin concepto identificable",
      "suggestedHouseNumber": null,
      "conceptHouseNumber": null,
      "processedAt": "2025-01-16T14:35:00Z"
    }
  ]
}
```

**Filtros útiles:**

```bash
# Solo conflictos
GET /unclaimed-deposits?validationStatus=conflict

# Solo no-encontrados
GET /unclaimed-deposits?validationStatus=not-found

# Por rango de fechas
GET /unclaimed-deposits?startDate=2025-01-01&endDate=2025-01-31

# Por casa (centavos)
GET /unclaimed-deposits?houseNumber=15

# Ordenar por monto (mayor primero)
GET /unclaimed-deposits?sortBy=amount

# Paginación
GET /unclaimed-deposits?page=2&limit=50
```

---

### 2. POST /bank-reconciliation/unclaimed-deposits/:transactionId/assign-house

**Propósito**: Asignar manualmente una casa a un depósito no reclamado

**Path param:**
- `transactionId`: ID de la transacción bancaria (ej: TX-12345)

**Request body:**
```json
{
  "houseNumber": 15,
  "adminNotes": "Casa 15 confirmada por el residente mediante llamada telefónica"
}
```

**Validaciones:**
- `houseNumber` debe estar entre 1-66
- Transacción debe existir y tener estado `conflict` o `not-found`
- Casa debe existir (si no existe, se crea automáticamente)

**Response:**
```json
{
  "message": "Depósito asignado exitosamente a casa 15",
  "reconciliation": {
    "transactionBankId": "TX-12345",
    "houseNumber": 15,
    "status": "confirmed",
    "paymentAllocation": {
      "total_distributed": 1500.00,
      "allocations": [
        {
          "conceptType": "maintenance",
          "allocatedAmount": 1500.00,
          "paymentStatus": "complete"
        }
      ]
    }
  },
  "assignedAt": "2025-01-15T11:30:00Z"
}
```

**Errores posibles:**
```json
{
  "statusCode": 400,
  "message": "Número de casa inválido: 70. Debe estar entre 1 y 66"
}

{
  "statusCode": 404,
  "message": "Depósito no reclamado no encontrado: TX-12345"
}
```

---

## 🔄 Flujo Completo de Asignación

### 1. Listar depósitos no reclamados
```bash
curl -X GET "http://localhost:3000/bank-reconciliation/unclaimed-deposits?validationStatus=all"
```

### 2. Revisar depósito específico
```json
{
  "transactionBankId": "TX-12345",
  "amount": 1500.15,
  "concept": "Pago casa 20",
  "validationStatus": "conflict",
  "suggestedHouseNumber": 15,
  "conceptHouseNumber": 20
}
```

### 3. Investigar (contactar al residente, revisar voucher, etc.)
```
Opción A: Centavos dicen casa 15 → Probablemente error de digitación en concepto
Opción B: Concepto dice casa 20 → Probablemente error en centavos
```

### 4. Asignar casa
```bash
curl -X POST "http://localhost:3000/bank-reconciliation/unclaimed-deposits/TX-12345/assign-house" \
  -H "Content-Type: application/json" \
  -d '{
    "houseNumber": 15,
    "adminNotes": "Centavos confirmados. Concepto tenía error de digitación."
  }'
```

### 5. Sistema ejecuta automáticamente:
```
✅ Valida transacción existe y estado es válido
✅ Valida número de casa (1-66)
✅ Busca/crea casa (con usuario Sistema si no existe)
✅ Actualiza transaction_status → CONFIRMED
✅ Actualiza transactions_bank.confirmation_status → true
✅ Crea Record (sin voucher, solo transaction_status_id)
✅ Crea HouseRecord (vincula casa-record)
✅ Registra auditoría en manual_validation_approvals
✅ Ejecuta AllocatePaymentUseCase (asigna a conceptos automáticamente)
```

### 6. Resultado en BD:
```sql
-- TransactionStatus cambió a confirmed
SELECT * FROM transaction_status
WHERE transactions_bank_id = 'TX-12345';
-- validation_status: 'confirmed'
-- identified_house_number: 15

-- Auditoría registrada
SELECT * FROM manual_validation_approvals
WHERE transaction_id = 'TX-12345';
-- Quién asignó, cuándo, por qué

-- Pago distribuido a conceptos
SELECT * FROM record_allocations
WHERE record_id = (SELECT id FROM records WHERE transaction_status_id = ...);
-- Maintenance: $1500, status: complete
```

---

## 📋 Estados en la Base de Datos

| Estado | Descripción | Asignado? | En Reportes? |
|--------|-------------|-----------|-------------|
| `conflict` | Información contradictoria | ❌ No | ✅ Sí |
| `not-found` | Sin información | ❌ No | ✅ Sí |
| `confirmed` | Asignado a casa | ✅ Sí | ✅ Sí |

**Importante**: Todos aparecen en reportes financieros, sin importar el estado.

---

## 💡 Casos de Uso Comunes

### Caso 1: Centavos Claros, Concepto Equivocado
```
Transacción: $2500.15
Centavos: 15 → Casa #15 ✅
Concepto: "Pago casa 20" ❌

Acción: Asignar a casa 15
Nota: "Concepto tiene error de digitación"
```

### Caso 2: Sin Centavos, Concepto Claro
```
Transacción: $3000.00
Centavos: 00 → No válido
Concepto: "Pago casa 35 mantenimiento" ✅

Acción: Asignar a casa 35
Nota: "Concepto claro, sin centavos"
```

### Caso 3: Conflicto Total
```
Transacción: $1800.20
Centavos: 20 → Casa #20
Concepto: "Pago casa 15" ❌

Acción: Investigar
- Contactar residente
- Revisar si hay voucher
- Decidir la casa correcta
```

### Caso 4: Sin Información
```
Transacción: $4500.00
Centavos: 00 → No válido
Concepto: "TRANSFERENCIA" ❌

Acción: Contactar residente
- Solicitar comprobante de transferencia
- Confirmar monto y fecha
- Crear voucher o nota en sistema
```

---

## 🔍 Monitoreo y Auditoría

### Ver quién asignó cada depósito:
```sql
SELECT
  mva.transaction_id,
  tb.amount,
  tb.date,
  ts.identified_house_number,
  mva.approved_by_user_id,
  mva.approval_notes,
  mva.approved_at
FROM manual_validation_approvals mva
JOIN transactions_bank tb ON tb.id = mva.transaction_id
LEFT JOIN transaction_status ts ON ts.transactions_bank_id = tb.id
WHERE mva.voucher_id IS NULL  -- Sin voucher = depósito no reclamado
ORDER BY mva.approved_at DESC;
```

### Ver depósitos no reclamados pendientes:
```sql
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.validation_status,
  ts.identified_house_number,
  ts.reason,
  DATEDIFF(NOW(), ts.processed_at) as dias_pendiente
FROM transactions_bank tb
JOIN transaction_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('conflict', 'not-found')
ORDER BY ts.processed_at ASC;  -- Más antiguos primero
```

---

## ⚠️ Consideraciones Importantes

1. **Todos los depósitos aparecen en reportes**
   - El estado (conflict/not-found/confirmed) es solo para seguimiento interno
   - No excluyes depósitos de reportes financieros

2. **Auditoría completa**
   - Cada asignación queda registrada en `manual_validation_approvals`
   - Se sabe quién, cuándo y por qué

3. **Asignación automática de pagos**
   - Al asignar casa, el pago se distribuye automáticamente a conceptos
   - Se crea `record_allocations` con detalles

4. **Creación automática de casas**
   - Si la casa no existe, se crea automáticamente
   - Se asigna al usuario Sistema: `00000000-0000-0000-0000-000000000000`

5. **Sin reversión directa**
   - No hay endpoint para "desasignar"
   - Si necesitas cambiar, contacta a administrador (requiere actualización manual en BD)

---

## 📊 Estadísticas Recomendadas

Monitorea estos KPIs:
- **Depósitos pendientes**: Cuántos aún no asignados
- **Tiempo promedio**: Cuánto tarda en asignarse
- **Tasa de conflictos**: Qué % son conflictos vs no-encontrados
- **Montos pendientes**: Cuánto dinero aún sin asignar

---

**Última actualización:** Enero 5, 2026
**Versión:** 1.0.0
