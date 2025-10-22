# Análisis de Persistencia de Estados de Conciliación Bancaria

## 📋 Resumen Ejecutivo

Este documento analiza cómo el sistema actual refleja los estados de conciliación bancaria (conciliados, pendientes, sobrantes) en la base de datos y propone mejoras para garantizar la trazabilidad completa del proceso.

---

## 🔍 Estado Actual del Sistema

### Resultados del Endpoint de Conciliación

El endpoint devuelve tres categorías de resultados:

```typescript
interface ReconcileOutput {
  conciliados: ReconciliationMatch[];      // ✅ Conciliados exitosamente
  pendientes: PendingVoucher[];            // ⚠️ Vouchers sin transacción bancaria
  sobrantes: SurplusTransaction[];         // ❌ Transacciones sin voucher/match
  manualValidationRequired: ManualValidationCase[];  // 🔍 Requieren revisión humana
}
```

---

## 📊 Análisis por Estado

### 1. **CONCILIADOS** - ✅ Bien Implementado

#### ¿Cómo se persisten?

Cuando una transacción se concilia exitosamente (con o sin voucher), se crean los siguientes registros:

```typescript
// Código: reconciliation-persistence.service.ts:48-123
await persistReconciliation(transactionBankId, voucher, houseNumber);
```

**Registros creados en BD:**

| Tabla | Campo Clave | Valor | Propósito |
|-------|------------|-------|-----------|
| **transactions_status** | `validation_status` | `'confirmed'` | Marca la transacción como confirmada |
| **transactions_status** | `transactions_bank_id` | ID de transacción | Asocia con transacción bancaria |
| **transactions_status** | `vouchers_id` | ID de voucher o `NULL` | Asocia con voucher (si existe) |
| **records** | `vouchers_id` | ID de voucher o `NULL` | Registro de pago |
| **records** | `transaction_status_id` | ID de status | Link al transaction_status |
| **house_records** | `house_id` | ID de casa | Asocia pago con casa |
| **house_records** | `record_id` | ID de record | Link al record |
| **transactions_bank** | `confirmation_status` | `true` | Marca transacción como procesada |
| **vouchers** | `confirmation_status` | `true` | Marca voucher como procesado (si existe) |
| **vouchers** | `url` | `NULL` | Elimina archivo del bucket (si existe) |

#### ✅ Consulta SQL para obtener conciliados:

```sql
-- Transacciones conciliadas (con o sin voucher)
SELECT
  tb.id as transaction_id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.validation_status,
  ts.vouchers_id,
  v.id as voucher_id,
  v.confirmation_code,
  hr.house_id,
  h.number_house
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
LEFT JOIN vouchers v ON ts.vouchers_id = v.id
INNER JOIN records r ON r.transaction_status_id = ts.id
INNER JOIN house_records hr ON hr.record_id = r.id
INNER JOIN houses h ON h.id = hr.house_id
WHERE ts.validation_status = 'confirmed'
  AND tb.confirmation_status = true;
```

**Resultado:** ✅ **EXCELENTE** - Se puede recuperar completamente el estado de conciliados desde la BD.

---

### 2. **PENDIENTES** (Vouchers sin transacción bancaria) - ⚠️ Parcialmente Implementado

#### ¿Cómo se persisten?

**PROBLEMA:** Los vouchers pendientes **NO SE PERSISTEN** explícitamente como resultado de la conciliación.

```typescript
// Código: reconcile.use-case.ts:157-164
const pendientesList = pendingVouchers
  .filter((voucher) => !processedVoucherIds.has(voucher.id))
  .map((voucher) => PendingVoucher.fromVoucher(voucher, 'No matching bank transaction found'));

// ❌ NO se guarda en BD, solo se devuelve en el response
```

#### ¿Cómo identificarlos actualmente?

```sql
-- Vouchers pendientes (no conciliados)
SELECT
  v.id,
  v.amount,
  v.date,
  v.confirmation_code,
  v.confirmation_status
FROM vouchers v
WHERE v.confirmation_status = false;
```

**Limitaciones:**
- ❌ No sabemos si el voucher fue **procesado** por la conciliación pero no encontró match
- ❌ No sabemos **cuándo** se ejecutó la última conciliación que lo revisó
- ❌ No sabemos la **razón** por la cual quedó pendiente
- ❌ No hay trazabilidad de intentos de conciliación

**Resultado:** ⚠️ **MEJORABLE** - Se puede identificar por `confirmation_status = false`, pero falta contexto.

---

### 3. **SOBRANTES** (Transacciones sin match) - ❌ NO Implementado

#### ¿Cómo se persisten?

**PROBLEMA CRÍTICO:** Las transacciones sobrantes **NO SE PERSISTEN EN ABSOLUTO**.

