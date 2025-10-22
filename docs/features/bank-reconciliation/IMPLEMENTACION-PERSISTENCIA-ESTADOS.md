# Plan de Implementación: Persistencia de Estados de Conciliación

## 🎯 Objetivo

Implementar la **Opción A** del análisis de persistencia para que TODOS los resultados de conciliación (conciliados, pendientes, sobrantes, manuales) se reflejen en la base de datos.

**Documento de análisis:** `docs/features/bank-reconciliation/ANALISIS-PERSISTENCIA-ESTADOS.md`

---

## 📍 Punto de Partida (Estado Actual)

### ✅ Lo que YA funciona:
- Conciliaciones exitosas (con y sin voucher) se persisten correctamente
- `transactions_status.validation_status = 'confirmed'` marca conciliados
- Casas se crean automáticamente si no existen
- Tests: 11/11 matching + 9/9 use-case (todos pasando)

### ❌ Lo que FALTA implementar:
- **Sobrantes:** No se persisten (solo en response del endpoint)
- **Casos manuales:** No se persisten (información de candidatos se pierde)
- **Vouchers pendientes:** No se registra que fueron procesados
- **Evitar reprocesamiento:** Transacciones ya procesadas se vuelven a revisar

---

## 📋 Checklist de Implementación (Paso a Paso)

### ✅ FASE 1: Actualizar Schema de Base de Datos

#### 1.1. Crear Migration para Enum
**Archivo:** `prisma/migrations/YYYYMMDD_add_validation_status_values/migration.sql`

```sql
-- Add new values to validation_status_t enum
ALTER TYPE validation_status_t ADD VALUE IF NOT EXISTS 'requires-manual';
ALTER TYPE validation_status_t ADD VALUE IF NOT EXISTS 'conflict';

-- Note: In PostgreSQL, you cannot remove enum values without recreating the type
-- The existing values (not-found, pending, confirmed) remain unchanged
```

**Verificación:**
```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'validation_status_t'::regtype ORDER BY enumsortorder;
```

**Resultado esperado:**
```
enumlabel
-----------------
not-found
pending
confirmed
requires-manual
conflict
```

---

#### 1.2. Crear Migration para Nuevos Campos en transactions_status
**Archivo:** `prisma/migrations/YYYYMMDD_add_transactions_status_fields/migration.sql`

```sql
-- Add new columns to transactions_status table
ALTER TABLE transactions_status
ADD COLUMN IF NOT EXISTS reason text,
ADD COLUMN IF NOT EXISTS identified_house_number int,
ADD COLUMN IF NOT EXISTS processed_at timestamptz,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add comments for documentation
COMMENT ON COLUMN transactions_status.reason IS 'Razón del estado actual (ej: "Conflicto centavos vs concepto", "Identificado por centavos (casa 15)")';
COMMENT ON COLUMN transactions_status.identified_house_number IS 'Número de casa identificado durante conciliación (aunque requiera validación manual)';
COMMENT ON COLUMN transactions_status.processed_at IS 'Timestamp de cuándo fue procesado por la última conciliación';
COMMENT ON COLUMN transactions_status.metadata IS 'Información adicional en formato JSON (candidatos, scores, matchCriteria, etc.)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_status_validation ON transactions_status(validation_status);
CREATE INDEX IF NOT EXISTS idx_transactions_status_processed_at ON transactions_status(processed_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status_house_number ON transactions_status(identified_house_number);
```

**Verificación:**
```sql
\d transactions_status
```

**Resultado esperado:**
```
Column                    | Type                     | Nullable | Default
--------------------------|--------------------------|----------|--------
id                        | integer                  | not null | nextval(...)
validation_status         | validation_status_t      | not null | 'pending'
transactions_bank_id      | bigint                   | yes      |
vouchers_id               | integer                  | yes      |
reason                    | text                     | yes      | ← NUEVO
identified_house_number   | integer                  | yes      | ← NUEVO
processed_at              | timestamptz              | yes      | ← NUEVO
metadata                  | jsonb                    | yes      | ← NUEVO
created_at                | timestamptz              | not null | now()
updated_at                | timestamptz              | not null | now()
```

