# Plan de Correcciones: Duplicacion de Depositos No Reclamados

**Fecha:** 2026-02-06
**Basado en:** `DUPLICATE_DEPOSITS_ANALYSIS.md`
**Objetivo:** Corregir datos corruptos en produccion Y prevenir futuras duplicaciones

---

## CONTEXTO RAPIDO

### Que esta pasando

El metodo `persistSurplus()` en `reconciliation-persistence.service.ts` crea un `TransactionStatus` para depositos no reclamados pero **NO actualiza** `confirmation_status = true` en la tabla `transactions_bank`. Esto causa:

1. Depositos quedan con `confirmation_status=false` despues de ser procesados
2. Si hay multiples `TransactionStatus` para un mismo `TransactionBank`, el query LEFT JOIN en `getUnclaimedDeposits()` retorna filas duplicadas
3. El usuario ve el mismo deposito varias veces y puede asignar casa multiples veces
4. Balances de casas se multiplican (ej: $1500 se vuelve $4500)

### El mismo bug existe en `persistManualValidationCase()` (linea 441-483)

---

## PARTE A: CORRECCION DE DATOS EN PRODUCCION

### Tarea A1: Crear migracion para limpiar datos duplicados

**Archivo a crear:** `src/shared/database/migrations/1769700000000-FixDuplicateTransactionStatus.ts`

**Proposito:** Limpiar `TransactionStatus` duplicados y marcar `confirmation_status=true` en transacciones ya procesadas.

**Logica de la migracion:**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDuplicateTransactionStatus1769700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PASO 1: Identificar TransactionStatus duplicados
    // Mantener el mas reciente (MAX(id)) por cada transactions_bank_id
    // Eliminar los demas
    await queryRunner.query(`
      DELETE FROM transactions_status
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM transactions_status
        WHERE transactions_bank_id IS NOT NULL
        GROUP BY transactions_bank_id
      )
      AND transactions_bank_id IS NOT NULL
    `);

    // PASO 2: Actualizar confirmation_status = true en transactions_bank
    // para TODAS las transacciones que YA tienen un TransactionStatus
    // (fueron procesadas por reconciliacion pero no se les marco)
    await queryRunner.query(`
      UPDATE transactions_bank tb
      SET confirmation_status = true
      WHERE tb.confirmation_status = false
        AND tb.is_deposit = true
        AND EXISTS (
          SELECT 1
          FROM transactions_status ts
          WHERE ts.transactions_bank_id = tb.id
        )
    `);

    // PASO 3: Eliminar Records duplicados creados por asignaciones multiples
    // del mismo deposito. Mantener solo el primer Record por transaction_status_id.
    // Primero eliminar record_allocations huerfanos
    await queryRunner.query(`
      DELETE FROM record_allocations
      WHERE record_id IN (
        SELECT r.id
        FROM records r
        INNER JOIN (
          SELECT transaction_status_id, MIN(id) as keep_id
          FROM records
          WHERE transaction_status_id IS NOT NULL
          GROUP BY transaction_status_id
          HAVING COUNT(*) > 1
        ) dups ON r.transaction_status_id = dups.transaction_status_id
        WHERE r.id != dups.keep_id
      )
    `);

    // Luego eliminar house_records huerfanos
    await queryRunner.query(`
      DELETE FROM house_records
      WHERE record_id IN (
        SELECT r.id
        FROM records r
        INNER JOIN (
          SELECT transaction_status_id, MIN(id) as keep_id
          FROM records
          WHERE transaction_status_id IS NOT NULL
          GROUP BY transaction_status_id
          HAVING COUNT(*) > 1
        ) dups ON r.transaction_status_id = dups.transaction_status_id
        WHERE r.id != dups.keep_id
      )
    `);

    // Finalmente eliminar los records duplicados
    await queryRunner.query(`
      DELETE FROM records
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM records
        WHERE transaction_status_id IS NOT NULL
        GROUP BY transaction_status_id
      )
      AND transaction_status_id IN (
        SELECT transaction_status_id
        FROM records
        WHERE transaction_status_id IS NOT NULL
        GROUP BY transaction_status_id
        HAVING COUNT(*) > 1
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No es reversible: los datos duplicados no se pueden recrear
    // Solo revertir el cambio de confirmation_status
    // NOTA: Esto es informativo, no se debe ejecutar down en produccion
    console.warn(
      'ADVERTENCIA: down() no puede restaurar datos duplicados eliminados',
    );
  }
}
```

**IMPORTANTE - Antes de ejecutar la migracion:**
1. Hacer backup de la base de datos
2. Ejecutar las queries de auditoria de la seccion 8 del analisis para cuantificar el impacto
3. Revisar los resultados con el equipo antes de aplicar

---

## PARTE B: CORRECCIONES EN CODIGO (5 tareas)

### Tarea B1: Agregar `updateTransactionBankStatus()` en `persistSurplus()`

**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`
**Linea:** 413 (justo ANTES de `await queryRunner.commitTransaction();`)
**Severidad:** CRITICA - Root cause del bug

**Cambio exacto:**

Buscar en linea 412-414:
```typescript
      queryRunner,
    );

    await queryRunner.commitTransaction();
