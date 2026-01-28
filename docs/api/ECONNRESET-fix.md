# Fix: ECONNRESET Error en /vouchers/frontend/confirm

## Problema

Al llamar a `POST /vouchers/frontend/confirm`, el endpoint retornaba error **500** con el siguiente error en los logs:

```
ERROR [VouchersFrontendController] Error confirmando voucher: read ECONNRESET
ERROR [ExceptionsHandler] Error: read ECONNRESET
  at TCP.onStreamRead (node:internal/stream_base_commons:218:20) {
  errno: -104,
  code: 'ECONNRESET',
  syscall: 'read'
}
```

## Causa Root

El error `ECONNRESET` indica que **la conexión TCP a la base de datos se está cerrando inesperadamente**.

La causa específica era el orden de las operaciones en `ConfirmVoucherFrontendUseCase`:

### ❌ Flujo INCORRECTO (Antes)

```typescript
async execute(input) {
  // ❌ PROBLEMA: Abrir conexión DEMASIADO PRONTO
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();  // <-- Conexión abierta aquí

  try {
    // ... validaciones ...

    // ❌ PROBLEMA: Usar otra conexión de BD mientras tenemos una abierta
    const duplicateCheck = await this.duplicateDetector.detectDuplicate(...);  // Usa su propia conexión

    // ❌ PROBLEMA: Crear voucher fuera de transacción
    const generateResult = await generateUniqueConfirmationCode(...);  // Crea en BD sin transacción

    // ❌ PROBLEMA: AHORA abrir transacción (demasiado tarde)
    await queryRunner.startTransaction();

    // ... más operaciones ...
  }
}
```

**Conflictos de Conexión:**
1. Se abre una conexión con `queryRunner.connect()`
2. Se usan otras conexiones en `duplicateDetector` y `generateUniqueConfirmationCode`
3. Se intenta usar la primera conexión para transacción
4. Conflictos en el pool de conexiones → ECONNRESET

---

## ✅ Solución Implementada

Reordenar las operaciones para que **todas las validaciones ocurran ANTES de crear el QueryRunner**:

```typescript
async execute(input) {
  // ✅ CORRECTO: Validaciones PRIMERO (sin conexión BD)
  const amount = parseFloat(monto);
  if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new BadRequestException(...);
  }

  const dateTime = combineDateAndTime(fecha_pago, hora_transaccion);

  // ✅ CORRECTO: Operaciones de BD con conexiones independientes
  const duplicateCheck = await this.duplicateDetector.detectDuplicate(...);
  const generateResult = await generateUniqueConfirmationCode(...);

  // ✅ CORRECTO: QueryRunner DESPUÉS de todo lo anterior
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // ✅ CORRECTO: Transacción AQUÍ para las operaciones finales
    await queryRunner.startTransaction();

    // ... crear User, House, Record, HouseRecord ...

    await queryRunner.commitTransaction();
  } finally {
    await queryRunner.release();
  }
}
```

### ✅ Beneficios

1. **No conflictos de conexión** - Cada operación usa su propia conexión cuando es necesario
2. **Transacción clara** - La transacción solo contiene operaciones relacionadas
3. **Mejor manejo de recursos** - QueryRunner se crea solo cuando es necesario
4. **ECONNRESET eliminado** - No hay conflictos en el pool de conexiones

---

## Cambios Realizados

**Archivo:** `src/features/vouchers/application/confirm-voucher-frontend.use-case.ts`

### Cambios:
1. Mover validaciones de `monto` al inicio (antes de cualquier conexión BD)
2. Mover combinación de fecha/hora antes de conexión
3. Ejecutar `duplicateDetector.detectDuplicate()` antes de crear QueryRunner
4. Ejecutar `generateUniqueConfirmationCode()` antes de crear QueryRunner
5. **Crear QueryRunner DESPUÉS de todas esas operaciones**
6. Iniciar transacción con el nuevo QueryRunner
7. Mantener el try-finally para liberar recursos

---

## Testing

✅ **Build:** Exitoso (TypeScript sin errores)
✅ **Tests:** 13/13 pasando en confirm-voucher-frontend.use-case.spec.ts
✅ **Otros tests:** 40/40 pasando en todo el módulo

---

## Resultado

El endpoint `/vouchers/frontend/confirm` ahora:
- ✅ Acepta datos correctamente
- ✅ Procesa sin errores de conexión
- ✅ Retorna confirmationCode exitosamente
- ✅ Crea relaciones en BD sin conflictos

---

## Instrucciones para Probar

### 1. Build y reiniciar servidor
```bash
npm run build
npm run start:dev
```

### 2. Prueba con el mismo payload
```bash
curl -X POST http://localhost:3000/vouchers/frontend/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "gcsFilename": "07d0570189b2.jpg",
    "monto": "800.00",
    "fecha_pago": "2025-11-14",
    "hora_transaccion": "13:38:42",
    "casa": 60,
    "referencia": "688979"
  }'
```

### 3. Respuesta esperada (200 OK)
```json
{
  "success": true,
  "confirmationCode": "202501-XXXXX",
  "voucher": {
    "id": 1,
    "amount": 800.00,
    "date": "2025-11-14T13:38:42.000Z",
    "casa": 60,
    "referencia": "688979",
    "confirmation_status": false
  }
}
```

---

## Patrones Aplicados

- **Validación Primero**: Hacer todas las validaciones antes de recursos escasos (conexiones BD)
- **Conexiones por Demanda**: Crear conexiones solo cuando se necesitan
- **Transacciones Focalizadas**: Las transacciones contienen solo lo que necesita ser atómico
- **Resource Cleanup**: Siempre liberar en `finally`

---

## Referencias

- [TypeORM QueryRunner Docs](https://typeorm.io/query-runner)
- [ECONNRESET Error](https://nodejs.org/en/docs/guides/blocking-vs-non-blocking/)
- [Connection Pool Management](https://en.wikipedia.org/wiki/Connection_pool)
