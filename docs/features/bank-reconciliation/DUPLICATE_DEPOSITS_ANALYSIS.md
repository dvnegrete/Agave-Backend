# Análisis Crítico: Duplicación de Depósitos No Reclamados

**Fecha de Análisis:** 2026-02-05
**Estado:** 🔴 CRÍTICO - BLOQUEANTE
**Impacto:** Duplicación de datos en cascada
**Severidad:** ALTA - Afecta reconciliación bancaria, reportes financieros y balances de casas

---

## 1. DESCRIPCIÓN DEL PROBLEMA

### Síntoma Reportado
Al ejecutar `POST /reconcile` y luego `GET /unclaimed-deposits`, se observa **duplicación de registros** que no pudieron asociarse automáticamente. Los mismos depósitos aparecen múltiples veces en la lista.

### Análisis Inicial
El problema no es una duplicación simple en base de datos, sino una **cascada de impacto** que afecta múltiples tablas y servicios cuando se procesan depósitos no reclamados.

---

## 2. ROOT CAUSE: Falta de `confirmation_status` en Depósitos No Reclamados

### Código Problemático

**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`

**Líneas 385-432:** Método `persistSurplus()`

```typescript
async persistSurplus(
  transactionBankId: string,
  surplus: UnclaimedDeposit,
): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ✅ Crea TransactionStatus con estado CONFLICT o NOT_FOUND
    const status = surplus.reason.includes('Conflicto')
      ? ValidationStatus.CONFLICT
      : ValidationStatus.NOT_FOUND;

    await this.transactionStatusRepository.create(
      {
        validation_status: status,
        transactions_bank_id: Number(transactionBankId),
        vouchers_id: null,
        reason: surplus.reason,
        identified_house_number: surplus.houseNumber,
        processed_at: new Date(),
      },
      queryRunner,
    );

    await queryRunner.commitTransaction();
    // ✅ Loguea exitosamente

    // ❌ PROBLEMA: NO EJECUTA updateTransactionBankStatus()
    // ❌ La transacción SIGUE con confirmation_status = false

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

### Comparación con `persistReconciliation()`

**Línea 145** (método que funciona correctamente):

```typescript
async persistReconciliation(
  transactionBankId: string,
  voucher: Voucher | null,
  houseNumber: number,
): Promise<void> {
  // ...

  // ✅ Sí actualiza confirmation_status después de crear TransactionStatus
  await this.updateTransactionBankStatus(transactionBankId, queryRunner);

  // ✅ Transacción marcada como procesada
}
```

### El Método `updateTransactionBankStatus()` (Línea 337-346)

```typescript
private async updateTransactionBankStatus(
  transactionBankId: string,
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.manager.update(
    'transactions_bank',
    { id: transactionBankId },
    { confirmation_status: true },  // ← ESTO FALTA EN persistSurplus()
  );
}
```

---

## 3. CASCADA DE DUPLICACIÓN: Cómo Se Propaga el Error

### Escenario de Reproducción Paso a Paso

#### **Ejecución 1: POST /reconcile** (Primer depósito no reclamado)

```
1. ReconcileUseCase.execute()
   └─ getPendingTransactions()
      ├─ Busca: is_deposit=true, confirmation_status=false
      └─ Encuentra: TX-1000 ($1500, concepto genérico, sin voucher)

2. matchingService.matchTransaction()
   └─ Resultado: SURPLUS (depósito no reclamado)
      ├─ Razón: "Sin voucher, sin centavos válidos"
      └─ Estado: NOT_FOUND

3. persistSurplus(TX-1000, surplus)
   ├─ ✅ Crea: TransactionStatus(id=101, status=NOT_FOUND, tx_id=1000)
   ├─ ❌ NO EJECUTA: updateTransactionBankStatus()
   └─ TX-1000 sigue con: confirmation_status=false

4. GET /unclaimed-deposits
   └─ Retorna: [TX-1000] ✅ (correcto)
```

#### **Ejecución 2: POST /reconcile** (Reprocesamiento)

**Caso 1: Código SIN bug de reprocesamiento**
```
1. getProcessedTransactionIds()
   ├─ Query: SELECT DISTINCT transactions_bank_id FROM transaction_status
   └─ Retorna: {1000} ✅ (TX-1000 está en el set)

2. getPendingTransactions() filtra:
   ✓ is_deposit=true
   ✓ confirmation_status=false  ← TX-1000 SIGUE siendo false
   ✓ !processedTransactionIds.has(1000)  ← ✅ BLOQUEADO AQUÍ

   Resultado: TX-1000 NO se reprocesa ✅ (por el filtro)
```