```

Reemplazar por:
```typescript
      queryRunner,
    );

    // Marcar transaccion como procesada para evitar reprocesamiento
    await this.updateTransactionBankStatus(transactionBankId, queryRunner);

    await queryRunner.commitTransaction();
```

**Por que:** `persistReconciliation()` (linea 145) ya llama a `updateTransactionBankStatus()` despues de crear el TransactionStatus. `persistSurplus()` debe hacer lo mismo para que el deposito no reclamado quede marcado como procesado y no aparezca de nuevo en consultas futuras.

**Referencia del metodo existente (linea 337-346):**
```typescript
private async updateTransactionBankStatus(
  transactionBankId: string,
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.manager.update(
    'transactions_bank',
    { id: transactionBankId },
    { confirmation_status: true },
  );
}
```

---

### Tarea B2: Agregar `updateTransactionBankStatus()` en `persistManualValidationCase()`

**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`
**Linea:** 465 (justo ANTES de `await queryRunner.commitTransaction();`)
**Severidad:** ALTA - Mismo patron de bug que B1

**Cambio exacto:**

Buscar en linea 462-465:
```typescript
        queryRunner,
      );

      await queryRunner.commitTransaction();
```

Reemplazar por:
```typescript
        queryRunner,
      );

      // Marcar transaccion como procesada para evitar reprocesamiento
      await this.updateTransactionBankStatus(transactionBankId, queryRunner);

      await queryRunner.commitTransaction();
```

**Por que:** Mismo razonamiento que B1. Los casos de validacion manual tambien deben marcar la transaccion como procesada para que no se vuelvan a procesar.

---

### Tarea B3: Agregar DISTINCT en query de `getUnclaimedDeposits()`

**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/unclaimed-deposits.service.ts`
**Linea:** 73-89
**Severidad:** ALTA - Defensa contra duplicados en la consulta

**Cambio exacto:**

Buscar en linea 73-89:
```typescript
    let query = this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin(TransactionStatus, 'ts', 'ts.transactions_bank_id = tb.id')
      .where('tb.is_deposit = :isDeposit', { isDeposit: true })
      .select([
        'tb.id',
        'tb.amount',
        'tb.date',
        'tb.time',
        'tb.concept',
        'ts.validation_status',
        'ts.reason',
        'ts.identified_house_number',
        'ts.metadata',
        'ts.processed_at',
      ]);
```

Reemplazar por:
```typescript
    let query = this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin(
        (qb) =>
          qb
            .select('ts_inner.*')
            .addSelect(
              'ROW_NUMBER() OVER (PARTITION BY ts_inner.transactions_bank_id ORDER BY ts_inner.id DESC)',
              'rn',
            )
            .from(TransactionStatus, 'ts_inner'),
        'ts_ranked',
        'ts_ranked.transactions_bank_id = tb.id AND ts_ranked.rn = 1',
      )
      .where('tb.is_deposit = :isDeposit', { isDeposit: true })
      .select([
        'tb.id',
        'tb.amount',
        'tb.date',
        'tb.time',
        'tb.concept',
        'ts_ranked.validation_status AS "ts_validation_status"',
        'ts_ranked.reason AS "ts_reason"',
        'ts_ranked.identified_house_number AS "ts_identified_house_number"',
        'ts_ranked.metadata AS "ts_metadata"',
        'ts_ranked.processed_at AS "ts_processed_at"',
      ]);
```

**ALTERNATIVA MAS SIMPLE (preferida si funciona con TypeORM):**

Si la subquery genera problemas de compatibilidad con TypeORM, usar la alternativa con `distinctOn`:

```typescript
    let query = this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin(TransactionStatus, 'ts', 'ts.transactions_bank_id = tb.id')
      .where('tb.is_deposit = :isDeposit', { isDeposit: true })
      .select([
        'DISTINCT ON (tb.id) tb.id',
        'tb.amount',
        'tb.date',
        'tb.time',
        'tb.concept',
        'ts.validation_status',
        'ts.reason',
        'ts.identified_house_number',
        'ts.metadata',
        'ts.processed_at',
      ]);
