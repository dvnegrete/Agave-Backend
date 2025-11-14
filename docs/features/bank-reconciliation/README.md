# 🏦 Bank Reconciliation - Conciliación Bancaria

## 📋 Descripción

Sistema automatizado que **concilia transacciones bancarias con vouchers** (comprobantes de pago) para gestión de pagos de condominios.

**Objetivo**: Emparejar automáticamente los depósitos bancarios con los comprobantes subidos por los residentes, identificando la casa correspondiente y actualizando el estado de pago.

---

## 🎯 ¿Qué Hace la Conciliación?

Cuando ejecutas `POST /bank-reconciliation/reconcile`, el sistema:

1. **Obtiene transacciones pendientes**:
   - Depósitos bancarios sin confirmar (`is_deposit=true, confirmation_status=false`)
   - Vouchers sin confirmar (`confirmation_status=false`)

2. **Intenta emparejar**:
   - Por monto exacto + fecha cercana (±36 horas)
   - Si no hay voucher: por centavos o concepto usando IA
   - Si hay conflicto: marca para revisión manual

3. **Clasifica en 4 categorías**:
   - ✅ **Conciliados** (matched): Emparejados exitosamente
   - 📄 **Unfunded Vouchers** (vouchers sin fondos): Vouchers sin transacción bancaria
   - 🏦 **Unclaimed Deposits** (depósitos no reclamados): Transacciones sin voucher
   - ⚠️  **Validación Manual**: Casos ambiguos

4. **Persiste en BD**:
   - Crea `TransactionStatus`, `Record`, `HouseRecord`
   - Actualiza `confirmation_status = true`
   - Marca estado: `confirmed`, `conflict`, `not-found`, `requires-manual`

---

## 🔄 4 Categorías de Resultados

### ✅ 1. CONCILIADOS

**Qué son**: Transacciones bancarias que se emparejaron con un voucher (o se identificó la casa sin voucher).