**Caso 2: Data histórica corrupta**
```
Si en BD hay registros de importación anterior:
   TX-1000 podría tener MÚLTIPLES TransactionStatus:
   ├─ TS-101 (status=NOT_FOUND)
   ├─ TS-102 (status=CONFLICT)  ← DUPLICADO
   └─ TS-103 (status=CONFLICT)  ← DUPLICADO

   Con confirmation_status=false, el sistema detecta "ya procesada"
   Pero /unclaimed-deposits hace LEFT JOIN sin DISTINCT
   → Retorna 3 filas para 1 depósito
```

---

## 4. TABLA DE IMPACTO COMPLETA

### 4.1 Impacto en `/unclaimed-deposits`

**Código en `unclaimed-deposits.service.ts` (línea 73-133):**

```typescript
async getUnclaimedDeposits(...): Promise<UnclaimedDepositsPageDto> {
  let query = this.dataSource
    .getRepository(TransactionBank)
    .createQueryBuilder('tb')
    .leftJoin(TransactionStatus, 'ts',
      'ts.transactions_bank_id = tb.id')  // ← Sin DISTINCT
    .where('tb.is_deposit = :isDeposit', { isDeposit: true })
    // ... más filtros ...

  const totalCount = await query.getCount();  // ← INCORRECTO si hay 3 TS
  const items = await query.skip(offset).take(limit).getRawMany();
  // Si hay 3 TS → retorna 3 filas

  return {
    totalCount,  // ← 3 en lugar de 1
    items,       // ← 3 registros duplicados
  };
}
```

**Resultado:**
```
1 TransactionBank con 3 TransactionStatus
   ↓
LEFT JOIN sin DISTINCT
   ↓
3 filas en el resultado
   ↓
totalCount = 3 (debería ser 1)
   ↓
Usuario ve MISMO DEPÓSITO 3 VECES
```

### 4.2 Impacto en `assignHouseToDeposit()` - Cascada de Creación

**Código en `unclaimed-deposits.service.ts` (línea 158-329):**

```typescript
async assignHouseToDeposit(
  transactionId: string,
  houseNumber: number,
  userId: string,
  adminNotes?: string,
): Promise<AssignHouseResponseDto> {

  // 1. Obtiene TransactionStatus
  const transactionStatuses =
    await this.transactionStatusRepository.findByTransactionBankId(transactionId);
  // ← Retorna array: [TS-101, TS-102, TS-103]

  // 2. Busca la primera que sea CONFLICT o NOT_FOUND
  const transactionStatus = transactionStatuses?.find(
    (ts) =>
      ts.validation_status === ValidationStatus.CONFLICT ||
      ts.validation_status === ValidationStatus.NOT_FOUND,
  );
  // ← Toma SOLO TS-101 (el primero) ✓

  // 3. Crea Record
  const record = await this.recordRepository.create(
    {
      transaction_status_id: transactionStatus.id,  // = 101
    },
    queryRunner,
  );
  // ← Crea Record A para TS-101 ✓

  // 4. Crea HouseRecord
  await this.houseRecordRepository.create(
    {
      house_id: house.id,
      record_id: recordId,  // = Record A
    },
    queryRunner,
  );

  // 5. Ejecuta asignación de pagos
  const allocationResult = await this.allocatePaymentUseCase.execute({
    record_id: recordId,  // = Record A
    amount_to_distribute: transaction.amount,  // = $1500
  });
  // ← Crea 3 RecordAllocations: maintenance, water, fee

  return {...};
}
```

**Problema: Si se llama `assignHouseToDeposit()` múltiples veces**

```
Primera llamada (usuario hace clic en depósito):
├─ transactionStatuses = [TS-101, TS-102, TS-103]
├─ find() retorna TS-101
├─ Crea Record A para TS-101
├─ Crea 3 Allocations: 1000 + 300 + 200 = $1500 ✓
└─ Casa 15: balance = $1500 ✓

Segunda llamada (usuario hace clic nuevamente):
├─ transactionStatuses = [TS-101, TS-102, TS-103]
├─ find() retorna TS-101 OTRA VEZ (ya tiene Record A)
├─ ¿Crea Record B? ← DEPENDE DE LA VALIDACIÓN
├─ Si crea: 3 Allocations NUEVOS
└─ Casa 15: balance = $3000 ❌ TRIPLICADO
```

---

