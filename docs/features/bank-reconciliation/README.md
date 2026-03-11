# Bank Reconciliation

Sistema automatizado que concilia transacciones bancarias con vouchers de pago para gestion de condominios.

## Responsabilidades

- Emparejar depositos bancarios con vouchers subidos por residentes
- Identificar la casa correspondiente usando multiples estrategias (monto+fecha, centavos, concepto con IA)
- Clasificar transacciones en 4 categorias: conciliadas, vouchers sin fondos, depositos no reclamados, validacion manual
- Persistir resultados en BD actualizando estados y creando registros de pago
- Integrar automaticamente con Payment Management para distribuir pagos entre conceptos
- Proveer flujos manuales para conciliar vouchers sin fondos y depositos no reclamados

## Flujo Principal

1. **Obtener datos pendientes**: Transacciones bancarias (`is_deposit=true, confirmation_status=false`) y vouchers (`confirmation_status=false`)
2. **Matching**: Emparejar usando estrategias en orden de prioridad
3. **Clasificar**: Organizar resultados en 4 categorias
4. **Persistir**: Guardar en BD con estados correspondientes
5. **Asignar pagos**: Ejecutar automaticamente `AllocatePaymentUseCase` para distribuir a conceptos

## Estrategias de Matching

### 1. Monto Exacto + Fecha Cercana
Prioridad mas alta. Compara monto exacto (+-$0.01) y fecha dentro de +-36 horas.

**Caso unico**: Concilia automaticamente.

**Multiples candidatos** (mismo monto):

1. **Discriminacion por tiempo**: Si hay un claro ganador por cercania temporal, se auto-concilia:
   - Si el mas cercano tiene `dateDiff=0` y el segundo tiene `dateDiff>0` → auto-match
   - Si el ratio `(segundo / primero) >= 2` → auto-match al mas cercano
   - Ejemplo: Deposito 13:36:45, Voucher A 13:36:36 (diff=9s), Voucher B 13:38:42 (diff=117s). Ratio=13x → auto-match a Voucher A
2. **Similarity threshold**: Si la diferencia de similitud < 5% y no hay ganador claro por tiempo → validacion manual
3. **Ganador claro por similitud**: Si la diferencia > 5% → auto-concilia con el mas cercano en fecha

**Prevencion de reutilizacion**: Cuando un caso escala a validacion manual, los voucher IDs candidatos se marcan como procesados. Esto evita que un segundo deposito con el mismo monto vea los mismos vouchers y repita el ciclo de ambiguedad.

### 2. Centavos (sin voucher)
Identifica casa por centavos. Rango valido: 1-66.

**Excepcion**: Si hay conflicto con concepto → Deposito no reclamado

### 3. Concepto con IA (sin voucher, sin centavos)
Usa regex + IA (OpenAI/Vertex AI) para extraer numero de casa del concepto.

**Patrones soportados**: "Casa 5", "c15", "cs-10", "Apto 5", "Lote 12"

### 4. Conflicto → Deposito no reclamado
Cuando centavos y concepto sugieren casas diferentes → requiere validacion manual.

## 4 Categorias de Resultados

### 1. Conciliados (`conciliados`)
Transacciones emparejadas exitosamente con voucher o identificadas sin voucher.

**Estado BD**: `validation_status = 'confirmed'`

### 2. Vouchers Sin Fondos (`unfundedVouchers`)
Vouchers que NO tienen transaccion bancaria correspondiente.

**Estado BD**: Voucher sigue con `confirmation_status = false`

**Accion**: Esperar procesamiento bancario, volver a ejecutar conciliacion, o conciliar manualmente via `POST /unfunded-vouchers/:id/match-deposit`

### 3. Depositos No Reclamados (`unclaimedDeposits`)
Transacciones bancarias sin voucher correspondiente.

**Tipo A**: Con conflicto → `validation_status = 'conflict'`
**Tipo B**: Sin informacion → `validation_status = 'not-found'`

**Accion**: Asignar casa manualmente via `POST /unclaimed-deposits/:id/assign-house`

### 4. Validacion Manual (`manualValidationRequired`)
Multiples vouchers con similitud muy cercana (< 5%).

**Estado BD**: `validation_status = 'requires-manual'`

**Auditoria**: Se registra en `manual_validation_approvals`

## API Endpoints

### POST /bank-reconciliation/reconcile
Ejecuta proceso de conciliacion. Ambos parametros opcionales. Sin parametros: procesa TODO lo pendiente.

### GET /bank-reconciliation/manual-validation/pending
Lista casos que requieren validacion manual. Paginado con filtros.