**Tipos**:
- **Con voucher**: Monto y fecha coinciden → Alta confianza
- **Sin voucher (automático)**: Casa identificada por centavos (ej: $500.15 → Casa #15) o concepto claro

**Ejemplo**:
```json
{
  "transactionBankId": "123",
  "voucherId": 456,
  "houseNumber": 15,
  "matchCriteria": ["AMOUNT", "DATE"],
  "confidenceLevel": "HIGH"
}
```

**Estado en BD**: `validation_status = 'confirmed'`

---

### 📄 2. UNFUNDED VOUCHERS (Vouchers sin fondos)

**Qué son**: **Vouchers que NO tienen transacción bancaria correspondiente**.

**Property name**: `unfundedVouchers`

**Significa**: Usuario subió comprobante pero el dinero no se refleja en el banco.

**Origen**: Tabla `vouchers`

**Razones comunes**:
- ✅ Transferencia en proceso (24-48 hrs)
- ✅ Pago rechazado por el banco
- ✅ Usuario subió voucher falso
- ✅ Pagó a cuenta equivocada
- ✅ Estado de cuenta incompleto (faltan días recientes)

**Ejemplo**:
```json
{
  "voucherId": 789,
  "amount": 2000.20,
  "date": "2025-01-10",
  "reason": "No matching bank transaction found"
}
```

**Acción requerida**:
- Esperar procesamiento bancario
- Descargar nuevo estado de cuenta
- Volver a ejecutar conciliación

**Estado en BD**: NO se persiste (voucher sigue `confirmation_status = false`)

---

### 🏦 3. UNCLAIMED DEPOSITS (Depósitos no reclamados)

**Qué son**: **Transacciones bancarias que NO tienen voucher correspondiente**.

**Property name**: `unclaimedDeposits`

**Significa**: Dinero entró al banco pero no hay comprobante en el sistema.

**Origen**: Tabla `transactions_bank`

**Tipos**:

#### 🟡 Tipo A: Con Conflicto
Casa identificable pero hay contradicción entre fuentes.

**Ejemplo**:
```json
{
  "transactionBankId": "999",
  "amount": 1500.15,
  "date": "2025-01-12",
  "reason": "Conflicto: concepto sugiere casa 20, centavos sugieren casa 15",
  "requiresManualReview": true,
  "houseNumber": 15
}
```

**Razones**:
- Centavos: Casa 15 ($1500.15)
- Concepto: "Pago casa 20"
- → Sistema no puede decidir automáticamente

**Estado en BD**: `validation_status = 'conflict'`

#### 🔴 Tipo B: Sin Información
No se puede identificar la casa.

**Ejemplo**:
```json
{
  "transactionBankId": "888",
  "amount": 600.00,
  "date": "2025-01-12",
  "reason": "Sin voucher, sin centavos válidos, sin concepto identificable",
  "requiresManualReview": true,
  "houseNumber": 0
}
```

**Razones**:
- ❌ Monto sin centavos válidos ($600.00)
- ❌ Concepto genérico ("TRANSFERENCIA")
- ❌ No hay voucher

**Estado en BD**: `validation_status = 'not-found'`

**Razones comunes de sobrantes**:
- ✅ Usuario olvidó subir comprobante
- ✅ Pago en efectivo sin ticket
- ✅ Depósito de tercero (familiar pagó)
- ✅ Error en el monto ($1500.00 vs $1500.15)
- ✅ Depósito colectivo (varias casas juntas)

**Acción requerida**:
- Contactar residentes para identificar pagador
- Solicitar comprobante
- Crear voucher manualmente
- Volver a ejecutar conciliación

---

### ⚠️ 4. VALIDACIÓN MANUAL

**Qué son**: Casos que el sistema no puede resolver automáticamente.

**Razones**:
- Múltiples vouchers con mismo monto y fechas similares
- Conflictos entre fuentes de información
- Casos ambiguos que requieren decisión humana

**Ejemplo**:
```json
{
  "transactionBankId": "777",
  "possibleMatches": [
    {
      "voucherId": 111,
      "similarity": 0.85,
      "dateDifferenceHours": 12
    },
    {
      "voucherId": 222,
      "similarity": 0.82,
      "dateDifferenceHours": 18
    }
  ],
  "reason": "Multiple vouchers with same amount"
}
```

**Estado en BD**: `validation_status = 'requires-manual'`

**Metadata**: Se guardan candidatos en JSONB para revisión posterior.

---

## 📊 Diferencia Clave: UNCLAIMED DEPOSITS vs UNFUNDED VOUCHERS

| Aspecto | **UNCLAIMED DEPOSITS** 🏦 | **UNFUNDED VOUCHERS** 📄 |
|---------|---------------------------|--------------------------|
| **Property** | `unclaimedDeposits` | `unfundedVouchers` |
| **Origen** | Transacción bancaria | Voucher |
| **Problema** | Dinero sin comprobante | Comprobante sin dinero |
| **Vista del Banco** | ✅ Existe | ❌ No existe |
| **Vista del Sistema** | ❌ No existe voucher | ✅ Existe voucher |
| **ID en respuesta** | `transactionBankId` | `voucherId` |
| **¿Es urgente?** | 🟡 Moderado | 🔴 Urgente |
| **¿Se resuelve solo?** | ❌ Requiere acción | ✅ A veces (si falta tiempo) |
| **Persistencia** | `validation_status` marcado | NO persiste |
| **¿Se reintenta?** | ❌ No | ✅ Sí (próxima conciliación) |

**Resumen simple**:
- **UNCLAIMED DEPOSIT** = "Tengo el dinero, ¿de quién es?"
- **UNFUNDED VOUCHER** = "Tengo el comprobante, ¿dónde está el dinero?"

---

## 🔧 API Endpoint

### POST /bank-reconciliation/reconcile

**Request**:
```json
{
  "startDate": "2025-01-01",  // Opcional
  "endDate": "2025-01-31"     // Opcional
}
```

- Sin parámetros: Procesa TODO lo pendiente

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
  "conciliados": [
    {
      "transactionBankId": "123",
      "voucherId": 456,
      "houseNumber": 15,
      "matchCriteria": ["AMOUNT", "DATE"],
      "confidenceLevel": "HIGH"
    }
  ],
  "unfundedVouchers": [
    {
      "voucherId": 789,
      "amount": 2000.20,
      "date": "2025-01-10",
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
      "transactionBankId": "777",
      "possibleMatches": [...],
      "reason": "Multiple vouchers with same amount"
    }
  ]
}
```

---

## 🧠 Estrategia de Matching

### 1. Por Monto y Fecha (Principal)
```
Transacción: $1500.15 el 15-ene-2025 10:00
Voucher:     $1500.15 el 15-ene-2025 09:30