## 5. IMPACTO EN CASCADA: Visualización

```
┌─────────────────────────────────────────────────┐
│ PROBLEMA RAÍZ                                   │
│ ─────────────────────────────────────────────── │
│ persistSurplus() NO actualiza confirmation_status│
│ TX-1000 sigue con: confirmation_status = false  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ PROBLEMA SECUNDARIO (Data Histórica)            │
│ ─────────────────────────────────────────────── │
│ 1 TX-1000 → 3 TransactionStatus registrados     │
│ (por importación anterior o bug histórico)      │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ IMPACTO EN CONSULTAS                            │
│ ─────────────────────────────────────────────── │
│ GET /unclaimed-deposits                         │
│ LEFT JOIN sin DISTINCT                          │
│ ⚠️ Retorna 3 filas para 1 depósito             │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ IMPACTO EN INTERFAZ                             │
│ ─────────────────────────────────────────────── │
│ Usuario ve MISMO DEPÓSITO 3 VECES              │
│ totalCount = 3 (incorrecto)                    │
│ items = 3 duplicados                            │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ IMPACTO EN ASIGNACIÓN                           │
│ ─────────────────────────────────────────────── │
│ Si usuario asigna casa a cada "duplicado"      │
│ assignHouseToDeposit() se ejecuta 3 veces      │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ CASCADA FINAL - BASE DE DATOS                   │
│ ─────────────────────────────────────────────── │
│ 1 TX-1000 ($1500)                              │
│   ├─ 3 TransactionStatus                       │
│   ├─ 3 Records creados                         │
│   ├─ 3 HouseRecords (casa 15)                  │
│   └─ 9 RecordAllocations (3 × 3 conceptos)    │
│                                                 │
│ Casa 15 balance TRIPLICADO: $4500 en lugar $1500│
│ 🔴 CRÍTICO                                      │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ IMPACTO EN REPORTES Y RECONCILIACIÓN            │
│ ─────────────────────────────────────────────── │
│ • Estados de cuenta: montos 3× inflados         │
│ • Reportes financieros: No cierran              │
│ • Reconciliación bancaria: FALLA                │
│ • Auditoría: Pérdida de trazabilidad           │
│ 🔴 CRÍTICO - AFECTA OPERACIÓN COMPLETA         │
└─────────────────────────────────────────────────┘
```

---

## 6. TABLA DE IMPACTO CUANTIFICADO

| Componente | Esperado | Con Bug | Multiplicador | Severidad |
|------------|----------|---------|---|---|
| `transactions_bank` | 1 | 1 | 1× | ✓ OK |
| `transaction_status` | 1 | 3 | 3× | 🟠 Aviso |
| `records` | 1 | 3 | 3× | 🔴 CRÍTICO |
| `house_records` | 1 | 3 | 3× | 🔴 CRÍTICO |
| `record_allocations` | 3 | 9 | 3× | 🔴 CRÍTICO |
| Casa balance | $1500 | $4500 | 3× | 🔴 **CRÍTICO** |
| Reportes mensuales | $1500 | $4500 | 3× | 🔴 **CRÍTICO** |
| Reconciliación BD-Banco | ✓ Cierra | ✗ Falla | N/A | 🔴 **BLOQUEANTE** |

---

## 7. ÁREAS DE RIESGO ADICIONALES

### 7.1 Manual Validation Service
**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/manual-validation.service.ts`

**Riesgo:** Si hay múltiples TransactionStatus con estado `REQUIRES_MANUAL`, el servicio de validación manual podría:
- Crear múltiples Records
- Generar múltiples allocations
- Duplicar auditoría en `manual_validation_approvals`

### 7.2 Historical Records Processor
**Archivo:** `src/features/historical-records/infrastructure/processors/historical-row-processor.service.ts`

**Riesgo:** Si importa datos históricos sin validación de duplicados, podría perpetuar el problema:
```sql
-- Importación sin deduplicación
INSERT INTO transaction_status
SELECT ... FROM external_source
-- Resultado: Múltiples TS para la misma TX
```

### 7.3 Report Generation
**Impacto:** Cualquier query que sume montos sin `DISTINCT`:

```sql
-- ❌ INCORRECTO (duplica montos):
SELECT SUM(ra.allocated_amount)
FROM records r
JOIN record_allocations ra ON ra.record_id = r.id
WHERE r.id IN (SELECT record_id FROM house_records WHERE house_id = 15)
-- Si hay 3 Records del mismo TX → suma 3 veces