---

### ✅ FASE 2: Actualizar Entities y DTOs TypeORM

#### 2.1. Actualizar Enum
**Archivo:** `src/shared/database/entities/enums.ts`

**Cambio:**
```typescript
export enum ValidationStatus {
  NOT_FOUND = 'not-found',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REQUIRES_MANUAL = 'requires-manual',  // ← NUEVO
  CONFLICT = 'conflict',                // ← NUEVO
}
```

**Líneas a modificar:** 13-17

---

#### 2.2. Actualizar TransactionStatus Entity
**Archivo:** `src/shared/database/entities/transaction-status.entity.ts`

**Cambios:**

1. **Agregar imports:**
```typescript
// Línea 9 (después de UpdateDateColumn)
import { ValidationStatus } from './enums';
import { TransactionBank } from './transaction-bank.entity';
import { Voucher } from './voucher.entity';
import { Record } from './record.entity';
```

2. **Agregar nuevos campos (después de línea 32):**
```typescript
  @Column({ type: 'int', nullable: true })
  vouchers_id: number;

  // ← NUEVOS CAMPOS AQUÍ
  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'int', nullable: true })
  identified_house_number: number;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date;

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
```

**Verificación:** Verificar que compile sin errores
```bash
npm run build
```

---

#### 2.3. Actualizar DTOs del Repository
**Archivo:** `src/shared/database/repositories/transaction-status.repository.ts`

**Buscar interface CreateTransactionStatusDto y actualizar:**

```typescript
export interface CreateTransactionStatusDto {
  validation_status: ValidationStatus;
  transactions_bank_id: string;
  vouchers_id: number | null;
  // ← NUEVOS CAMPOS OPCIONALES
  reason?: string;
  identified_house_number?: number;
  processed_at?: Date;
  metadata?: {
    possibleMatches?: Array<{
      voucherId: number;
      similarity: number;
      dateDifferenceHours: number;
    }>;
    matchCriteria?: string[];
    confidenceLevel?: string;
  };
}
```

**Nota:** Si el archivo no tiene interface explícita, verificar el método `create()` y asegurarse de que acepte estos campos.

---

### ✅ FASE 3: Actualizar Persistence Service