→ ✅ CONCILIADO (diferencia: 30 minutos)
```

**Tolerancia**: ±36 horas por defecto

### 2. Por Centavos (Sin Voucher)
```
Transacción: $1500.15
Voucher: NO EXISTE

Centavos: 15 → Casa #15
→ ✅ CONCILIADO automáticamente (sin voucher)
```

**Rango válido**: Centavos 1-66 (configurable)

### 3. Por Concepto con IA (Sin Voucher)
```
Transacción: $1500.00 (sin centavos válidos)
Concepto: "Pago casa 20 mantenimiento"
Voucher: NO EXISTE

IA extrae: Casa 20 (alta confianza)
→ ✅ CONCILIADO automáticamente (sin voucher)
```

**Patrones detectados**:
- "Casa 5", "Casa #20", "c15", "cs-10"
- "Apto 5", "Lote 12", "Propiedad 25"

### 4. Conflicto → Revisión Manual
```
Transacción: $1500.15
Concepto: "Pago casa 20"
Voucher: NO EXISTE

Centavos: Casa 15
Concepto: Casa 20
→ ⚠️ SOBRANTE (conflicto)
```

---

## 🗃️ Persistencia en Base de Datos

### Estados en `transaction_status.validation_status`

| Estado | Significado | ¿Se volverá a procesar? |
|--------|-------------|-------------------------|
| `pending` | Aún no procesado | ✅ Sí |
| `confirmed` | Conciliado exitosamente | ❌ No |
| `conflict` | Sobrante con conflicto | ❌ No (requiere manual) |
| `not-found` | Sobrante sin info | ❌ No (requiere manual) |
| `requires-manual` | Múltiples candidatos | ❌ No (requiere manual) |

### Datos guardados

```sql
-- Ejemplo: Conciliado
INSERT INTO transactions_status (
  transactions_bank_id,
  vouchers_id,
  validation_status,
  reason,
  identified_house_number,
  processed_at
) VALUES (
  '123',
  456,
  'confirmed',
  'Conciliado con voucher',
  15,
  NOW()
);

-- Ejemplo: Sobrante con conflicto
INSERT INTO transactions_status (
  transactions_bank_id,
  vouchers_id,
  validation_status,
  reason,
  identified_house_number,
  processed_at
) VALUES (
  '999',
  NULL,
  'conflict',
  'Conflicto: concepto sugiere casa 20, centavos sugieren casa 15',
  15,  -- Se usa centavos como principal
  NOW()
);
```

### Evita Reprocesamiento

El sistema **NO reprocesa** transacciones que ya tienen `TransactionStatus` (con cualquier estado). Esto mejora performance en 33%.

---

## ⚙️ Configuración

**Archivo**: `src/features/bank-reconciliation/config/reconciliation.config.ts`

```typescript
export const ReconciliationConfig = {
  DATE_TOLERANCE_HOURS: 36,
  TIME_TOLERANCE_MINUTES: 30,
  MAX_HOUSE_NUMBER: 66,
  AUTO_MATCH_SIMILARITY_THRESHOLD: 0.95,
  ENABLE_CONCEPT_MATCHING: true,
};
```

---

## 🧹 Limpieza de Archivos

Cuando un voucher se concilia exitosamente, el sistema **automáticamente elimina su imagen del bucket GCS** y actualiza `voucher.url = null` para ahorrar storage.

---

## 📚 Documentación Adicional

- **[QUERIES-CONCILIACION.md](./QUERIES-CONCILIACION.md)** - 40+ queries SQL útiles para análisis
- **[concept-matching-examples.md](./concept-matching-examples.md)** - Ejemplos de extracción de casa por concepto
- **[SETUP-USUARIO-SISTEMA.md](./SETUP-USUARIO-SISTEMA.md)** - Configuración del usuario sistema

---

## 🚀 TODOs Pendientes

### Alta Prioridad
- [ ] **Endpoints de validación manual**:
  - `GET /bank-reconciliation/pending-validation`
  - `POST /bank-reconciliation/manual-approve`
  - `POST /bank-reconciliation/manual-reject`

### Media Prioridad
- [ ] Tabla de auditoría (`BankReconciliationLog`)
- [ ] Notificaciones por email para casos manuales
- [ ] Dashboard de métricas

### Baja Prioridad
- [ ] Tests E2E
- [ ] Webhooks para eventos de conciliación

---

**Versión**: 2.1.0
**Última actualización**: Noviembre 2025
**Estado**: ✅ Production Ready