```typescript
// Código: reconcile.use-case.ts:148-150
} else {
  // ⚠️ Sobrante que requiere validación manual
  sobrantes.push(matchResult.surplus);  // ❌ Solo se agrega al response, NO a BD
}
```

#### ¿Cómo identificarlos actualmente?

```sql
-- Transacciones no conciliadas (posibles sobrantes)
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  tb.confirmation_status
FROM transactions_bank tb
WHERE tb.confirmation_status = false
  AND tb.is_deposit = true;
```

**Limitaciones CRÍTICAS:**
- ❌ No sabemos si la transacción fue **procesada** por la conciliación
- ❌ No sabemos la **razón** por la cual quedó como sobrante:
  - ¿Sin centavos válidos?
  - ¿Conflicto entre centavos y concepto?
  - ¿Casa fuera de rango?
  - ¿Error de persistencia?
- ❌ No sabemos si es un **verdadero sobrante** o simplemente una transacción nueva que aún no se procesó
- ❌ Si hubo un `houseNumber` identificado pero requiere validación manual, **se pierde esa información**
- ❌ No hay forma de continuar con validaciones manuales posteriores

**Resultado:** ❌ **CRÍTICO** - Información crucial se pierde al finalizar el endpoint.

---

### 4. **MANUAL VALIDATION** - ❌ NO Implementado

#### ¿Cómo se persisten?

**PROBLEMA CRÍTICO:** Los casos que requieren validación manual **NO SE PERSISTEN**.

```typescript
// Código: reconcile.use-case.ts:151-153
} else if (matchResult.type === 'manual') {
  manualValidationRequired.push(matchResult.case);  // ❌ Solo en response
}
```

**Limitaciones:**
- ❌ Múltiples vouchers candidatos se pierden
- ❌ Scores de similitud se pierden
- ❌ No hay workflow de validación manual

**Resultado:** ❌ **CRÍTICO** - Imposible continuar validación manual después del endpoint.

---

## 🎯 Objetivos No Cumplidos

### ❌ Objetivo 1: Trazabilidad completa
**Problema:** No se puede determinar si una transacción/voucher fue procesado por la conciliación.

### ❌ Objetivo 2: Razones documentadas
**Problema:** No se guarda el motivo por el cual algo quedó pendiente o sobrante.

### ❌ Objetivo 3: Continuación de validación manual
**Problema:** No hay forma de retomar casos pendientes de validación manual.

### ❌ Objetivo 4: Auditoría temporal
**Problema:** No se sabe cuándo se ejecutó la última conciliación que procesó cada registro.

---

## 💡 Propuestas de Mejora

### **Opción A: Usar y Extender `transactions_status` (Recomendado)**

#### Ventajas:
- ✅ Tabla ya existe
- ✅ Mínimos cambios en schema
- ✅ Reutiliza lógica existente

#### Cambios Necesarios:

##### 1. Agregar nuevos valores al enum `ValidationStatus`

```typescript
// src/shared/database/entities/enums.ts
export enum ValidationStatus {
  NOT_FOUND = 'not-found',      // ⬅️ Ya existe (para sobrantes)
  PENDING = 'pending',           // ⬅️ Ya existe (inicial)
  CONFIRMED = 'confirmed',       // ⬅️ Ya existe (conciliado)
  REQUIRES_MANUAL = 'requires-manual',  // ⬅️ NUEVO: Requiere validación manual
  CONFLICT = 'conflict',         // ⬅️ NUEVO: Conflicto entre centavos/concepto
}
```

```sql
-- Migration SQL
ALTER TYPE validation_status_t ADD VALUE 'requires-manual';
ALTER TYPE validation_status_t ADD VALUE 'conflict';
```

##### 2. Agregar campos adicionales a `transactions_status`

```sql
ALTER TABLE transactions_status
ADD COLUMN reason text,                    -- Razón del estado actual
ADD COLUMN identified_house_number int,    -- Casa identificada (aunque requiera validación)
ADD COLUMN processed_at timestamptz,       -- Cuándo fue procesado por conciliación
ADD COLUMN metadata jsonb;                 -- Información adicional (candidatos, scores, etc.)
```

```typescript
// Actualizar entity
@Entity('transactions_status')
export class TransactionStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ValidationStatus, default: ValidationStatus.PENDING })
  validation_status: ValidationStatus;

  @Column({ type: 'bigint', nullable: true })
  transactions_bank_id: string;

  @Column({ type: 'int', nullable: true })
  vouchers_id: number;

  // ✅ Nuevos campos
  @Column({ type: 'text', nullable: true })
  reason: string;  // "Centavos + concepto coinciden", "Conflicto centavos vs concepto", etc.

  @Column({ type: 'int', nullable: true })
  identified_house_number: number;  // Casa identificada (aunque requiera validación)

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date;  // Timestamp de la última conciliación que procesó este registro

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    possibleMatches?: Array<{
      voucherId: number;
      similarity: number;
      dateDifferenceHours: number;
    }>;
    matchCriteria?: string[];
    confidenceLevel?: string;
  };

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // ... relations
}
```