#### 3.1. Agregar Método persistSurplus
**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`

**Ubicación:** Después del método `updateVoucherStatus` (después de línea 261)

**Código completo a agregar:**

```typescript
  /**
   * Persiste una transacción sobrante en la base de datos
   * Crea un TransactionStatus con estado NOT_FOUND o CONFLICT
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param surplus - Objeto SurplusTransaction con información del sobrante
   */
  async persistSurplus(
    transactionBankId: string,
    surplus: SurplusTransaction,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Determinar el status según si requiere validación manual
      // CONFLICT: cuando hay conflicto entre centavos y concepto
      // NOT_FOUND: cuando no hay información suficiente
      const status = surplus.reason.includes('Conflicto')
        ? ValidationStatus.CONFLICT
        : ValidationStatus.NOT_FOUND;

      await this.transactionStatusRepository.create(
        {
          validation_status: status,
          transactions_bank_id: transactionBankId,
          vouchers_id: null,
          reason: surplus.reason,
          identified_house_number: surplus.houseNumber ?? null,
          processed_at: new Date(),
          metadata: null,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Sobrante persistido: Transaction ${transactionBankId}, Status: ${status}, Razón: ${surplus.reason}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error al persistir sobrante: ${errorMessage}`,
        errorStack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
```

**Imports necesarios (verificar que estén en la parte superior del archivo):**
```typescript
import { SurplusTransaction, ManualValidationCase } from '../domain';
```

---

#### 3.2. Agregar Método persistManualValidationCase
**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`

**Ubicación:** Después del método `persistSurplus`

**Código completo a agregar:**

```typescript
  /**
   * Persiste un caso que requiere validación manual
   * Guarda los posibles candidatos en el campo metadata para revisión posterior
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param manualCase - Objeto ManualValidationCase con candidatos y scores
   */
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
      this.logger.log(
        `Caso manual persistido: Transaction ${transactionBankId}, Candidatos: ${manualCase.possibleMatches.length}, Razón: ${manualCase.reason}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error al persistir caso manual: ${errorMessage}`,
        errorStack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
```

---

#### 3.3. Actualizar persistReconciliation para incluir metadata
**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`

**Línea 134 (método createTransactionStatus):**

**Antes:**
```typescript
  private async createTransactionStatus(
    transactionBankId: string,
    voucherId: number | null,
    queryRunner: QueryRunner,
  ) {
    return await this.transactionStatusRepository.create(
      {
        validation_status: ValidationStatus.CONFIRMED,
        transactions_bank_id: transactionBankId,
        vouchers_id: voucherId,
      },
      queryRunner,
    );
  }
```

**Después (agregar metadata):**
```typescript
  private async createTransactionStatus(
    transactionBankId: string,
    voucherId: number | null,
    queryRunner: QueryRunner,
    metadata?: {
      matchCriteria?: string[];
      confidenceLevel?: string;
    },
  ) {
    return await this.transactionStatusRepository.create(
      {
        validation_status: ValidationStatus.CONFIRMED,
        transactions_bank_id: transactionBankId,
        vouchers_id: voucherId,
        reason: voucherId
          ? 'Conciliado con voucher'
          : 'Conciliado automáticamente por centavos/concepto',
        processed_at: new Date(),
        metadata: metadata ?? null,
      },
      queryRunner,
    );
  }
```

**Y actualizar las llamadas en línea 59:**

**Antes:**
```typescript
const transactionStatus = await this.createTransactionStatus(
  transactionBankId,
  voucher?.id ?? null,
  queryRunner,
);
```

**Después:**
```typescript
const transactionStatus = await this.createTransactionStatus(
  transactionBankId,
  voucher?.id ?? null,
  queryRunner,
  {
    matchCriteria: ['amount', 'date'], // Puedes pasar esto como parámetro si lo necesitas
    confidenceLevel: 'high',
  },
);
```

---

### ✅ FASE 4: Actualizar Use Case

#### 4.1. Modificar ReconcileUseCase para persistir sobrantes y casos manuales
**Archivo:** `src/features/bank-reconciliation/application/reconcile.use-case.ts`

**Línea 109-154 (bloque else if surplus y else if manual):**

**Buscar:**
```typescript
      } else if (matchResult.type === 'surplus') {
        // Distinguir entre surplus conciliados automáticamente vs sobrantes
        if (!matchResult.surplus.requiresManualReview) {
          // ... código existente de auto-conciliación ...
        } else {
          // ⚠️ Sobrante que requiere validación manual
          sobrantes.push(matchResult.surplus);
        }
      } else if (matchResult.type === 'manual') {
        manualValidationRequired.push(matchResult.case);
      }
```

**Reemplazar con:**
```typescript
      } else if (matchResult.type === 'surplus') {
        // Distinguir entre surplus conciliados automáticamente vs sobrantes
        if (!matchResult.surplus.requiresManualReview) {
          // ✅ Conciliado automáticamente (sin voucher, por centavos/concepto)
          try {
            await this.persistenceService.persistReconciliation(
              matchResult.surplus.transactionBankId,
              null, // Sin voucher
              matchResult.surplus.houseNumber!,
            );

            // Crear ReconciliationMatch para agregarlo a conciliados
            const match = ReconciliationMatch.create({
              transaction,
              voucher: undefined,
              houseNumber: matchResult.surplus.houseNumber!,
              matchCriteria: [MatchCriteria.CONCEPT],
              confidenceLevel: ConfidenceLevel.MEDIUM,
            });

            conciliados.push(match);
            this.logger.log(
              `Conciliado automáticamente sin voucher: Transaction ${transaction.id} → Casa ${matchResult.surplus.houseNumber}`,
            );
          } catch (error) {
            this.logger.error(
              `Error al persistir conciliación automática para transaction ${matchResult.surplus.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            // En caso de error, marcar como sobrante que requiere revisión
            sobrantes.push(
              SurplusTransaction.fromTransaction(
                transaction,
                `Error durante persistencia automática: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true,
                matchResult.surplus.houseNumber,
              ),
            );
          }
        } else {
          // ⚠️ Sobrante que requiere validación manual
          // ✅ NUEVO: Persistir sobrantes en BD
          try {
            await this.persistenceService.persistSurplus(
              matchResult.surplus.transactionBankId,
              matchResult.surplus,
            );
            this.logger.log(
              `Sobrante persistido: Transaction ${matchResult.surplus.transactionBankId}, Razón: ${matchResult.surplus.reason}`,
            );
          } catch (error) {
            this.logger.error(
              `Error al persistir sobrante para transaction ${matchResult.surplus.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            // Continuar de todos modos, agregar a lista de sobrantes
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
          this.logger.log(
            `Caso manual persistido: Transaction ${matchResult.case.transactionBankId}, Candidatos: ${matchResult.case.possibleMatches.length}`,
          );
        } catch (error) {
          this.logger.error(
            `Error al persistir caso manual para transaction ${matchResult.case.transactionBankId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // Continuar de todos modos, agregar a lista de manuales
        }
        manualValidationRequired.push(matchResult.case);
      }
```

**Nota:** El código de auto-conciliación (líneas 112-146) ya existe, solo se agrega la persistencia de sobrantes y casos manuales.

---

### ✅ FASE 5: Evitar Reprocesamiento

#### 5.1. Actualizar ReconciliationDataService para filtrar transacciones ya procesadas
**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-data.service.ts`

**Agregar nuevo método (después de línea 62):**

```typescript
  /**
   * Obtiene IDs de transacciones que ya fueron procesadas por conciliación
   * (tienen un TransactionStatus registrado, sin importar el resultado)
   */
  private async getProcessedTransactionIds(): Promise<Set<string>> {
    // Necesitamos inyectar TransactionStatusRepository
    const statuses = await this.transactionStatusRepository.findAll();
    return new Set(
      statuses
        .map((s) => s.transactions_bank_id)
        .filter((id): id is string => id !== null),
    );
  }
```

**Actualizar constructor para inyectar TransactionStatusRepository (línea 12):**

**Antes:**
```typescript
  constructor(
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly voucherRepository: VoucherRepository,
  ) {}
```

**Después:**
```typescript
  constructor(
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly voucherRepository: VoucherRepository,
    private readonly transactionStatusRepository: TransactionStatusRepository,
  ) {}
```

**Agregar import:**
```typescript
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
```

**Actualizar método getPendingTransactions (línea 21-41):**

**Buscar:**
```typescript
  async getPendingTransactions(
    startDate?: Date,
    endDate?: Date,
  ): Promise<TransactionBank[]> {
    let transactions = await this.transactionBankRepository.findAll();

    // Filtrar por reglas de negocio
    transactions = transactions.filter(
      (t) => !t.confirmation_status && t.is_deposit,
    );

    // Filtrar por rango de fechas si se especifica
    if (startDate && endDate) {
      transactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    return transactions;
  }
```

**Reemplazar con:**
```typescript
  async getPendingTransactions(
    startDate?: Date,
    endDate?: Date,
  ): Promise<TransactionBank[]> {
    let transactions = await this.transactionBankRepository.findAll();

    // ✅ NUEVO: Obtener IDs de transacciones ya procesadas
    const processedTransactionIds = await this.getProcessedTransactionIds();

    // Filtrar por reglas de negocio
    transactions = transactions.filter(
      (t) =>
        t.is_deposit &&
        !t.confirmation_status &&
        !processedTransactionIds.has(t.id), // ⬅️ NUEVO: No reprocesar
    );

    // Filtrar por rango de fechas si se especifica
    if (startDate && endDate) {
      transactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    return transactions;
  }
```

---

### ✅ FASE 6: Actualizar Tests

#### 6.1. Actualizar mocks en reconcile.use-case.spec.ts
**Archivo:** `src/features/bank-reconciliation/application/reconcile.use-case.spec.ts`

**Buscar todos los mocks de persistenceService y agregar nuevos métodos:**

**Línea ~40-50 (setup de mocks):**

**Agregar después del mock de persistReconciliation:**
```typescript
    const mockPersistenceService = {
      persistReconciliation: jest.fn().mockResolvedValue(undefined),
      persistSurplus: jest.fn().mockResolvedValue(undefined),              // ← NUEVO
      persistManualValidationCase: jest.fn().mockResolvedValue(undefined), // ← NUEVO
    };
```

**Verificar que no se llamen los nuevos métodos en tests existentes (o agregarlos si es necesario).**

---

#### 6.2. Crear nuevos tests para sobrantes y casos manuales
**Archivo:** `src/features/bank-reconciliation/application/reconcile.use-case.spec.ts`

**Agregar al final del bloque describe (después de los tests existentes):**

```typescript
    it('should persist surplus transactions to database', async () => {
      const mockTransaction = mockTransactions[0];
      mockDataService.getPendingTransactions.mockResolvedValue([mockTransaction]);
      mockDataService.getPendingVouchers.mockResolvedValue([]);

      // Mock surplus result
      mockMatchingService.matchTransaction.mockResolvedValue({
        type: 'surplus',
        surplus: {
          transactionBankId: mockTransaction.id,
          amount: mockTransaction.amount,
          date: mockTransaction.date,
          reason: 'Sin información suficiente',
          requiresManualReview: true,
          houseNumber: undefined,
        },
      });

      await useCase.execute({ startDate: new Date(), endDate: new Date() });

      // Verificar que se llamó persistSurplus
      expect(mockPersistenceService.persistSurplus).toHaveBeenCalledWith(
        mockTransaction.id,
        expect.objectContaining({
          transactionBankId: mockTransaction.id,
          requiresManualReview: true,
        }),
      );
    });

    it('should persist manual validation cases to database', async () => {
      const mockTransaction = mockTransactions[0];
      mockDataService.getPendingTransactions.mockResolvedValue([mockTransaction]);
      mockDataService.getPendingVouchers.mockResolvedValue(mockVouchers);

      // Mock manual validation result
      mockMatchingService.matchTransaction.mockResolvedValue({
        type: 'manual',
        case: {
          transactionBankId: mockTransaction.id,
          possibleMatches: [
            { voucherId: 1, similarity: 0.8, dateDifferenceHours: 2 },
            { voucherId: 2, similarity: 0.7, dateDifferenceHours: 3 },
          ],
          reason: 'Múltiples candidatos con alta similitud',
        },
      });

      await useCase.execute({ startDate: new Date(), endDate: new Date() });

      // Verificar que se llamó persistManualValidationCase
      expect(mockPersistenceService.persistManualValidationCase).toHaveBeenCalledWith(
        mockTransaction.id,
        expect.objectContaining({
          transactionBankId: mockTransaction.id,
          possibleMatches: expect.arrayContaining([
            expect.objectContaining({ voucherId: 1 }),
          ]),
        }),
      );
    });
```

---

### ✅ FASE 7: Documentar Queries SQL

#### 7.1. Crear archivo de queries útiles
**Archivo:** `docs/features/bank-reconciliation/QUERIES-CONCILIACION.md`

**Contenido completo:**

```markdown
# Queries SQL - Conciliación Bancaria

## Consultas para Obtener Resultados de Conciliación

### 1. Obtener Transacciones CONCILIADAS

```sql
-- Transacciones conciliadas (con todos los detalles)
SELECT
  tb.id as transaction_id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.validation_status,
  ts.reason,
  ts.processed_at,
  ts.vouchers_id,
  v.confirmation_code,
  h.number_house,
  ts.metadata
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
LEFT JOIN vouchers v ON ts.vouchers_id = v.id
INNER JOIN records r ON r.transaction_status_id = ts.id
INNER JOIN house_records hr ON hr.record_id = r.id
INNER JOIN houses h ON h.id = hr.house_id
WHERE ts.validation_status = 'confirmed'
ORDER BY ts.processed_at DESC;
```

### 2. Obtener Transacciones SOBRANTES

```sql
-- Transacciones sobrantes (sin match o con conflictos)
SELECT
  tb.id as transaction_id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.validation_status,
  ts.reason,
  ts.identified_house_number,
  ts.processed_at,
  ts.metadata
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('not-found', 'conflict')
ORDER BY ts.processed_at DESC;
```

### 3. Obtener Casos REQUIEREN VALIDACIÓN MANUAL

```sql
-- Casos que requieren revisión humana (con candidatos)
SELECT
  tb.id as transaction_id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.reason,
  ts.metadata->'possibleMatches' as candidates,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'requires-manual'
ORDER BY ts.processed_at DESC;
```

### 4. Obtener Vouchers PENDIENTES

```sql
-- Vouchers sin transacción bancaria asociada
SELECT
  v.id as voucher_id,
  v.amount,
  v.date,
  v.confirmation_code,
  v.confirmation_status,
  ts.reason,
  ts.processed_at
FROM vouchers v
LEFT JOIN transactions_status ts ON v.id = ts.vouchers_id
WHERE v.confirmation_status = false
ORDER BY v.date DESC;
```

### 5. Resumen de Última Conciliación

```sql
-- Resumen agrupado por estado
SELECT
  ts.validation_status,
  COUNT(*) as total,
  MAX(ts.processed_at) as last_processed
FROM transactions_status ts
WHERE ts.processed_at > NOW() - INTERVAL '7 days'
GROUP BY ts.validation_status
ORDER BY total DESC;
```

### 6. Sobrantes con Casa Identificada (pendientes de validación)

```sql
-- Sobrantes donde se identificó la casa pero requiere confirmación
SELECT
  tb.id as transaction_id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.identified_house_number,
  ts.reason,
  ts.processed_at
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status IN ('not-found', 'conflict')
  AND ts.identified_house_number IS NOT NULL
ORDER BY ts.identified_house_number, ts.processed_at DESC;
```

### 7. Transacciones NO Procesadas (nuevas)

```sql
-- Transacciones que aún no han sido procesadas por ninguna conciliación
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  tb.confirmation_status
FROM transactions_bank tb
LEFT JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE tb.is_deposit = true
  AND ts.id IS NULL  -- No tiene TransactionStatus
ORDER BY tb.date DESC;
```

### 8. Historial de Procesamiento de una Transacción

```sql
-- Ver todos los intentos de conciliación de una transacción específica
SELECT
  tb.id,
  tb.amount,
  tb.date,
  tb.concept,
  ts.validation_status,
  ts.reason,
  ts.identified_house_number,
  ts.processed_at,
  ts.created_at
FROM transactions_bank tb
LEFT JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE tb.id = '12345'  -- Reemplazar con ID de transacción
ORDER BY ts.processed_at DESC;
```

## Queries para Validación Manual

### 9. Obtener Detalles de Candidatos para Validación Manual

```sql
-- Expandir candidatos de un caso manual
SELECT
  tb.id as transaction_id,
  tb.amount as transaction_amount,
  tb.date as transaction_date,
  jsonb_array_elements(ts.metadata->'possibleMatches') as candidate
FROM transactions_bank tb
INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
WHERE ts.validation_status = 'requires-manual'
  AND tb.id = '12345';  -- Reemplazar con ID
```

### 10. Comparar Transacción con sus Candidatos

```sql
-- Ver transacción y vouchers candidatos lado a lado
WITH candidates AS (
  SELECT
    tb.id as transaction_id,
    jsonb_array_elements(ts.metadata->'possibleMatches')->>'voucherId' as voucher_id
  FROM transactions_bank tb
  INNER JOIN transactions_status ts ON tb.id = ts.transactions_bank_id
  WHERE ts.validation_status = 'requires-manual'
    AND tb.id = '12345'  -- Reemplazar con ID
)
SELECT
  tb.id as transaction_id,
  tb.amount as transaction_amount,
  tb.date as transaction_date,
  v.id as voucher_id,
  v.amount as voucher_amount,
  v.date as voucher_date,
  ABS(tb.amount - v.amount) as amount_difference,
  ABS(EXTRACT(EPOCH FROM (tb.date - v.date))/3600) as hours_difference
FROM transactions_bank tb
CROSS JOIN candidates c
INNER JOIN vouchers v ON v.id = c.voucher_id::int
WHERE tb.id = c.transaction_id;
```
```

---

### ✅ FASE 8: Actualizar bd_initial.sql

#### 8.1. Actualizar schema en bd_initial.sql
**Archivo:** `bd_initial.sql`

**Buscar línea 14-18 (enum validation_status_t):**

**Reemplazar:**
```sql
CREATE TYPE "validation_status_t" AS ENUM ('not-found', 'pending', 'confirmed');
```

**Con:**
```sql
CREATE TYPE "validation_status_t" AS ENUM ('not-found', 'pending', 'confirmed', 'requires-manual', 'conflict');
```

**Buscar línea 106-114 (tabla transactions_status):**

**Reemplazar:**
```sql
CREATE TABLE "transactions_status" (
	"id" serial NOT NULL UNIQUE,
	"validation_status" validation_status_t NOT NULL DEFAULT 'pending',
	"transactions_bank_id" bigint,
	"vouchers_id" int,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);
```

**Con:**
```sql
CREATE TABLE "transactions_status" (
	"id" serial NOT NULL UNIQUE,
	"validation_status" validation_status_t NOT NULL DEFAULT 'pending',
	"transactions_bank_id" bigint,
	"vouchers_id" int,
	"reason" text,
	"identified_house_number" int,
	"processed_at" timestamptz,
	"metadata" jsonb,
	"created_at" timestamptz NOT NULL DEFAULT NOW(),
	"updated_at" timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY("id")
);
```

**Buscar línea 116-117 (comentarios de transactions_status):**

**Agregar después:**
```sql
COMMENT ON TABLE "transactions_status" IS 'Estado de validación de transacciones bancarias';
COMMENT ON COLUMN "transactions_status"."validation_status" IS 'Estado de validación: pending, confirmed, not-found, requires-manual, conflict';
COMMENT ON COLUMN "transactions_status"."reason" IS 'Razón del estado actual (ej: "Conflicto centavos vs concepto")';
COMMENT ON COLUMN "transactions_status"."identified_house_number" IS 'Casa identificada (aunque requiera validación)';
COMMENT ON COLUMN "transactions_status"."processed_at" IS 'Timestamp de última conciliación que procesó este registro';
COMMENT ON COLUMN "transactions_status"."metadata" IS 'Información adicional (candidatos, scores, matchCriteria, etc.)';
```

**Buscar línea 383-385 (índices de transactions_status):**

**Agregar después:**
```sql
CREATE INDEX idx_transactions_status_bank_id ON transactions_status(transactions_bank_id);
CREATE INDEX idx_transactions_status_voucher_id ON transactions_status(vouchers_id);
CREATE INDEX idx_transactions_status_validation ON transactions_status(validation_status);
CREATE INDEX idx_transactions_status_processed_at ON transactions_status(processed_at);
CREATE INDEX idx_transactions_status_house_number ON transactions_status(identified_house_number);
```

---

## 🧪 Plan de Testing

### Test 1: Persistencia de Sobrantes
```bash
npm test -- reconcile.use-case.spec.ts -t "should persist surplus"
```

**Esperado:** ✅ Test pasa

### Test 2: Persistencia de Casos Manuales
```bash
npm test -- reconcile.use-case.spec.ts -t "should persist manual"
```

**Esperado:** ✅ Test pasa

### Test 3: Todos los tests del feature
```bash
npm test -- src/features/bank-reconciliation/
```

**Esperado:** ✅ Todos los tests pasan (13 tests: 11 matching + 2 nuevos use-case)

### Test 4: Build completo
```bash
npm run build
```

**Esperado:** ✅ Sin errores de compilación

---

## 📊 Verificación en Base de Datos

### Paso 1: Ejecutar migrations
```bash
# Si usas TypeORM migrations
npm run db:migrate

# O aplicar manualmente
psql -U postgres -d agave_db < prisma/migrations/YYYYMMDD_add_validation_status_values/migration.sql
psql -U postgres -d agave_db < prisma/migrations/YYYYMMDD_add_transactions_status_fields/migration.sql
```

### Paso 2: Verificar enum
```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'validation_status_t'::regtype ORDER BY enumsortorder;
```

**Esperado:**
```
not-found
pending
confirmed
requires-manual
conflict
```

### Paso 3: Verificar tabla
```sql
\d transactions_status
```

**Esperado:** Ver 4 nuevas columnas (reason, identified_house_number, processed_at, metadata)

### Paso 4: Ejecutar conciliación de prueba
```bash
# Ejecutar endpoint de conciliación
curl -X POST http://localhost:3000/api/reconciliation/reconcile
```

### Paso 5: Verificar datos en BD
```sql
-- Ver todos los estados
SELECT validation_status, COUNT(*) FROM transactions_status GROUP BY validation_status;
```

**Esperado:** Ver distribución de estados (confirmed, not-found, conflict, requires-manual)

---

## 🎯 Criterios de Éxito

- [ ] Enum `validation_status_t` tiene 5 valores
- [ ] Tabla `transactions_status` tiene 4 nuevas columnas
- [ ] Entity `TransactionStatus` compila sin errores
- [ ] Métodos `persistSurplus` y `persistManualValidationCase` implementados
- [ ] `ReconcileUseCase` llama a los nuevos métodos de persistencia
- [ ] Tests unitarios pasan (13/13)
- [ ] Build exitoso sin errores TypeScript
- [ ] Sobrantes se pueden consultar en BD con query SQL
- [ ] Casos manuales se pueden consultar con candidatos
- [ ] No se reprocesa la misma transacción dos veces
- [ ] `bd_initial.sql` actualizado con nuevo schema

---

## 🔄 Comandos de Continuación (Para Próxima Sesión)

**Si necesitas retomar en otra sesión, usa este comando:**

```
Continúa con la implementación de persistencia de estados de conciliación.
Lee el archivo docs/features/bank-reconciliation/IMPLEMENTACION-PERSISTENCIA-ESTADOS.md
y continúa desde la FASE donde te quedaste.
```

**Archivos clave para continuar:**
- `docs/features/bank-reconciliation/IMPLEMENTACION-PERSISTENCIA-ESTADOS.md` (este archivo)
- `docs/features/bank-reconciliation/ANALISIS-PERSISTENCIA-ESTADOS.md` (análisis completo)
- `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts` (agregar métodos)
- `src/features/bank-reconciliation/application/reconcile.use-case.ts` (llamar nuevos métodos)

---

**Última actualización:** Octubre 2025
**Estado:** Listo para implementar
**Tiempo estimado:** 3 horas
**Prioridad:** Alta