### POST /bank-reconciliation/manual-validation/:transactionId/approve
Aprueba un caso eligiendo uno de los vouchers candidatos.

### POST /bank-reconciliation/manual-validation/:transactionId/reject
Rechaza todos los vouchers candidatos.

### GET /bank-reconciliation/manual-validation/stats
Retorna estadisticas agregadas de validacion manual.

### GET /bank-reconciliation/unclaimed-deposits
Lista depositos no reclamados (estados: conflict, not-found). Paginado con filtros.

### POST /bank-reconciliation/unclaimed-deposits/:transactionId/assign-house
Asigna manualmente una casa a un deposito no reclamado.

### GET /bank-reconciliation/unfunded-vouchers
Lista vouchers sin fondos (confirmation_status=false, sin TransactionStatus confirmado). Paginado con filtros.

### POST /bank-reconciliation/unfunded-vouchers/:voucherId/match-deposit
Concilia manualmente un voucher sin fondos con un deposito bancario existente.

## Integracion con Payment Management

Cada conciliacion exitosa ejecuta automaticamente `AllocatePaymentUseCase` con **distribucion FIFO** (sin `period_id`):

1. Distribuye monto a periodos mas antiguos primero (FIFO)
2. Para cada periodo: cubre conceptos en orden (MAINTENANCE → WATER → EXTRAORDINARY_FEE → PENALTIES)
3. Verifica allocaciones existentes para evitar sobre-asignacion
4. Centavos se acumulan en `house_balances.accumulated_cents`
5. Crea `RecordAllocation` para trazabilidad

**Cambio Feb 2026**: Ya NO se obtiene/crea periodo actual. El FIFO automatico determina a que periodos aplicar el pago. Los callers (`ReconciliationPersistenceService`, `UnclaimedDepositsService`, `MatchSuggestionsService`) ya no inyectan `PeriodRepository` ni `EnsurePeriodExistsUseCase`.

Esto ocurre en:
- Conciliaciones automaticas con voucher
- Conciliaciones automaticas sin voucher (centavos/concepto)
- Asignaciones manuales de depositos no reclamados
- Conciliaciones manuales de vouchers sin fondos

**Excepcion**: `PaymentManagementController.confirmDistribution()` SI pasa `period_id` (modo manual, cuando admin confirma distribucion AI).

## Persistencia en Base de Datos

### Estados en `transactions_status.validation_status`

| Estado | Significado | Se reprocesa? |
|--------|-------------|---------------|
| `pending` | No procesado | Si |
| `confirmed` | Conciliado exitosamente | No |
| `conflict` | Conflicto entre fuentes | No (requiere manual) |
| `not-found` | Sin informacion | No (requiere manual) |
| `requires-manual` | Multiples candidatos | No (requiere manual) |

### Proteccion contra reprocesamiento

- `confirmation_status=true` se actualiza en TODOS los flujos: conciliacion, surplus y validacion manual
- Depositos ya procesados no aparecen en ejecuciones posteriores de reconcile
- Asignacion manual es idempotente: si ya fue asignado, retorna error 400

### Auditoria de Decisiones Manuales

Tabla `manual_validation_approvals` registra quien, cuando y por que se tomo cada decision manual.

## Configuracion

Archivo: `src/features/bank-reconciliation/config/reconciliation.config.ts`

| Parametro | Valor | Descripcion |
|-----------|-------|-------------|
| `DATE_TOLERANCE_HOURS` | 36 | Tolerancia de fecha/hora para matching |
| `SIMILARITY_THRESHOLD` | 0.05 | Umbral para escalar a validacion manual (5%) |
| `ENABLE_CONCEPT_MATCHING` | true | Analisis de concepto habilitado |
| `ENABLE_AI_CONCEPT_ANALYSIS` | true | Usa IA si regex no es concluyente |
| `ENABLE_MANUAL_VALIDATION` | true | Validacion manual habilitada |
| `MAX_HOUSE_NUMBER` | 66 | Rango valido de casas |

## Dependencias

### Modulos externos
- `OpenAIModule`: Analisis de concepto con IA
- `VertexAIModule`: Fallback si OpenAI falla
- `PaymentManagementModule`: Asignacion automatica de pagos

### Entidades
- `TransactionBank`, `Voucher`, `TransactionStatus`, `Record`, `HouseRecord`, `House`

## Limpieza de Archivos

Cuando un voucher se concilia exitosamente, su imagen se elimina del bucket GCS y `voucher.url` se actualiza a null.

---

**Ultima actualizacion**: Febrero 2026
**Estado**: Production Ready