##### 3. Modificar `ReconciliationPersistenceService`

```typescript
// Para SOBRANTES
async persistSurplus(
  transactionBankId: string,
  surplus: SurplusTransaction,
): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const status = surplus.requiresManualReview
      ? ValidationStatus.REQUIRES_MANUAL
      : ValidationStatus.NOT_FOUND;

    await this.transactionStatusRepository.create(
      {
        validation_status: status,
        transactions_bank_id: transactionBankId,
        vouchers_id: null,
        reason: surplus.reason,
        identified_house_number: surplus.houseNumber,
        processed_at: new Date(),
        metadata: null,
      },
      queryRunner,
    );

    await queryRunner.commitTransaction();
    this.logger.log(`Sobrante registrado: Transaction ${transactionBankId}`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

// Para VALIDACIÓN MANUAL
async persistManualValidationCase(
  transactionBankId: string,
  manualCase: ManualValidationCase,
): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await this.transactionStatusRepository.create(
      {
        validation_status: ValidationStatus.REQUIRES_MANUAL,
        transactions_bank_id: transactionBankId,
        vouchers_id: null,
        reason: manualCase.reason,
        identified_house_number: null,
        processed_at: new Date(),
        metadata: {
          possibleMatches: manualCase.possibleMatches,
        },
      },
      queryRunner,
    );

    await queryRunner.commitTransaction();
    this.logger.log(`Caso manual registrado: Transaction ${transactionBankId}`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

##### 4. Modificar `ReconcileUseCase` para persistir TODO

```typescript
// En reconcile.use-case.ts:109-150
} else if (matchResult.type === 'surplus') {
  if (!matchResult.surplus.requiresManualReview) {
    // ... código existente de auto-conciliación
  } else {
    // ✅ NUEVO: Persistir sobrantes en BD
    try {
      await this.persistenceService.persistSurplus(
        matchResult.surplus.transactionBankId,
        matchResult.surplus,
      );
    } catch (error) {
      this.logger.error(`Error al persistir sobrante: ${error.message}`);
    }
    sobrantes.push(matchResult.surplus);
  }
} else if (matchResult.type === 'manual') {
  // ✅ NUEVO: Persistir casos manuales en BD
  try {
    await this.persistenceService.persistManualValidationCase(
      matchResult.case.transactionBankId,
      matchResult.case,
    );
  } catch (error) {
    this.logger.error(`Error al persistir caso manual: ${error.message}`);
  }
  manualValidationRequired.push(matchResult.case);
}
```

##### 5. Actualizar `ReconciliationDataService` para filtrar correctamente

```typescript
async getPendingTransactions(startDate?: Date, endDate?: Date): Promise<TransactionBank[]> {
  let transactions = await this.transactionBankRepository.findAll();

  // ✅ MEJORADO: Excluir transacciones ya procesadas (confirmadas o con status registrado)
  const processedTransactionIds = await this.getProcessedTransactionIds();

  transactions = transactions.filter(
    (t) =>
      t.is_deposit &&
      !t.confirmation_status &&
      !processedTransactionIds.has(t.id)  // ⬅️ NUEVO: No reprocesar sobrantes/manuales
  );

  // Filtrar por fechas...
  return transactions;
}

private async getProcessedTransactionIds(): Promise<Set<string>> {
  const statuses = await this.transactionStatusRepository.findAll();
  return new Set(statuses.map(s => s.transactions_bank_id).filter(Boolean));
}
```

#### Consultas SQL Resultantes:

```sql
-- ✅ Obtener CONCILIADOS
SELECT
  tb.id,
  tb.amount,
  tb.date,
  ts.validation_status,
  ts.reason,
  ts.processed_at,
  h.number_house
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
INNER JOIN records r ON r.transaction_status_id = ts.id
INNER JOIN house_records hr ON hr.record_id = r.id
INNER JOIN houses h ON h.id = hr.house_id
WHERE ts.validation_status = 'confirmed';

-- ⚠️ Obtener PENDIENTES (vouchers sin match)
SELECT
  v.id,
  v.amount,
  v.date,
  v.confirmation_code,
  ts.reason,
  ts.processed_at
FROM vouchers v
LEFT JOIN transactions_status ts ON v.id = ts.vouchers_id
WHERE v.confirmation_status = false
ORDER BY v.date DESC;