-- ✅ CORRECTO (con deduplicación):
SELECT SUM(DISTINCT r.amount)
FROM records r
WHERE r.transaction_status_id IN (
  SELECT id FROM transaction_status
  WHERE transactions_bank_id = 1000
)
```

### 7.4 Payment Management Integration
**Riesgo:** `AllocatePaymentUseCase` se ejecuta 3 veces:
```
1ª ejecución: Casa 15 recibe $1500 en 3 conceptos ✓
2ª ejecución: Casa 15 recibe OTROS $1500 en 3 conceptos ✗
3ª ejecución: Casa 15 recibe OTROS $1500 en 3 conceptos ✗
Resultado: Casa 15 tiene $4500 distribuidos en 9 allocations ✗
```

### 7.5 House Balance Accuracy
**Entidad:** `HouseBalance`

```sql
-- Query peligrosa sin DISTINCT:
SELECT
  h.id,
  SUM(ra.allocated_amount) as total_balance
FROM houses h
JOIN house_records hr ON hr.house_id = h.id
JOIN records r ON r.id = hr.record_id
JOIN record_allocations ra ON ra.record_id = r.id
-- Retorna balance TRIPLICADO si hay 3 Records del mismo TX
```

---

## 8. QUERIES SQL PARA AUDITORÍA

### 8.1 Detectar TransactionStatus Duplicados

```sql
-- Encontrar TX con múltiples TransactionStatus
SELECT
  transactions_bank_id,
  COUNT(*) as ts_count,
  ARRAY_AGG(id ORDER BY id) as ts_ids,
  ARRAY_AGG(validation_status) as statuses
FROM transaction_status
GROUP BY transactions_bank_id
HAVING COUNT(*) > 1
ORDER BY ts_count DESC;
```

### 8.2 Detectar Records Duplicados para Mismo TX

```sql
-- Encontrar Records duplicados para la misma transacción
SELECT
  ts.transactions_bank_id,
  COUNT(DISTINCT r.id) as record_count,
  ARRAY_AGG(DISTINCT r.id) as record_ids
FROM transaction_status ts
JOIN records r ON r.transaction_status_id = ts.id
GROUP BY ts.transactions_bank_id
HAVING COUNT(DISTINCT r.id) > 1
ORDER BY record_count DESC;
```

### 8.3 Detectar Allocation Duplicados

```sql
-- Encontrar allocations triplicados
SELECT
  ts.transactions_bank_id,
  COUNT(*) as allocation_count,
  SUM(ra.allocated_amount) as total_allocated,
  COUNT(DISTINCT r.id) as unique_records
FROM transaction_status ts
JOIN records r ON r.transaction_status_id = ts.id
JOIN record_allocations ra ON ra.record_id = r.id
GROUP BY ts.transactions_bank_id
HAVING COUNT(*) > 3;
```

### 8.4 Detectar Casas con Balance Inflado

```sql
-- Casas cuyo balance parece 3× inflado
SELECT
  h.number_house,
  COUNT(hr.id) as house_record_count,
  SUM(DISTINCT tb.amount) as tx_sum,
  SUM(ra.allocated_amount) as allocated_sum,
  ROUND((SUM(ra.allocated_amount) / NULLIF(SUM(DISTINCT tb.amount), 0))::NUMERIC, 2) as ratio
FROM houses h
JOIN house_records hr ON hr.house_id = h.id
JOIN records r ON r.id = hr.record_id
JOIN record_allocations ra ON ra.record_id = r.id
LEFT JOIN transaction_status ts ON ts.id = r.transaction_status_id
LEFT JOIN transactions_bank tb ON tb.id = ts.transactions_bank_id
GROUP BY h.id, h.number_house
HAVING SUM(ra.allocated_amount) > 2 * SUM(DISTINCT tb.amount)
ORDER BY ratio DESC;
```

### 8.5 Verificar confirmation_status en Depósitos No Reclamados

```sql
-- TX con estado CONFLICT/NOT_FOUND pero confirmation_status aún false
SELECT
  tb.id,
  tb.amount,
  tb.confirmation_status,
  ts.validation_status,
  ts.reason,
  COUNT(ts.id) over (partition by tb.id) as ts_count
FROM transactions_bank tb
LEFT JOIN transaction_status ts ON ts.transactions_bank_id = tb.id
WHERE ts.validation_status IN ('conflict', 'not-found')
  AND tb.confirmation_status = false
