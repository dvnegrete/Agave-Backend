# Backfill Allocations

**Última actualización**: 2026-02-12

## Qué Hace

Procesa records confirmados que no tienen `record_allocations` y les aplica distribución de pagos. Útil para:
- Corregir records históricos sin allocaciones
- Re-procesar después de cambios en lógica de distribución
- Migrar datos existentes al nuevo sistema FIFO

## Comportamiento Actual (FIFO)

Desde Feb 2026, el backfill usa **distribución FIFO automática** (sin `period_id`):

```
BackfillAllocationsUseCase.execute()
  ├─ Encuentra records confirmados sin allocations
  ├─ Ordena por fecha de transacción ASC (más antiguo primero)
  ├─ Para cada record:
  │  ├─ EnsurePeriodExistsUseCase.execute(year, month)
  │  │  └─ Garantiza que el período y sus house_period_charges existan
  │  └─ AllocatePaymentUseCase.execute({
  │       record_id, house_id, amount
  │       // SIN period_id → FIFO automático
  │     })
  │     └─ Distribuye a periodos más antiguos primero
  └─ Retorna resultados por record
```

**Antes (pre-FIFO)**: Se asignaba al período de la fecha de transacción.
**Ahora**: Se distribuye FIFO a TODOS los períodos con deuda, empezando por el más antiguo.

## Endpoint

```
POST /payment-management/backfill-allocations?houseNumber=58
```

- **Auth:** Bearer token (ADMIN only)
- **Query param opcional:** `houseNumber` (1-66). Sin param procesa todas las casas.

## Response Type

```ts
export interface BackfillRecordResult {
  record_id: number;
  house_number: number;
  transaction_date: string;
  period_year: number;
  period_month: number;
  amount: number;
  status: 'processed' | 'skipped' | 'failed';
  error?: string;
}

export interface BackfillAllocationsResponse {
  total_records_found: number;
  processed: number;
  skipped: number;
  failed: number;
  results: BackfillRecordResult[];
}
```

## Integración Frontend

### Service

```ts
export const backfillAllocations = async (
  houseNumber?: number,
  signal?: AbortSignal
): Promise<BackfillAllocationsResponse> => {
  const params = houseNumber ? `?houseNumber=${houseNumber}` : '';
  const response = await httpClient.post<BackfillAllocationsResponse>(
    `${API_BASE}/backfill-allocations${params}`,
    {},
    { signal }
  );
  return response;
};
```

### Hook

```ts
export const useBackfillAllocationsMutation = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (houseNumber?: number) => backfillAllocations(houseNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentManagementKeys.balances(),
      });
    },
  });

  return {
    backfill: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error?.message || null,
    data: mutation.data || null,
  };
};
```

## Notas

- **Idempotente:** ejecutar multiples veces es seguro. Records ya procesados se reportan como `skipped`.
- **FIFO**: El pago se distribuye a periodos con deuda pendiente, no solo al periodo de la transacción.
- **Orden**: Procesa records en orden cronológico ASC para mantener consistencia FIFO.
- **Periods**: `EnsurePeriodExistsUseCase` garantiza que el periodo exista con sus `house_period_charges` antes de distribuir.
- Despues del backfill los queries de `houseStatus` y `houseBalance` se invalidan automaticamente.