-- ❌ Obtener SOBRANTES
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.validation_status,
  ts.reason,
  ts.identified_house_number,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('not-found', 'conflict')
ORDER BY tb.date DESC;

-- 🔍 Obtener CASOS MANUALES (con candidatos)
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.reason,
  ts.metadata->>'possibleMatches' as candidates,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'requires-manual'
ORDER BY tb.date DESC;

-- 📊 Obtener RESUMEN de última conciliación
SELECT
  ts.validation_status,
  COUNT(*) as total,
  MAX(ts.processed_at) as last_run
FROM transactions_status ts
WHERE ts.processed_at > NOW() - INTERVAL '7 days'
GROUP BY ts.validation_status;
```

---

### **Opción B: Crear tabla dedicada `reconciliation_runs`** (Más completo pero más complejo)

#### Ventajas:
- ✅ Historial completo de ejecuciones
- ✅ Múltiples intentos de conciliación rastreables
- ✅ Auditoría detallada

#### Desventajas:
- ❌ Más tablas y complejidad
- ❌ Joins más complejos
- ❌ Mayor overhead

#### Schema:

```sql
-- Tabla de ejecuciones de conciliación
CREATE TABLE reconciliation_runs (
  id serial PRIMARY KEY,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  start_date date,
  end_date date,
  total_processed int,
  conciliados_count int,
  pendientes_count int,
  sobrantes_count int,
  manual_count int,
  status varchar(50),  -- 'running', 'completed', 'failed'
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Tabla de resultados individuales por run
CREATE TABLE reconciliation_results (
  id serial PRIMARY KEY,
  run_id int NOT NULL REFERENCES reconciliation_runs(id),
  transaction_bank_id bigint REFERENCES transactions_bank(id),
  voucher_id int REFERENCES vouchers(id),
  result_type varchar(50),  -- 'conciliado', 'sobrante', 'manual', 'pendiente-voucher'
  validation_status validation_status_t,
  reason text,
  identified_house_number int,
  metadata jsonb,
  created_at timestamptz DEFAULT NOW(),

  UNIQUE(run_id, transaction_bank_id)
);

CREATE INDEX idx_reconciliation_results_run ON reconciliation_results(run_id);
CREATE INDEX idx_reconciliation_results_type ON reconciliation_results(result_type);
CREATE INDEX idx_reconciliation_results_status ON reconciliation_results(validation_status);
```

---

## 🏆 Recomendación Final

### **Implementar Opción A** (Extender `transactions_status`)

**Por qué:**
1. ✅ Menor impacto en el código existente
2. ✅ Reutiliza infraestructura ya probada
3. ✅ Suficiente para el 90% de casos de uso
4. ✅ Migración más sencilla
5. ✅ Cumple con todos los objetivos:
   - Trazabilidad completa
   - Razones documentadas
   - Soporte para validación manual
   - Auditoría temporal

**Cuándo considerar Opción B:**
- Si necesitas historial de múltiples intentos de conciliación
- Si quieres comparar resultados entre ejecuciones
- Si necesitas reportes de tendencias de conciliación

---

## 📋 Plan de Implementación (Opción A)

### Fase 1: Schema Changes (30 min)
1. Crear migration para agregar valores al enum
2. Crear migration para nuevos campos en `transactions_status`
3. Ejecutar migrations

### Fase 2: Entity Updates (15 min)
1. Actualizar `enums.ts`
2. Actualizar `transaction-status.entity.ts`
3. Actualizar DTOs

### Fase 3: Persistence Layer (1 hora)
1. Agregar métodos `persistSurplus()` y `persistManualValidationCase()`
2. Actualizar `persistReconciliation()` para incluir metadata
3. Escribir tests

### Fase 4: Use Case Updates (45 min)
1. Modificar `ReconcileUseCase` para llamar nuevos métodos
2. Actualizar `ReconciliationDataService` para filtrar correctamente
3. Actualizar tests

### Fase 5: Queries & Endpoints (30 min)
1. Crear método para obtener sobrantes desde BD
2. Crear método para obtener casos manuales desde BD
3. Documentar queries SQL

**Tiempo total estimado: 3 horas**

---

## ✅ Checklist de Validación

- [ ] Transacciones conciliadas se pueden consultar con toda la info
- [ ] Vouchers pendientes muestran razón y última vez procesados
- [ ] Sobrantes se persisten con razón y casa identificada (si aplica)
- [ ] Casos manuales se persisten con candidatos y scores
- [ ] No se reprocesa la misma transacción en múltiples ejecuciones
- [ ] Queries SQL documentadas y probadas
- [ ] Tests actualizados
- [ ] Documentación actualizada

---

**Última actualización:** Octubre 2025
**Autor:** Claude Code