ORDER BY tb.id;
```

---

## 9. SOLUCIONES RECOMENDADAS

### 9.1 INMEDIATO (Preventivo - Sprint Actual)

#### Solución 1: Actualizar `confirmation_status` en `persistSurplus()`

**Archivo:** `reconciliation-persistence.service.ts`

**Cambio (Línea 385-432):**

```typescript
async persistSurplus(
  transactionBankId: string,
  surplus: UnclaimedDeposit,
): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const status = surplus.reason.includes('Conflicto')
      ? ValidationStatus.CONFLICT
      : ValidationStatus.NOT_FOUND;

    await this.transactionStatusRepository.create(
      {
        validation_status: status,
        transactions_bank_id: Number(transactionBankId),
        vouchers_id: null,
        reason: surplus.reason,
        identified_house_number: surplus.houseNumber,
        processed_at: new Date(),
      },
      queryRunner,
    );

    // ✅ NUEVO: Actualizar confirmation_status
    await this.updateTransactionBankStatus(transactionBankId, queryRunner);

    await queryRunner.commitTransaction();
    this.logger.log(
      `Sobrante persistido: Transaction ${transactionBankId}, Status: ${status}`,
    );
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

#### Solución 2: Agregar DISTINCT en `/unclaimed-deposits`

**Archivo:** `unclaimed-deposits.service.ts`

**Cambio (Línea 73-89):**

```typescript
async getUnclaimedDeposits(...): Promise<UnclaimedDepositsPageDto> {
  let query = this.dataSource
    .getRepository(TransactionBank)
    .createQueryBuilder('tb')
    .leftJoin(TransactionStatus, 'ts', 'ts.transactions_bank_id = tb.id')
    .distinctOn(['tb.id'])  // ✅ NUEVO: Asegurar 1 fila por TX
    .where('tb.is_deposit = :isDeposit', { isDeposit: true })
    // ... resto del código ...
}
```

#### Solución 3: Validación en `findByTransactionBankId()`

**Archivo:** `src/shared/database/repositories/transaction-status.repository.ts`

```typescript
async findByTransactionBankId(
  transactionBankId: string,
): Promise<TransactionStatus | undefined> {
  const statuses = await this.createQueryBuilder('ts')
    .where('ts.transactions_bank_id = :id', { id: Number(transactionBankId) })
    .orderBy('ts.created_at', 'DESC')
    .getMany();

  if (statuses.length > 1) {
    this.logger.warn(
      `ALERTA: Transaction ${transactionBankId} tiene ${statuses.length} ` +
      `TransactionStatus. Se retorna el más reciente. IDs: ${statuses.map(s => s.id).join(', ')}`
    );
  }

  return statuses[0] ?? undefined;  // ✅ Retorna solo el primero
}
```

### 9.2 CORTO PLAZO (Correctivo - Siguiente Sprint)

#### Agregar Constraint UNIQUE en BD

**Migración TypeORM:**