```

**NOTA:** Si se usa `DISTINCT ON`, hay que tener cuidado con el `orderBy` posterior (lineas 126-130). PostgreSQL requiere que las columnas de `DISTINCT ON` sean las primeras en el `ORDER BY`. Evaluar la mejor opcion al implementar.

**Enfoque recomendado para Haiku:** Usar la alternativa simple. Cambiar SOLO la linea del `.select()` para que el primer campo sea `'DISTINCT ON (tb.id) tb.id'` en lugar de `'tb.id'`. Luego ajustar los `.orderBy()` de las lineas 126-130 para que incluyan `tb.id` como primer criterio:

```typescript
    // Ordenar (tb.id primero para DISTINCT ON)
    if (sortBy === 'date') {
      query = query.orderBy('tb.id').addOrderBy('tb.date', 'DESC');
    } else if (sortBy === 'amount') {
      query = query.orderBy('tb.id').addOrderBy('tb.amount', 'DESC');
    }
```

**Por que:** Si por algun motivo llegan a existir multiples TransactionStatus para el mismo TransactionBank (data legacy, bugs futuros), la consulta debe retornar exactamente 1 fila por deposito. Esta es una defensa en profundidad.

---

### Tarea B4: Agregar log de advertencia en `findByTransactionBankId()`

**Archivo:** `src/shared/database/repositories/transaction-status.repository.ts`
**Linea:** 94-102
**Severidad:** MEDIA - Monitoreo/deteccion de anomalias

**Cambio exacto:**

Primero, agregar import de Logger al inicio del archivo (linea 1):
```typescript
import { Injectable, Logger } from '@nestjs/common';
```

Luego, agregar logger como propiedad de la clase (despues de linea 44):
```typescript
@Injectable()
export class TransactionStatusRepository {
  private readonly logger = new Logger(TransactionStatusRepository.name);
```

Finalmente, reemplazar el metodo `findByTransactionBankId` (lineas 94-102):

Buscar:
```typescript
  async findByTransactionBankId(
    transactionBankId: string,
  ): Promise<TransactionStatus[]> {
    return this.transactionStatusRepository.find({
      where: { transactions_bank_id: Number(transactionBankId) },
      relations: ['voucher', 'records'],
      order: { created_at: 'DESC' },
    });
  }
```

Reemplazar por:
```typescript
  async findByTransactionBankId(
    transactionBankId: string,
  ): Promise<TransactionStatus[]> {
    const results = await this.transactionStatusRepository.find({
      where: { transactions_bank_id: Number(transactionBankId) },
      relations: ['voucher', 'records'],
      order: { created_at: 'DESC' },
    });

    if (results.length > 1) {
      this.logger.warn(
        `TransactionStatus duplicados detectados para TransactionBank ${transactionBankId}. ` +
          `Encontrados: ${results.length}, IDs: [${results.map((r) => r.id).join(', ')}]`,
      );
    }

    return results;
  }
```

**Por que:** No cambia el comportamiento, pero emite un warning cuando detecta duplicados. Esto permite monitorear si el problema se sigue presentando despues del fix.

---

### Tarea B5: Agregar guarda de idempotencia en `assignHouseToDeposit()`

**Archivo:** `src/features/bank-reconciliation/infrastructure/persistence/unclaimed-deposits.service.ts`
**Linea:** 175-192 (despues del `startTransaction`, antes de las validaciones)
**Severidad:** ALTA - Evita asignaciones duplicadas

**Cambio exacto:**

Buscar en lineas 175-192:
```typescript
    try {
      // 1. Obtener transaccion y su estado usando repositorio
      const transactionStatuses =
        await this.transactionStatusRepository.findByTransactionBankId(
          transactionId,
        );

      const transactionStatus = transactionStatuses?.find(
        (ts) =>
          ts.validation_status === ValidationStatus.CONFLICT ||
          ts.validation_status === ValidationStatus.NOT_FOUND,
      );

      if (!transactionStatus) {
        throw new NotFoundException(
          `Deposito no reclamado no encontrado: ${transactionId}`,
        );
      }
```

Reemplazar por:
```typescript
    try {
      // 0. Guarda de idempotencia: verificar que la transaccion no haya sido ya asignada
      const existingTransaction =
        await this.transactionBankRepository.findById(transactionId);

      if (!existingTransaction) {
        throw new NotFoundException(
          `Transaccion bancaria no encontrada: ${transactionId}`,
        );
      }

      if (existingTransaction.confirmation_status === true) {
        throw new BadRequestException(
          `El deposito ${transactionId} ya fue asignado previamente`,
        );
      }

      // 1. Obtener transaccion y su estado usando repositorio
      const transactionStatuses =
        await this.transactionStatusRepository.findByTransactionBankId(
          transactionId,
        );

      const transactionStatus = transactionStatuses?.find(
        (ts) =>
          ts.validation_status === ValidationStatus.CONFLICT ||
          ts.validation_status === ValidationStatus.NOT_FOUND,
      );

      if (!transactionStatus) {
        throw new NotFoundException(
          `Deposito no reclamado no encontrado: ${transactionId}`,
        );
      }
```

**Por que:** Si el usuario hace clic dos veces en "Asignar Casa" (o si hay duplicados en la UI), la segunda llamada debe fallar con un error claro en vez de crear Records y Allocations duplicados. Se verifica `confirmation_status` ANTES de empezar la logica de asignacion.

**NOTA:** Esto hace redundante la consulta de `transactionBankRepository.findById()` de la linea 195-196. Se puede eliminar esa segunda consulta y reusar `existingTransaction` (renombrar a `transaction`). Pero para minimizar cambios, se puede dejar ambas. Haiku puede decidir si optimizar.

---

## PARTE C: ORDEN DE EJECUCION

```
1. B1 - persistSurplus()          [Root cause - 1 linea]
2. B2 - persistManualValidation() [Mismo patron - 1 linea]
3. B5 - assignHouseToDeposit()    [Idempotencia - bloque nuevo]
4. B3 - getUnclaimedDeposits()    [DISTINCT - ajuste query]
5. B4 - findByTransactionBankId() [Logger - monitoreo]
6. A1 - Migracion de datos        [Limpieza produccion]
```

**Razon del orden:**
- B1 y B2 son el root cause, se corrigen primero
- B5 previene que el usuario duplique asignaciones (defensa inmediata)
- B3 previene que la UI muestre duplicados (defensa visual)
- B4 es monitoreo para detectar futuros problemas
- A1 se ejecuta AL FINAL porque la migracion limpia datos, y es mejor que el codigo ya este corregido antes de limpiar

---

## PARTE D: VALIDACION POST-FIX

### Compilacion
```bash
npm run build
```
Debe compilar sin errores.

### Queries de verificacion (ejecutar en BD despues de la migracion A1)

```sql
-- 1. No debe haber TransactionStatus duplicados
SELECT transactions_bank_id, COUNT(*) as cnt
FROM transactions_status
WHERE transactions_bank_id IS NOT NULL
GROUP BY transactions_bank_id
HAVING COUNT(*) > 1;
-- Esperado: 0 filas

-- 2. Todas las TX con TransactionStatus deben tener confirmation_status=true
SELECT tb.id, tb.confirmation_status
FROM transactions_bank tb
INNER JOIN transactions_status ts ON ts.transactions_bank_id = tb.id
WHERE tb.confirmation_status = false;
-- Esperado: 0 filas

-- 3. No debe haber Records duplicados para el mismo transaction_status_id
SELECT transaction_status_id, COUNT(*) as cnt
FROM records
WHERE transaction_status_id IS NOT NULL
GROUP BY transaction_status_id
HAVING COUNT(*) > 1;
-- Esperado: 0 filas
```

### Test funcional manual
1. Ejecutar `POST /reconcile` con depositos nuevos sin voucher match
2. Verificar que `GET /unclaimed-deposits` muestra cada deposito UNA sola vez
3. Asignar casa a un deposito con `POST /unclaimed-deposits/:id/assign-house`
4. Verificar que intentar asignar de nuevo retorna error 400
5. Verificar que el balance de la casa es correcto (no duplicado)

---

## RESUMEN DE ARCHIVOS A MODIFICAR

| # | Archivo | Tipo de cambio | Lineas afectadas |
|---|---------|---------------|-----------------|
| B1 | `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts` | Agregar 1 linea | 413 |
| B2 | `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts` | Agregar 1 linea | 465 |
| B3 | `src/features/bank-reconciliation/infrastructure/persistence/unclaimed-deposits.service.ts` | Modificar query | 73-130 |
| B4 | `src/shared/database/repositories/transaction-status.repository.ts` | Agregar Logger + warn | 1, 44, 94-102 |
| B5 | `src/features/bank-reconciliation/infrastructure/persistence/unclaimed-deposits.service.ts` | Agregar bloque de validacion | 175-192 |
| A1 | `src/shared/database/migrations/1769700000000-FixDuplicateTransactionStatus.ts` | Archivo NUEVO (migracion) | N/A |

---

## NOTAS PARA HAIKU

1. **NO crear archivos nuevos** excepto la migracion A1
2. **NO refactorizar** codigo que no este en el plan
3. **NO modificar** tests existentes
4. **NO agregar** dependencias nuevas
5. El nombre exacto de la tabla en BD es `transactions_status` (con s), NO `transaction_status`
6. El entity se llama `TransactionStatus` (sin s), la tabla es `transactions_status` (con s)
7. El metodo `updateTransactionBankStatus()` ya existe en `reconciliation-persistence.service.ts` (linea 337-346), NO hay que crearlo
8. Respetar los patrones de indentacion existentes (2 espacios)
9. Para la migracion, seguir el patron de nombre: `{timestamp}-{NombreDescriptivo}.ts` (ver ejemplos en `src/shared/database/migrations/`)
10. Compilar con `npm run build` despues de cada cambio para verificar que no hay errores de TypeScript