```typescript
// src/shared/database/migrations/add-unique-constraint-transaction-status.ts

export class AddUniqueConstraintTransactionStatus1707000000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // Primero, eliminar duplicados (mantener el más reciente)
    await queryRunner.query(`
      DELETE FROM transaction_status ts
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM transaction_status
        GROUP BY transactions_bank_id
      )
    `);

    // Agregar constraint UNIQUE
    await queryRunner.query(`
      ALTER TABLE transaction_status
      ADD CONSTRAINT uq_transaction_status_tx_id
      UNIQUE (transactions_bank_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transaction_status
      DROP CONSTRAINT uq_transaction_status_tx_id
    `);
  }
}
```

#### Audit Script: Deduplicación

```sql
-- Encontrar y marcar duplicados para eliminación
BEGIN;

CREATE TEMP TABLE ts_to_delete AS
SELECT id
FROM transaction_status
WHERE id NOT IN (
  SELECT MAX(id)
  FROM transaction_status
  GROUP BY transactions_bank_id
)
ORDER BY id;

-- Ver cuántos se van a eliminar
SELECT COUNT(*) as duplicates_to_remove FROM ts_to_delete;

-- Eliminar (descomentar después de verificar)
-- DELETE FROM transaction_status
-- WHERE id IN (SELECT id FROM ts_to_delete);

COMMIT;
```

### 9.3 LARGO PLAZO (Arquitectónico - Roadmap)

#### 1. Refactorizar Entidad TransactionStatus

```typescript
// src/shared/database/entities/transaction-status.entity.ts

@Entity('transaction_status')
@Index('idx_transaction_status_tx_id', ['transactions_bank_id'], { unique: true })
@Index('idx_transaction_status_validation_status')
@Index('idx_transaction_status_created_at')
export class TransactionStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'numeric', nullable: false })
  transactions_bank_id: number;

  @ManyToOne(() => TransactionBank)
  @JoinColumn({ name: 'transactions_bank_id' })
  transactionBank: TransactionBank;

  // ... resto de columnas ...
}
```

#### 2. Validación en Repositorio

```typescript
// Método que valida integridad ANTES de crear

async createOrUpdate(
  data: Partial<TransactionStatus>,
  queryRunner: QueryRunner,
): Promise<TransactionStatus> {
  const existing = await this.findByTransactionBankId(data.transactions_bank_id);

  if (existing) {
    // Actualizar en lugar de crear (si el estado cambió)
    if (existing.validation_status !== data.validation_status) {
      return await this.update(existing.id, data, queryRunner);
    }
    return existing;
  }

  // Crear nuevo
  return await this.create(data, queryRunner);
}
```

#### 3. Monitoreo y Alertas

```typescript
// Agregación a HealthCheck o MonitoringService

async checkReconciliationDataIntegrity(): Promise<HealthCheckStatus> {
  const duplicateCount = await this.checkDuplicateTransactionStatus();

  if (duplicateCount > 0) {
    return {
      status: 'warning',
      message: `${duplicateCount} TransactionStatus duplicados detectados`,
      data: { duplicates: duplicateCount }
    };
  }

  return { status: 'healthy' };
}
```

---

## 10. CHECKLIST DE VALIDACIÓN POST-FIX

- [ ] Ejecutar queries de auditoría (sección 8)
- [ ] Confirmar que no hay TransactionStatus duplicados nuevos
- [ ] Verificar que `confirmation_status = true` se actualiza en `persistSurplus()`
- [ ] Prueba manual: `/reconcile` + `/unclaimed-deposits` → Sin duplicados
- [ ] Prueba manual: `assignHouseToDeposit()` → 1 Record por TX
- [ ] Verificar balances de casas (no deben estar triplicados)
- [ ] Validar reportes financieros vs BD
- [ ] Revisar logs de payment allocation (sin ejecuciones múltiples)
- [ ] Agregar tests unitarios para `persistSurplus()`
- [ ] Documentar cambios en CHANGELOG.md

---

## 11. REFERENCIAS AL CÓDIGO

### Archivos Problemáticos

| Archivo | Línea | Problema |
|---------|-------|----------|
| `reconciliation-persistence.service.ts` | 385-432 | NO actualiza `confirmation_status` en `persistSurplus()` |
| `unclaimed-deposits.service.ts` | 73-133 | LEFT JOIN sin DISTINCT |
| `transaction-status.entity.ts` | - | NO tiene @Unique constraint |
| `transaction-status.repository.ts` | 94-102 | No valida duplicados |

### Archivos Relacionados (Potencial Impacto)

| Archivo | Funcionalidad |
|---------|--------------|
| `manual-validation.service.ts` | Approval de casos manuales |
| `reconcile.use-case.ts` | Orquestación principal |
| `reconciliation-data.service.ts` | Obtención de datos pendientes |
| `bank-reconciliation.controller.ts` | Endpoints HTTP |
| `historical-row-processor.service.ts` | Importación de datos |

---

## 12. CONCLUSIONES

### Diagnóstico Final

El problema reportado de "duplicación de depósitos no reclamados" es síntoma de un **error arquitectónico** en el manejo de estado:

1. **Root Cause:** `persistSurplus()` no marca transacciones como procesadas
2. **Catalizador:** Data histórica corrupta (múltiples TS por TX)
3. **Amplificador:** Queries sin DISTINCT permiten mostrar duplicados
4. **Multiplicador:** Asignaciones múltiples triplicam balances en cascada

### Impacto Operacional

- **Criticidad:** 🔴 BLOQUEANTE
- **Área afectada:** Reconciliación bancaria, reportes financieros
- **Datos en riesgo:** Balances de casas, conceptos de pago
- **Usuarios afectados:** Administradores, contabilidad

### Tiempo de Corrección

- **Solución inmediata:** 2-3 horas (Soluciones 1-3)
- **Auditoría y limpieza:** 1 día
- **Implementación arquitectónica:** 1 sprint
- **Testing completo:** 1 sprint

---

**Documento preparado para:** Equipo de Desarrollo, Product Owner, QA
**Requiere acción inmediata:** ✅ SÍ
**Nivel de urgencia:** 🔴 CRÍTICO
